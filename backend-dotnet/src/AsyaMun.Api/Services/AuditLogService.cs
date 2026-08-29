using AsyaMun.Api.Data;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AsyaMun.Api.Services;

public class AuditLogService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly AppDbContext _db;
    private readonly ILogger<AuditLogService> _logger;

    public AuditLogService(
        IServiceScopeFactory scopeFactory,
        AppDbContext db,
        ILogger<AuditLogService> logger)
    {
        _scopeFactory = scopeFactory;
        _db = db;
        _logger = logger;
    }

    public async Task SaveAsync(
        Guid? actorUuid,
        string? actorName,
        string? actorIp,
        string? requestMethod,
        string? requestPath,
        string? requestQuery,
        string? userAgent,
        AuditActionType actionType,
        string? resourceType,
        string? resourceId,
        string eventContent,
        string? contextData,
        bool success)
    {
        try
        {
            await PersistAsync(
                actorUuid, actorName, actorIp, requestMethod, requestPath, requestQuery,
                userAgent, actionType, resourceType, resourceId, eventContent, contextData, success);
        }
        catch (Exception ex)
        {
            var fallbackType = FallbackType(actionType);
            if (!fallbackType.HasValue)
            {
                _logger.LogError(ex,
                    "Failed to persist audit log, type={ActionType}, actorName={ActorName}, actorIp={ActorIp}",
                    actionType, actorName, actorIp);
                return;
            }

            _logger.LogWarning(
                "Audit log type {ActionType} rejected by database constraint, retrying with fallback type {Fallback}",
                actionType, fallbackType.Value);

            try
            {
                await PersistAsync(
                    actorUuid, actorName, actorIp, requestMethod, requestPath, requestQuery,
                    userAgent, fallbackType.Value, resourceType, resourceId,
                    $"[fallbackFrom={actionType}] {eventContent}", contextData, success);
            }
            catch (Exception ex2)
            {
                _logger.LogError(ex2,
                    "Failed to persist audit log after fallback, type={ActionType}, actorName={ActorName}",
                    fallbackType.Value, actorName);
            }
        }
    }

    private async Task PersistAsync(
        Guid? actorUuid,
        string? actorName,
        string? actorIp,
        string? requestMethod,
        string? requestPath,
        string? requestQuery,
        string? userAgent,
        AuditActionType actionType,
        string? resourceType,
        string? resourceId,
        string eventContent,
        string? contextData,
        bool success)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        context.AuditLogs.Add(new AuditLog
        {
            EventTime = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified),
            ActorUuid = actorUuid,
            ActorName = actorName,
            ActorIp = actorIp,
            RequestMethod = requestMethod,
            RequestPath = requestPath,
            RequestQuery = requestQuery,
            UserAgent = userAgent,
            ActionType = actionType,
            ResourceType = resourceType,
            ResourceId = resourceId,
            EventContent = eventContent,
            ContextData = contextData,
            Success = success
        });

        await context.SaveChangesAsync();
    }

    public async Task<Page<AuditLogResponse>> GetAuditLogsAsync(
        PageInput pageInput,
        string? actorName,
        AuditActionType? actionType,
        bool? success,
        string? ip,
        DateTime? eventTimeFrom,
        DateTime? eventTimeTo,
        CancellationToken ct = default)
    {
        var query = _db.AuditLogs.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(actorName))
        {
            var keyword = actorName.Trim().ToLower();
            query = query.Where(l => l.ActorName != null && l.ActorName.ToLower().Contains(keyword));
        }

        if (actionType.HasValue)
        {
            query = query.Where(l => l.ActionType == actionType.Value);
        }

        if (success.HasValue)
        {
            query = query.Where(l => l.Success == success.Value);
        }

        if (!string.IsNullOrWhiteSpace(ip))
        {
            var keyword = ip.Trim();
            query = query.Where(l => l.ActorIp != null && l.ActorIp.Contains(keyword));
        }

        if (eventTimeFrom.HasValue)
        {
            query = query.Where(l => l.EventTime >= eventTimeFrom.Value);
        }

        if (eventTimeTo.HasValue)
        {
            query = query.Where(l => l.EventTime <= eventTimeTo.Value);
        }

        var page = await query.OrderByDescending(l => l.EventTime).ToPageAsync(pageInput, ct);
        return Page<AuditLogResponse>.Of(
            page.Content.Select(AuditLogResponse.From).ToList(),
            page.Number,
            page.Size,
            page.TotalElements);
    }

    public async Task<AuditLogResponse> GetAuditLogByIdAsync(long id, CancellationToken ct = default)
    {
        var entity = await _db.AuditLogs.AsNoTracking().FirstOrDefaultAsync(l => l.Id == id, ct)
            ?? throw new KeyNotFoundException($"审计日志不存在: id={id}");

        return AuditLogResponse.From(entity);
    }

    private static AuditActionType? FallbackType(AuditActionType actionType)
    {
        return actionType switch
        {
            AuditActionType.INSTRUCTION_CREATE => AuditActionType.MESSAGE_CREATE,
            AuditActionType.INSTRUCTION_REVIEW => AuditActionType.MESSAGE_UPDATE,
            AuditActionType.ROUND_PUBLISH => AuditActionType.TIMELINE_UPDATE,
            AuditActionType.ROUND_PAUSE => AuditActionType.TIMELINE_UPDATE,
            AuditActionType.ROUND_RESUME => AuditActionType.TIMELINE_UPDATE,
            AuditActionType.ROUND_SET_NEXT => AuditActionType.TIMELINE_UPDATE,
            AuditActionType.ROUND_UPDATE => AuditActionType.TIMELINE_UPDATE,
            AuditActionType.ROUND_SET_CURRENT => AuditActionType.TIMELINE_JUMP,
            AuditActionType.ROUND_AUTO_ADVANCE => AuditActionType.TIMELINE_JUMP,
            _ => null
        };
    }
}