using System.Text.RegularExpressions;
using AsyaMun.Api.Data;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Errors;
using AsyaMun.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AsyaMun.Api.Services;

public class DelegateAttrService
{
    private static readonly Regex AttrKeyRegex = new("^[a-zA-Z][a-zA-Z0-9_]{1,79}$", RegexOptions.Compiled);

    private static readonly HashSet<UserRole> WriteRoles = new() { UserRole.DH, UserRole.DM, UserRole.SYS_ADMIN };

    private readonly AppDbContext _db;

    public DelegateAttrService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<DelegateAttrConfigResponse> CreateConfigAsync(
        Guid requesterUuid,
        DelegateAttrConfigCreateRequest request,
        CancellationToken ct = default)
    {
        var requester = await GetUserAsync(requesterUuid, ct);
        RequireManageRole(requester);
        var conference = requester.Conference
            ?? throw new InvalidOperationException("User not associated with any conference");

        if (string.IsNullOrWhiteSpace(request.AttrLabel))
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "attrLabel不能为空");
        }

        if (!request.AttrType.HasValue)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "attrType不能为空");
        }

        var attrKey = request.AttrKey.Trim();
        ValidateAttrKey(attrKey);

        var exists = await _db.DelegateAttrConfigs
            .AsNoTracking()
            .AnyAsync(c => c.ConferenceId == conference.Uuid && c.AttrKey == attrKey, ct);
        if (exists)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Attribute key already exists in current conference: {request.AttrKey}");
        }

        var now = NowUtc();
        var config = new DelegateAttrConfig
        {
            Id = Guid.NewGuid(),
            ConferenceId = conference.Uuid,
            AttrKey = attrKey,
            AttrLabel = request.AttrLabel.Trim(),
            AttrType = request.AttrType.Value,
            Enabled = request.Enabled,
            Visible = request.Visible,
            SortOrder = request.SortOrder,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedBy = requester.Uuid,
            UpdatedBy = requester.Uuid
        };

        _db.DelegateAttrConfigs.Add(config);
        await _db.SaveChangesAsync(ct);

        return ToResponse(config);
    }

    public async Task<DelegateAttrConfigResponse> UpdateConfigAsync(
        Guid requesterUuid,
        Guid configId,
        DelegateAttrConfigUpdateRequest request,
        CancellationToken ct = default)
    {
        var requester = await GetUserAsync(requesterUuid, ct);
        RequireManageRole(requester);
        var conferenceUuid = requester.Conference?.Uuid
            ?? throw new InvalidOperationException("User not associated with any conference");

        var config = await _db.DelegateAttrConfigs.FirstOrDefaultAsync(c => c.Id == configId, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Config not found: {configId}");

        EnsureSameConference(config.ConferenceId, conferenceUuid);

        if (request.AttrLabel != null)
        {
            config.AttrLabel = request.AttrLabel.Trim();
        }

        if (request.AttrType.HasValue)
        {
            config.AttrType = request.AttrType.Value;
        }

        if (request.SortOrder.HasValue)
        {
            config.SortOrder = request.SortOrder.Value;
        }

        if (request.Enabled.HasValue)
        {
            config.Enabled = request.Enabled.Value;
        }

        if (request.Visible.HasValue)
        {
            config.Visible = request.Visible.Value;
        }

        config.UpdatedAt = NowUtc();
        config.UpdatedBy = requester.Uuid;

        await _db.SaveChangesAsync(ct);

        return ToResponse(config);
    }

    public async Task<List<DelegateAttrConfigResponse>> ListConfigsAsync(Guid requesterUuid, CancellationToken ct = default)
    {
        var requester = await GetUserAsync(requesterUuid, ct);
        var conferenceUuid = requester.Conference?.Uuid
            ?? throw new InvalidOperationException("User not associated with any conference");

        var configs = await GetConfigsAsync(conferenceUuid, ct);
        return configs.Select(ToResponse).ToList();
    }

    public async Task<DelegateAttrRecordPageResponse> ListMyRecordsAsync(
        Guid requesterUuid,
        PageInput pageInput,
        CancellationToken ct = default)
    {
        var requester = await GetUserAsync(requesterUuid, ct);
        if (requester.Role != UserRole.DELEGATE)
        {
            throw new ForbiddenException("Only DELEGATE can query own delegate attributes");
        }

        var conferenceUuid = requester.Conference?.Uuid
            ?? throw new InvalidOperationException("User not associated with any conference");

        var configs = await GetConfigsAsync(conferenceUuid, ct);
        var visibleConfigs = configs.Where(c => c.Visible).ToList();

        IQueryable<DelegateAttrRecord> query = _db.DelegateAttrRecords
            .AsNoTracking()
            .Include(r => r.Delegate)
            .Where(r => r.DelegateId == requester.Uuid && r.ConferenceId == conferenceUuid);

        var page = await query.ToPageAsync(WithDefaultSort(pageInput), ct);
        var records = await MapRecordPageAsync(page, visibleConfigs, ct);

        return new DelegateAttrRecordPageResponse(visibleConfigs.Select(ToResponse).ToList(), records);
    }

    public async Task<DelegateAttrRecordResponse> CreateRecordForDelegateAsync(
        Guid requesterUuid,
        Guid delegateId,
        DelegateAttrRecordUpsertRequest request,
        CancellationToken ct = default)
    {
        var requester = await GetUserAsync(requesterUuid, ct);
        RequireManageRole(requester);
        var conference = requester.Conference
            ?? throw new InvalidOperationException("User not associated with any conference");

        var delegateUser = await GetDelegateAsync(delegateId, ct);
        EnsureSameConference(delegateUser.Conference?.Uuid, conference.Uuid);

        var now = NowUtc();
        var record = new DelegateAttrRecord
        {
            Id = Guid.NewGuid(),
            ConferenceId = conference.Uuid,
            DelegateId = delegateUser.Uuid,
            CreatedAt = now,
            UpdatedAt = now,
            CreatedBy = requester.Uuid,
            UpdatedBy = requester.Uuid
        };

        await UpsertRecordValuesAsync(record, conference.Uuid, request, ct);
        _db.DelegateAttrRecords.Add(record);
        await _db.SaveChangesAsync(ct);

        var configs = await GetConfigsAsync(conference.Uuid, ct);
        var visibleConfigs = configs.Where(c => c.Visible).ToList();
        return await MapSingleRecordAsync(record, visibleConfigs, delegateUser.Name, ct);
    }

    public async Task<DelegateAttrRecordResponse> UpdateRecordForDelegateAsync(
        Guid requesterUuid,
        Guid delegateId,
        Guid recordId,
        DelegateAttrRecordUpsertRequest request,
        CancellationToken ct = default)
    {
        var requester = await GetUserAsync(requesterUuid, ct);
        RequireManageRole(requester);
        var conferenceUuid = requester.Conference?.Uuid
            ?? throw new InvalidOperationException("User not associated with any conference");

        var record = await _db.DelegateAttrRecords
            .Include(r => r.DelegateAttrValues)
            .Include(r => r.Delegate)
            .FirstOrDefaultAsync(r => r.Id == recordId && r.DelegateId == delegateId && r.ConferenceId == conferenceUuid, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Record not found: {recordId}");

        await UpsertRecordValuesAsync(record, conferenceUuid, request, ct);
        record.UpdatedAt = NowUtc();
        record.UpdatedBy = requester.Uuid;
        await _db.SaveChangesAsync(ct);

        var configs = await GetConfigsAsync(conferenceUuid, ct);
        var visibleConfigs = configs.Where(c => c.Visible).ToList();
        return await MapSingleRecordAsync(record, visibleConfigs, record.Delegate?.Name ?? string.Empty, ct);
    }

    public async Task DeleteRecordForDelegateAsync(
        Guid requesterUuid,
        Guid delegateId,
        Guid recordId,
        CancellationToken ct = default)
    {
        var requester = await GetUserAsync(requesterUuid, ct);
        RequireManageRole(requester);
        var conferenceUuid = requester.Conference?.Uuid
            ?? throw new InvalidOperationException("User not associated with any conference");

        var record = await _db.DelegateAttrRecords
            .FirstOrDefaultAsync(r => r.Id == recordId && r.DelegateId == delegateId && r.ConferenceId == conferenceUuid, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Record not found: {recordId}");

        var values = await _db.DelegateAttrValues.Where(v => v.RecordId == record.Id).ToListAsync(ct);
        _db.DelegateAttrValues.RemoveRange(values);
        _db.DelegateAttrRecords.Remove(record);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<DelegateAttrRecordPageResponse> QueryForManagementAsync(
        Guid requesterUuid,
        DelegateAttrManageQueryRequest request,
        PageInput pageInput,
        CancellationToken ct = default)
    {
        var requester = await GetUserAsync(requesterUuid, ct);
        RequireManageRole(requester);
        var conferenceUuid = requester.Conference?.Uuid
            ?? throw new InvalidOperationException("User not associated with any conference");

        var configs = await GetConfigsAsync(conferenceUuid, ct);
        var visibleConfigs = configs.Where(c => c.Visible).ToList();
        var configByKey = configs.ToDictionary(c => c.AttrKey);

        var filters = request.AttrFilters ?? new List<DelegateAttrFilterItem>();
        var delegateUuids = (request.DelegateIds ?? new List<string>()).Select(Guid.Parse).ToHashSet();
        ValidateFilters(filters, configByKey);

        IQueryable<DelegateAttrRecord> query = _db.DelegateAttrRecords
            .AsNoTracking()
            .Include(r => r.Delegate)
            .Where(r => r.ConferenceId == conferenceUuid);

        if (delegateUuids.Count > 0)
        {
            query = query.Where(r => delegateUuids.Contains(r.DelegateId));
        }

        foreach (var filter in filters)
        {
            var config = configByKey[filter.AttrKey];
            if (config.AttrType == DelegateAttrType.TEXT)
            {
                var textValue = filter.TextValue;
                query = query.Where(r => r.DelegateAttrValues.Any(v =>
                    v.AttrConfig.AttrKey == filter.AttrKey && v.ValueText == textValue));
            }
            else
            {
                var numberValue = filter.NumberValue;
                query = query.Where(r => r.DelegateAttrValues.Any(v =>
                    v.AttrConfig.AttrKey == filter.AttrKey && v.ValueNumber == numberValue));
            }
        }

        var page = await query.ToPageAsync(WithDefaultSort(pageInput), ct);
        var records = await MapRecordPageAsync(page, visibleConfigs, ct);

        return new DelegateAttrRecordPageResponse(visibleConfigs.Select(ToResponse).ToList(), records);
    }

    private async Task UpsertRecordValuesAsync(
        DelegateAttrRecord record,
        Guid conferenceUuid,
        DelegateAttrRecordUpsertRequest request,
        CancellationToken ct)
    {
        var enabledConfigs = await _db.DelegateAttrConfigs
            .Where(c => c.ConferenceId == conferenceUuid && c.Enabled)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Id)
            .ToListAsync(ct);

        var enabledByKey = new Dictionary<string, DelegateAttrConfig>();
        foreach (var config in enabledConfigs)
        {
            enabledByKey.TryAdd(config.AttrKey, config);
        }

        var requestByKey = new Dictionary<string, DelegateAttrValueInput>();
        foreach (var item in request.Values)
        {
            if (item.AttrKey == null)
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Unknown or disabled attrKey");
            }

            if (requestByKey.ContainsKey(item.AttrKey))
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Duplicate attrKey in request: {item.AttrKey}");
            }

            requestByKey.Add(item.AttrKey, item);
        }

        foreach (var (attrKey, input) in requestByKey)
        {
            if (!enabledByKey.TryGetValue(attrKey, out var config))
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Unknown or disabled attrKey: {attrKey}");
            }

            ValidateInputByType(input.TextValue, input.NumberValue, config.AttrType, attrKey);
        }

        var targetConfigIds = enabledConfigs.Select(c => c.Id).ToHashSet();
        var requestedConfigIds = requestByKey.Keys.Select(key => enabledByKey[key].Id).ToHashSet();

        var removedValues = new List<DelegateAttrValue>();
        foreach (var value in record.DelegateAttrValues.ToList())
        {
            if (targetConfigIds.Contains(value.AttrConfigId) && !requestedConfigIds.Contains(value.AttrConfigId))
            {
                removedValues.Add(value);
                record.DelegateAttrValues.Remove(value);
            }
        }

        if (removedValues.Count > 0)
        {
            _db.DelegateAttrValues.RemoveRange(removedValues);
        }

        var existingByConfigId = record.DelegateAttrValues
            .GroupBy(v => v.AttrConfigId)
            .ToDictionary(g => g.Key, g => g.First());

        foreach (var (attrKey, input) in requestByKey)
        {
            var config = enabledByKey[attrKey];
            var configId = config.Id;
            if (existingByConfigId.TryGetValue(configId, out var existing))
            {
                existing.ValueText = config.AttrType == DelegateAttrType.TEXT ? input.TextValue : null;
                existing.ValueNumber = config.AttrType == DelegateAttrType.NUMBER ? input.NumberValue : null;
            }
            else
            {
                record.DelegateAttrValues.Add(new DelegateAttrValue
                {
                    Id = Guid.NewGuid(),
                    RecordId = record.Id,
                    AttrConfigId = configId,
                    ValueText = config.AttrType == DelegateAttrType.TEXT ? input.TextValue : null,
                    ValueNumber = config.AttrType == DelegateAttrType.NUMBER ? input.NumberValue : null
                });
            }
        }
    }

    private async Task<Page<DelegateAttrRecordResponse>> MapRecordPageAsync(
        Page<DelegateAttrRecord> page,
        List<DelegateAttrConfig> configs,
        CancellationToken ct)
    {
        if (page.Content.Count == 0)
        {
            return Page<DelegateAttrRecordResponse>.Of(new List<DelegateAttrRecordResponse>(), page.Number, page.Size, page.TotalElements);
        }

        var recordIds = page.Content.Select(r => r.Id).ToList();
        var values = await _db.DelegateAttrValues
            .AsNoTracking()
            .Include(v => v.AttrConfig)
            .Where(v => recordIds.Contains(v.RecordId))
            .ToListAsync(ct);

        var valuesByRecordId = values
            .GroupBy(v => v.RecordId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var content = page.Content.Select(record =>
        {
            var recordValues = valuesByRecordId.TryGetValue(record.Id, out var list)
                ? list
                : new List<DelegateAttrValue>();

            return new DelegateAttrRecordResponse(
                record.Id.ToString("D"),
                record.DelegateId.ToString("D"),
                record.Delegate?.Name ?? string.Empty,
                record.UpdatedAt,
                BuildValuesMap(configs, recordValues));
        }).ToList();

        return Page<DelegateAttrRecordResponse>.Of(content, page.Number, page.Size, page.TotalElements);
    }

    private async Task<DelegateAttrRecordResponse> MapSingleRecordAsync(
        DelegateAttrRecord record,
        List<DelegateAttrConfig> configs,
        string delegateName,
        CancellationToken ct)
    {
        var values = await _db.DelegateAttrValues
            .AsNoTracking()
            .Include(v => v.AttrConfig)
            .Where(v => v.RecordId == record.Id)
            .ToListAsync(ct);

        return new DelegateAttrRecordResponse(
            record.Id.ToString("D"),
            record.DelegateId.ToString("D"),
            delegateName,
            record.UpdatedAt,
            BuildValuesMap(configs, values));
    }

    private static Dictionary<string, DelegateAttrTypedValueResponse?> BuildValuesMap(
        List<DelegateAttrConfig> configs,
        IEnumerable<DelegateAttrValue> values)
    {
        var map = new Dictionary<string, DelegateAttrTypedValueResponse?>();
        foreach (var config in configs)
        {
            map[config.AttrKey] = null;
        }

        foreach (var value in values)
        {
            map[value.AttrConfig.AttrKey] = new DelegateAttrTypedValueResponse(
                value.AttrConfig.AttrType,
                value.ValueText,
                value.ValueNumber);
        }

        return map;
    }

    private async Task<List<DelegateAttrConfig>> GetConfigsAsync(Guid conferenceUuid, CancellationToken ct)
    {
        return await _db.DelegateAttrConfigs
            .AsNoTracking()
            .Where(c => c.ConferenceId == conferenceUuid)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Id)
            .ToListAsync(ct);
    }

    private async Task<User> GetUserAsync(Guid uuid, CancellationToken ct)
    {
        return await _db.Users
            .AsNoTracking()
            .Include(u => u.Conference)
            .FirstOrDefaultAsync(u => u.Uuid == uuid, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"User not found: {uuid}");
    }

    private async Task<User> GetDelegateAsync(Guid uuid, CancellationToken ct)
    {
        var user = await GetUserAsync(uuid, ct);
        if (user.Role != UserRole.DELEGATE)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Target user is not DELEGATE: {uuid}");
        }

        return user;
    }

    private static void ValidateAttrKey(string attrKey)
    {
        if (string.IsNullOrWhiteSpace(attrKey))
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "attrKey must not be blank");
        }

        if (!AttrKeyRegex.IsMatch(attrKey))
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "attrKey format invalid. expected: ^[a-zA-Z][a-zA-Z0-9_]{1,79}$");
        }
    }

    private static void ValidateInputByType(string? textValue, decimal? numberValue, DelegateAttrType type, string attrKey)
    {
        if (type == DelegateAttrType.TEXT)
        {
            if (textValue == null)
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Attr '{attrKey}' requires textValue");
            }

            if (numberValue != null)
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Attr '{attrKey}' is TEXT, numberValue must be null");
            }
        }
        else
        {
            if (numberValue == null)
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Attr '{attrKey}' requires numberValue");
            }

            if (textValue != null)
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Attr '{attrKey}' is NUMBER, textValue must be null");
            }
        }
    }

    private static void ValidateFilters(List<DelegateAttrFilterItem>? filters, Dictionary<string, DelegateAttrConfig> configByKey)
    {
        foreach (var filter in filters ?? new List<DelegateAttrFilterItem>())
        {
            if (filter.AttrKey == null || !configByKey.TryGetValue(filter.AttrKey, out var config))
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Unknown attrKey: {filter.AttrKey}");
            }

            ValidateInputByType(filter.TextValue, filter.NumberValue, config.AttrType, filter.AttrKey);
        }
    }

    private static void RequireManageRole(User user)
    {
        if (!WriteRoles.Contains(user.Role))
        {
            throw new ForbiddenException("Permission denied");
        }
    }

    private static void EnsureSameConference(Guid? targetConferenceUuid, Guid? conferenceUuid)
    {
        if (targetConferenceUuid == null || conferenceUuid == null || targetConferenceUuid.Value != conferenceUuid.Value)
        {
            throw new ForbiddenException("Cross-conference access denied");
        }
    }

    private static PageInput WithDefaultSort(PageInput pageInput)
    {
        return pageInput.Sort.Count == 0
            ? new PageInput
            {
                Page = pageInput.Page,
                Size = pageInput.Size,
                Sort = new List<SortSpec> { new("UpdatedAt", true) }
            }
            : pageInput;
    }

    private static DateTime NowUtc()
    {
        return DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);
    }

    private static DelegateAttrConfigResponse ToResponse(DelegateAttrConfig config)
    {
        return new DelegateAttrConfigResponse(
            config.Id.ToString("D"),
            config.AttrKey,
            config.AttrLabel,
            config.AttrType,
            config.SortOrder,
            config.Enabled,
            config.Visible);
    }
}