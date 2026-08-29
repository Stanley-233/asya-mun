using AsyaMun.Api.Auth;

namespace AsyaMun.Api.Audit;

public class AuditContextMiddleware
{
    public const string ActorItemKey = "AsyaAuditActor";

    private readonly RequestDelegate _next;

    public AuditContextMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var actor = BuildActor(context);
        context.Items[ActorItemKey] = actor;

        try
        {
            await _next(context);
        }
        finally
        {
            context.Items.Remove(ActorItemKey);
        }
    }

    private static AuditActor BuildActor(HttpContext context)
    {
        var request = context.Request;
        var clientIp = ResolveClientIp(context);
        var method = request.Method?.Trim();
        var path = request.Path.Value?.Trim();
        var query = request.QueryString.HasValue ? request.QueryString.Value.Trim('?') : null;
        var userAgent = request.Headers.UserAgent.ToString().Trim();

        Guid? actorUuid = null;
        string? actorName = null;

        var authorization = request.Headers.Authorization.ToString();
        if (!string.IsNullOrEmpty(authorization) && authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var token = authorization["Bearer ".Length..].Trim();
            try
            {
                var parsed = JwtUtil.ParseToken(token);
                if (Guid.TryParse(parsed.Subject, out var id))
                {
                    actorUuid = id;
                }

                actorName = parsed.Claims.TryGetValue("name", out var n) ? n?.ToString() : null;
            }
            catch
            {
                // token 无效时仍保留 IP/请求信息
            }
        }

        return new AuditActor(
            Uuid: actorUuid,
            Name: actorName,
            Ip: clientIp,
            RequestMethod: method,
            RequestPath: path,
            RequestQuery: query,
            UserAgent: userAgent);
    }

    private static string? ResolveClientIp(HttpContext context)
    {
        var xForwardedFor = context.Request.Headers["X-Forwarded-For"].ToString();
        var first = xForwardedFor.Split(',')[0].Trim();
        if (!string.IsNullOrEmpty(first))
        {
            return first;
        }

        var realIp = context.Request.Headers["X-Real-IP"].ToString().Trim();
        if (!string.IsNullOrEmpty(realIp))
        {
            return realIp;
        }

        var remote = context.Connection.RemoteIpAddress?.ToString();
        return string.IsNullOrEmpty(remote) ? null : remote;
    }
}

public static class AuditContextExtensions
{
    public static AuditActor? GetAuditActor(this HttpContext context)
    {
        return context.Items.TryGetValue(AuditContextMiddleware.ActorItemKey, out var value) && value is AuditActor actor
            ? actor
            : null;
    }
}