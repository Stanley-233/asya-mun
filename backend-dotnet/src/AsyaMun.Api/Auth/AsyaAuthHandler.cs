using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using AsyaMun.Api.Data;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AsyaMun.Api.Auth;

public class AsyaAuthOptions : AuthenticationSchemeOptions;

public class AsyaAuthHandler : AuthenticationHandler<AsyaAuthOptions>
{
    public const string SchemeName = "Asya";
    public const string CurrentUserItemKey = "AsyaCurrentUser";

    private const string BearerPrefix = "Bearer ";

    private readonly AppDbContext _db;

    public AsyaAuthHandler(
        IOptionsMonitor<AsyaAuthOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        AppDbContext db)
        : base(options, logger, encoder)
    {
        _db = db;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var authorization = Request.Headers.Authorization.ToString();
        string? token = null;

        if (!string.IsNullOrEmpty(authorization) && authorization.StartsWith(BearerPrefix, StringComparison.OrdinalIgnoreCase))
        {
            token = authorization[BearerPrefix.Length..].Trim();
        }
        else if (Request.Query.TryGetValue("access_token", out var tokenValues) && !string.IsNullOrEmpty(tokenValues))
        {
            token = tokenValues.ToString();
        }

        if (string.IsNullOrEmpty(token))
        {
            return AuthenticateResult.NoResult();
        }

        ParsedToken parsed;
        try
        {
            parsed = JwtUtil.ParseToken(token);
        }
        catch (Exception ex)
        {
            return AuthenticateResult.Fail(ex.Message);
        }

        Guid userId;
        try
        {
            JwtUtil.RequireTokenType(parsed, TokenType.Access);
            var authVersion = JwtUtil.GetAuthVersion(parsed);
            userId = Guid.Parse(parsed.Subject);

            var user = await _db.Users
                .AsNoTracking()
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Uuid == userId);

            if (user == null)
            {
                return AuthenticateResult.Fail("用户不存在，Token无效");
            }

            if (user.AuthVersion != authVersion)
            {
                return AuthenticateResult.Fail("Token已失效，请重新登录");
            }

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Uuid.ToString("D")),
                new(ClaimTypes.Name, user.Name ?? string.Empty),
                new(ClaimTypes.Role, user.Role.ToString()),
                new("authVersion", user.AuthVersion.ToString())
            };

            if (user.ConferenceId.HasValue)
            {
                claims.Add(new Claim("conferenceUuid", user.ConferenceId.Value.ToString("D")));
            }

            var identity = new ClaimsIdentity(claims, Scheme.Name);
            var principal = new ClaimsPrincipal(identity);

            Context.Items[CurrentUserItemKey] = user;

            return AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme.Name));
        }
        catch (Exception ex)
        {
            return AuthenticateResult.Fail(ex.Message);
        }
    }

    protected override async Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        Response.ContentType = "application/json; charset=utf-8";
        await Response.WriteAsync(EnvelopeWriter.Write(BizCode.TOKEN_INVALID, "Token无效或已过期，请重新登录"));
    }

    protected override async Task HandleForbiddenAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status403Forbidden;
        Response.ContentType = "application/json; charset=utf-8";
        await Response.WriteAsync(EnvelopeWriter.Write(BizCode.PERMISSION_DENIED, "权限不足"));
    }
}

public static class AsyaAuthExtensions
{
    public static AuthenticationBuilder AddAsyaAuthentication(this IServiceCollection services)
    {
        return services
            .AddAuthentication(AsyaAuthHandler.SchemeName)
            .AddScheme<AsyaAuthOptions, AsyaAuthHandler>(AsyaAuthHandler.SchemeName, _ => { });
    }

    public static bool TryGetCurrentUser(this HttpContext context, out User? user)
    {
        if (context.Items.TryGetValue(AsyaAuthHandler.CurrentUserItemKey, out var value) && value is User u)
        {
            user = u;
            return true;
        }

        user = null;
        return false;
    }

    public static User? GetCurrentUser(this HttpContext context)
    {
        return context.TryGetCurrentUser(out var user) ? user : null;
    }

    public static void SetCurrentUser(this HttpContext context, User user)
    {
        context.Items[AsyaAuthHandler.CurrentUserItemKey] = user;
    }
}

internal static class EnvelopeWriter
{
    public static string Write(BizCode code, string message)
    {
        return JsonSerializer.Serialize(new
        {
            code = (int)code,
            message,
            data = (object?)null
        });
    }
}