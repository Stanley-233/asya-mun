using System.Globalization;
using AsyaMun.Api.Data;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Errors;
using AsyaMun.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AsyaMun.Api.Services;

public class InstructionService
{
    private const string GameTimeFormat = "yyyy-MM-ddTHH:mm:ss";

    private readonly AppDbContext _db;
    private readonly NotificationService _notificationService;

    public InstructionService(AppDbContext db, NotificationService notificationService)
    {
        _db = db;
        _notificationService = notificationService;
    }

    public async Task<InstructionResponse> CreateInstructionAsync(User submitter, InstructionCreateRequest request)
    {
        if (submitter.Role != UserRole.DELEGATE)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Only DELEGATE can submit instruction");
        }

        var conferenceId = submitter.ConferenceId
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Submitter not associated with any conference");

        var conference = await _db.Conferences.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Uuid == conferenceId)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Conference not found: {conferenceId}");

        if (conference.InstructionSubmissionPaused)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Instruction submission is paused");
        }

        var submitRealTime = NowUtc();
        var submitGameTime = await GetCurrentGameTimeAsync(conferenceId)
            ?? submitRealTime.ToString(GameTimeFormat, CultureInfo.InvariantCulture);

        var instruction = new Instruction
        {
            Uuid = Guid.NewGuid(),
            ConferenceId = conferenceId,
            SubmitterId = submitter.Uuid,
            Title = request.Title,
            InstructionType = request.InstructionType,
            InstructionContent = request.Content,
            Status = InstructionStatus.SUBMITTED,
            SubmitRealTime = submitRealTime,
            SubmitGameTime = submitGameTime
        };

        await using var transaction = await _db.Database.BeginTransactionAsync();

        _db.Instructions.Add(instruction);
        await _db.SaveChangesAsync();
        await transaction.CommitAsync();

        var persisted = await _db.Instructions.AsNoTracking()
            .Include(i => i.Submitter)
            .Include(i => i.ReviewedByNavigation)
            .FirstAsync(i => i.Uuid == instruction.Uuid);

        return ToResponse(persisted);
    }

    public async Task<Page<InstructionResponse>> GetMyInstructionsAsync(
        User submitter,
        PageInput pageInput,
        InstructionStatus? status,
        string? keyword,
        CancellationToken ct = default)
    {
        IQueryable<Instruction> query = _db.Instructions.AsNoTracking()
            .Include(i => i.Submitter)
            .Include(i => i.ReviewedByNavigation)
            .Where(i => i.SubmitterId == submitter.Uuid);

        if (status.HasValue)
        {
            query = query.Where(i => i.Status == status.Value);
        }

        query = ApplyInstructionKeyword(query, keyword);

        var page = await query.ToPageAsync(ApplyDefaultInstructionSort(pageInput), ct);
        return Page<InstructionResponse>.Of(
            page.Content.Select(ToResponse).ToList(),
            page.Number,
            page.Size,
            page.TotalElements);
    }

    public async Task<InstructionResponse> GetInstructionAsync(Guid uuid, User requester, CancellationToken ct = default)
    {
        var instruction = await _db.Instructions.AsNoTracking()
            .Include(i => i.Submitter)
            .Include(i => i.ReviewedByNavigation)
            .FirstOrDefaultAsync(i => i.Uuid == uuid, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Instruction not found: {uuid}");

        EnsureSameConference(requester, instruction);

        var isPrivileged = requester.Role is (UserRole.DH or UserRole.DM or UserRole.SYS_ADMIN);
        var isOwner = instruction.SubmitterId == requester.Uuid;
        if (!isPrivileged && !isOwner)
        {
            throw new ForbiddenException("Access denied");
        }

        return ToResponse(instruction);
    }

    public async Task<Page<InstructionResponse>> QueryInstructionsForManagementAsync(
        User requester,
        PageInput pageInput,
        InstructionStatus? status,
        InstructionType? instructionType,
        long? userGroupId,
        IReadOnlyList<Guid>? submitterUuids,
        string? keyword,
        CancellationToken ct = default)
    {
        if (requester.Role is not (UserRole.DH or UserRole.DM or UserRole.SYS_ADMIN))
        {
            throw new ForbiddenException("Permission denied");
        }

        var conferenceId = requester.ConferenceId
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "User not associated with any conference");

        IQueryable<Instruction> query = _db.Instructions.AsNoTracking()
            .Include(i => i.Submitter)
            .Include(i => i.ReviewedByNavigation)
            .Where(i => i.ConferenceId == conferenceId);

        if (status.HasValue)
        {
            query = query.Where(i => i.Status == status.Value);
        }

        if (instructionType.HasValue)
        {
            query = query.Where(i => i.InstructionType == instructionType.Value);
        }

        if (userGroupId.HasValue)
        {
            var groupId = userGroupId.Value;
            query = query.Where(i => i.Submitter.Groups.Any(g => g.Id == groupId));
        }

        var normalizedSubmitters = submitterUuids?.ToHashSet().Where(id => id != Guid.Empty).ToList();
        if (normalizedSubmitters != null && normalizedSubmitters.Count > 0)
        {
            query = query.Where(i => normalizedSubmitters.Contains(i.SubmitterId));
        }

        query = ApplyInstructionKeyword(query, keyword);

        var page = await query.ToPageAsync(ApplyDefaultInstructionSort(pageInput), ct);
        return Page<InstructionResponse>.Of(
            page.Content.Select(ToResponse).ToList(),
            page.Number,
            page.Size,
            page.TotalElements);
    }

    public async Task<InstructionResponse> ReviewInstructionAsync(Guid uuid, User reviewer, InstructionReviewRequest request)
    {
        if (reviewer.Role is not (UserRole.DH or UserRole.DM or UserRole.SYS_ADMIN))
        {
            throw new ForbiddenException("Permission denied");
        }

        if (request.Status == InstructionStatus.SUBMITTED)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Review target status cannot be SUBMITTED");
        }

        var instruction = await _db.Instructions
            .Include(i => i.Submitter)
            .Include(i => i.ReviewedByNavigation)
            .FirstOrDefaultAsync(i => i.Uuid == uuid)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Instruction not found: {uuid}");

        EnsureSameConference(reviewer, instruction);

        var reviewRealTime = NowUtc();
        var reviewGameTime = await GetCurrentGameTimeAsync(instruction.ConferenceId)
            ?? reviewRealTime.ToString(GameTimeFormat, CultureInfo.InvariantCulture);

        await using var transaction = await _db.Database.BeginTransactionAsync();

        instruction.Status = request.Status;
        instruction.ReviewComment = request.ReviewComment;
        instruction.ReviewedBy = reviewer.Uuid;
        instruction.ReviewedRealTime = reviewRealTime;
        instruction.ReviewedGameTime = reviewGameTime;

        await _db.SaveChangesAsync();
        await transaction.CommitAsync();

        var persisted = await _db.Instructions.AsNoTracking()
            .Include(i => i.Submitter)
            .Include(i => i.ReviewedByNavigation)
            .FirstAsync(i => i.Uuid == instruction.Uuid);

        if (request.Status == InstructionStatus.FEEDBACKED)
        {
            await _notificationService.NotifyInstructionFeedbackAsync(persisted);
        }

        return ToResponse(persisted);
    }

    public async Task<bool> SetInstructionSubmissionPausedAsync(Guid conferenceId, bool paused, CancellationToken ct = default)
    {
        var conference = await _db.Conferences.FirstOrDefaultAsync(c => c.Uuid == conferenceId, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Conference not found: {conferenceId}");

        await using var transaction = await _db.Database.BeginTransactionAsync(ct);

        conference.InstructionSubmissionPaused = paused;
        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return conference.InstructionSubmissionPaused;
    }

    public async Task<bool> IsInstructionSubmissionPausedAsync(Guid conferenceId, CancellationToken ct = default)
    {
        var conference = await _db.Conferences.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Uuid == conferenceId, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Conference not found: {conferenceId}");

        return conference.InstructionSubmissionPaused;
    }

    private async Task<string?> GetCurrentGameTimeAsync(Guid conferenceId, CancellationToken ct = default)
    {
        var anchor = await _db.TimeAnchors.AsNoTracking()
            .Where(t => t.ConferenceId == conferenceId && t.IsCurrent)
            .OrderByDescending(t => t.Id)
            .FirstOrDefaultAsync(ct);

        if (anchor == null)
        {
            anchor = await _db.TimeAnchors.AsNoTracking()
                .Where(t => t.ConferenceId == conferenceId)
                .OrderByDescending(t => t.Id)
                .FirstOrDefaultAsync(ct);
        }

        if (anchor?.AnchorGameTime == null)
        {
            return null;
        }

        var ratio = anchor.TimeRatio;
        if (!ratio.HasValue || ratio.Value == 0 || anchor.AnchorRealTime == null ||
            !DateTime.TryParse(anchor.AnchorGameTime, CultureInfo.InvariantCulture, DateTimeStyles.None, out var baseGameTime))
        {
            return anchor.AnchorGameTime;
        }

        var elapsedSeconds = (long)(NowUtc() - anchor.AnchorRealTime.Value).TotalSeconds;
        var gameSeconds = (long)(elapsedSeconds * (double)ratio.Value);

        return FormatGameTime(baseGameTime.AddSeconds(gameSeconds));
    }

    private static IQueryable<Instruction> ApplyInstructionKeyword(IQueryable<Instruction> query, string? keyword)
    {
        var normalized = keyword?.Trim();
        if (string.IsNullOrEmpty(normalized))
        {
            return query;
        }

        var kw = normalized.ToLowerInvariant();
        return query.Where(i =>
            i.Title.ToLower().Contains(kw) ||
            i.InstructionContent.ToLower().Contains(kw));
    }

    private static PageInput ApplyDefaultInstructionSort(PageInput input)
    {
        return input.Sort.Count == 0
            ? new PageInput
            {
                Page = input.Page,
                Size = input.Size,
                Sort = new List<SortSpec>
                {
                    new("SubmitRealTime", true),
                    new("Uuid", true)
                }
            }
            : input;
    }

    private static void EnsureSameConference(User user, Instruction instruction)
    {
        if (user.ConferenceId == null || user.ConferenceId != instruction.ConferenceId)
        {
            throw new ForbiddenException("Access denied");
        }
    }

    private static InstructionResponse ToResponse(Instruction instruction)
    {
        return new InstructionResponse(
            instruction.Uuid.ToString("D"),
            instruction.ConferenceId.ToString("D"),
            instruction.SubmitterId.ToString("D"),
            instruction.Submitter.Name,
            instruction.Title,
            instruction.InstructionType,
            instruction.InstructionContent,
            instruction.Status,
            instruction.ReviewComment,
            instruction.SubmitRealTime,
            instruction.SubmitGameTime,
            instruction.ReviewedBy?.ToString("D"),
            instruction.ReviewedByNavigation?.Name,
            instruction.ReviewedRealTime,
            instruction.ReviewedGameTime);
    }

    private static DateTime NowUtc()
    {
        return DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);
    }

    private static string FormatGameTime(DateTime time)
    {
        var baseValue = time.ToString("yyyy-MM-ddTHH:mm", CultureInfo.InvariantCulture);
        if (time.Second == 0 && time.Millisecond == 0)
        {
            return baseValue;
        }

        if (time.Millisecond == 0)
        {
            return baseValue + ":" + time.Second.ToString("00", CultureInfo.InvariantCulture);
        }

        var fraction = time.Millisecond.ToString("fff", CultureInfo.InvariantCulture).TrimEnd('0');
        return baseValue + ":" + time.Second.ToString("00", CultureInfo.InvariantCulture) + "." + fraction;
    }
}