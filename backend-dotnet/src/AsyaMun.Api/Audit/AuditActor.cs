namespace AsyaMun.Api.Audit;

public record AuditActor(
    Guid? Uuid,
    string? Name,
    string? Ip,
    string? RequestMethod,
    string? RequestPath,
    string? RequestQuery,
    string? UserAgent);