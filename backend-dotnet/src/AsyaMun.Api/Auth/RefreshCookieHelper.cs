using Microsoft.AspNetCore.Http;

namespace AsyaMun.Api.Auth;

public static class RefreshCookieHelper
{
    public const string CookieName = "asya_refresh_token";

    private static readonly TimeSpan MaxAge = TimeSpan.FromDays(30);

    public static void Append(HttpContext context, string refreshToken)
    {
        context.Response.Cookies.Append(CookieName, refreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = IsSecureRequest(context),
            SameSite = SameSiteMode.Lax,
            Path = "/api/users",
            MaxAge = MaxAge
        });
    }

    public static void Clear(HttpContext context)
    {
        context.Response.Cookies.Append(CookieName, string.Empty, new CookieOptions
        {
            HttpOnly = true,
            Secure = IsSecureRequest(context),
            SameSite = SameSiteMode.Lax,
            Path = "/api/users",
            Expires = DateTimeOffset.UnixEpoch
        });
    }

    public static string? Read(HttpContext context)
    {
        return context.Request.Cookies[CookieName];
    }

    private static bool IsSecureRequest(HttpContext context)
    {
        return context.Request.IsHttps
            || string.Equals(
                context.Request.Headers["X-Forwarded-Proto"].ToString(),
                "https",
                StringComparison.OrdinalIgnoreCase);
    }
}

public static class BearerHeaderExtensions
{
    public static void WriteBearer(this HttpResponse response, string token)
    {
        response.Headers.Authorization = $"Bearer {token}";
    }
}