using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AsyaMun.Api.Errors;
using AsyaMun.Api.Models;
using Microsoft.IdentityModel.Tokens;

namespace AsyaMun.Api.Auth;

public static class JwtUtil
{
    private const string DefaultSecret = "asya-backend-jwt-secret-key-change-me-to-at-least-32-chars";
    private const int MinKeyBytes = 32;
    private const long AccessExpirationSeconds = 3600L;
    private const long RefreshExpirationSeconds = 30L * 24 * 60 * 60;
    private const string ClaimType = "type";
    private const string ClaimAuthVersion = "ver";

    private static readonly Lazy<SymmetricSecurityKey> Key = new(BuildKey);

    private static SymmetricSecurityKey BuildKey()
    {
        var configured = Environment.GetEnvironmentVariable("JWT_SECRET");
        if (string.IsNullOrWhiteSpace(configured))
        {
            configured = DefaultSecret;
        }

        var keyBytes = Encoding.UTF8.GetBytes(configured);
        if (keyBytes.Length < MinKeyBytes)
        {
            throw new InvalidOperationException(
                $"JWT secret must be at least {MinKeyBytes} bytes; configure JWT_SECRET env or -Djwt.secret");
        }

        return new SymmetricSecurityKey(keyBytes);
    }

    public static SymmetricSecurityKey GetSigningKey() => Key.Value;

    public static string GenerateAccessToken(string subject, int authVersion, string? name = null, UserRole? role = null)
    {
        var claims = new Dictionary<string, object>
        {
            [ClaimAuthVersion] = authVersion,
            [ClaimType] = TokenType.Access.ClaimValue()
        };

        if (name != null)
        {
            claims["name"] = name;
        }

        if (role != null)
        {
            claims["role"] = role.Value.ToString();
        }

        return GenerateToken(subject, claims, TimeSpan.FromSeconds(AccessExpirationSeconds));
    }

    public static string GenerateRefreshToken(string subject, int authVersion)
    {
        return GenerateToken(
            subject,
            new Dictionary<string, object>
            {
                [ClaimType] = TokenType.Refresh.ClaimValue(),
                [ClaimAuthVersion] = authVersion
            },
            TimeSpan.FromSeconds(RefreshExpirationSeconds));
    }

    private static string GenerateToken(string subject, Dictionary<string, object> claims, TimeSpan lifetime)
    {
        var now = DateTime.UtcNow;
        var securityClaims = new List<Claim> { new(JwtRegisteredClaimNames.Sub, subject) };
        securityClaims.AddRange(claims.Select(kv => new Claim(kv.Key, kv.Value.ToString() ?? string.Empty)));
        securityClaims.Add(new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")));

        var token = new JwtSecurityToken(
            claims: securityClaims,
            notBefore: now,
            expires: now.Add(lifetime),
            signingCredentials: new SigningCredentials(Key.Value, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static ParsedToken ParseToken(string token)
    {
        var handler = new JwtSecurityTokenHandler();
        var validationParameters = new TokenValidationParameters
        {
            IssuerSigningKey = Key.Value,
            ValidateIssuerSigningKey = true,
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero,
            ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 }
        };

        var principal = handler.ValidateToken(token, validationParameters, out var validatedToken);
        var claims = principal.Claims.ToDictionary(c => c.Type, c => (object?)c.Value);
        var subject = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
            ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? throw new InvalidOperationException("Token缺少subject");

        return new ParsedToken(subject, claims);
    }

    public static void RequireTokenType(ParsedToken parsedToken, TokenType expectedType)
    {
        var actualType = parsedToken.Claims.TryGetValue(ClaimType, out var value) ? value?.ToString() : null;
        if (!string.Equals(actualType, expectedType.ClaimValue(), StringComparison.Ordinal))
        {
            throw new TokenInvalidException("Token类型无效");
        }
    }

    public static int GetAuthVersion(ParsedToken parsedToken)
    {
        if (!parsedToken.Claims.TryGetValue(ClaimAuthVersion, out var raw) || raw == null)
        {
            throw new TokenInvalidException("Token缺少认证版本");
        }

        return raw switch
        {
            int i => i,
            long l => (int)l,
            string s when int.TryParse(s, out var v) => v,
            _ => throw new TokenInvalidException("Token认证版本无效")
        };
    }
}

public record ParsedToken(string Subject, Dictionary<string, object?> Claims);

public enum TokenType
{
    Access,
    Refresh
}

public static class TokenTypeExtensions
{
    private const string AccessValue = "access";
    private const string RefreshValue = "refresh";

    public static string ClaimValue(this TokenType type)
    {
        return type switch
        {
            TokenType.Access => AccessValue,
            TokenType.Refresh => RefreshValue,
            _ => throw new ArgumentOutOfRangeException(nameof(type))
        };
    }
}