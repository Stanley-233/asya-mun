namespace AsyaMun.Api.Models;

public class AuditLog
{
    public long Id { get; set; }

    public string? ActorName { get; set; }

    public Guid? ActorUuid { get; set; }

    public string? ActorIp { get; set; }

    public string? RequestMethod { get; set; }

    public string? RequestPath { get; set; }

    public string? RequestQuery { get; set; }

    public string? UserAgent { get; set; }

    public string? ResourceType { get; set; }

    public string? ResourceId { get; set; }

    public AuditActionType ActionType { get; set; }

    public string EventContent { get; set; } = null!;

    public string? ContextData { get; set; }

    public DateTime EventTime { get; set; }

    public bool Success { get; set; }
}