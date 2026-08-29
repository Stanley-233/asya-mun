using AsyaMun.Api.Models;

namespace AsyaMun.Api.Dtos;

public class AuditLogResponse
{
    public long Id { get; set; }

    public DateTime EventTime { get; set; }

    public string? ActorUuid { get; set; }

    public string? ActorName { get; set; }

    public string? ActorIp { get; set; }

    public string? RequestMethod { get; set; }

    public string? RequestPath { get; set; }

    public string? RequestQuery { get; set; }

    public string? UserAgent { get; set; }

    public AuditActionType ActionType { get; set; }

    public string? ResourceType { get; set; }

    public string? ResourceId { get; set; }

    public string EventContent { get; set; } = string.Empty;

    public string? ContextData { get; set; }

    public bool Success { get; set; }

    public static AuditLogResponse From(AuditLog log)
    {
        return new AuditLogResponse
        {
            Id = log.Id,
            EventTime = log.EventTime,
            ActorUuid = log.ActorUuid?.ToString("D"),
            ActorName = log.ActorName,
            ActorIp = log.ActorIp,
            RequestMethod = log.RequestMethod,
            RequestPath = log.RequestPath,
            RequestQuery = log.RequestQuery,
            UserAgent = log.UserAgent,
            ActionType = log.ActionType,
            ResourceType = log.ResourceType,
            ResourceId = log.ResourceId,
            EventContent = log.EventContent,
            ContextData = log.ContextData,
            Success = log.Success
        };
    }
}