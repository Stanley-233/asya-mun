using System.Text.Json.Serialization;
using AsyaMun.Api.Audit;
using AsyaMun.Api.Auth;
using AsyaMun.Api.Background;
using AsyaMun.Api.Data;
using AsyaMun.Api.Hubs;
using AsyaMun.Api.Middleware;
using AsyaMun.Api.Models;
using AsyaMun.Api.Services;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

LoadEnvironmentFileIfPresent();

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers(options =>
    {
        options.Filters.Add<AuditActionFilter>();
    })
    .ConfigureApiBehaviorOptions(options =>
    {
        options.SuppressModelStateInvalidFilter = true;
    })
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddOpenApi();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"), o =>
    {
        var nameTranslator = EnumNameTranslator.Instance;
        o.MapEnum<AttachmentTargetType>("attachmenttargettype", "public", nameTranslator);
        o.MapEnum<AuditActionType>("auditactiontype", "public", nameTranslator);
        o.MapEnum<ConferenceStatus>("conferencestatus", "public", nameTranslator);
        o.MapEnum<DelegateAttrType>("delegateattrtype", "public", nameTranslator);
        o.MapEnum<InstructionStatus>("instructionstatus", "public", nameTranslator);
        o.MapEnum<InstructionType>("instructiontype", "public", nameTranslator);
        o.MapEnum<MessageType>("messagetype", "public", nameTranslator);
        o.MapEnum<RoundStatus>("roundstatus", "public", nameTranslator);
        o.MapEnum<UserRole>("userrole", "public", nameTranslator);
    }));

builder.Services.AddCors(options =>
{
    options.AddPolicy("asya", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
            {
                var uri = new Uri(origin);
                var host = uri.Host.Trim('[', ']');
                if (host == "localhost" || host == "127.0.0.1" || host == "::1")
                {
                    return true;
                }

                return origin.Equals("https://mun.bearingwall.top", StringComparison.OrdinalIgnoreCase);
            })
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

builder.Services.AddAsyaAuthentication();
builder.Services.AddAuthorization();

builder.Services.AddSignalR(options =>
    {
        options.EnableDetailedErrors = true;
        options.KeepAliveInterval = TimeSpan.FromSeconds(15);
        options.ClientTimeoutInterval = TimeSpan.FromSeconds(60);
    })
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddScoped<AuditLogService>();
builder.Services.AddScoped<SystemConfigService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<ConferenceService>();
builder.Services.AddScoped<UserGroupService>();
builder.Services.AddScoped<RoundService>();
builder.Services.AddScoped<TimeService>();
builder.Services.AddScoped<MessageService>();
builder.Services.AddScoped<InstructionService>();
builder.Services.AddScoped<AttachmentService>();
builder.Services.AddScoped<AnnouncementService>();
builder.Services.AddScoped<DelegateAttrService>();
builder.Services.AddScoped<NotificationService>();
builder.Services.AddScoped<TestDataService>();

builder.Services.AddHostedService<RoundAutoAdvanceHostedService>();
builder.Services.AddHostedService<SecretMessageNotificationHostedService>();

var app = builder.Build();

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var hasSchema = db.Database
        .SqlQueryRaw<bool>(
            "select exists(select 1 from pg_tables where schemaname='public' and tablename='conferences') as \"Value\"")
        .Single();

    if (hasSchema)
    {
        // 兼容既有 Flyway schema：将 EF 首个迁移标记为已应用，避免重复建表
        db.Database.ExecuteSqlRaw("""
            create table if not exists "__EFMigrationsHistory" (
                "MigrationId" varchar(150) not null constraint "PK___EFMigrationsHistory" primary key,
                "ProductVersion" varchar(32) not null
            );
            insert into "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
            values ('20260822154119_InitialCreate', '10.0.11')
            on conflict do nothing;
            """);
    }
    db.Database.Migrate();
}

app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseHttpsRedirection();

app.UseCors("asya");

app.UseMiddleware<AuditContextMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi();
app.MapScalarApiReference(options => options
    .WithTitle("AsyaMun API")
    .ForceDarkMode());

app.MapControllers();
app.MapHub<NotificationHub>("/ws");

// 单进程部署：由 ASP.NET 一并托管前端静态产物（Next 静态导出），API/WebSocket 与站点同源。
// 优先级：ASYA_WEBROOT 环境变量 > 仓库内 frontend/out（本地 dotnet run 直接可用） > 默认 wwwroot。
var webRoot = Environment.GetEnvironmentVariable("ASYA_WEBROOT");
if (string.IsNullOrWhiteSpace(webRoot) || !Directory.Exists(webRoot))
{
    var repoFrontendOut = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "..", "..", "frontend", "out"));
    if (Directory.Exists(repoFrontendOut))
    {
        webRoot = repoFrontendOut;
    }
}

if (!string.IsNullOrWhiteSpace(webRoot))
{
    app.Environment.WebRootPath = webRoot;
}

app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = staticFile =>
    {
        var response = staticFile.Context.Response;
        var isHashedAsset = staticFile.Context.Request.Path.StartsWithSegments("/_next/static");
        response.Headers.CacheControl = isHashedAsset
            ? "public, max-age=31536000, immutable"
            : "no-store";
    }
});

// SPA 回退：Swagger/API/WS 之外的非文件路径一律返回 index.html
app.MapFallbackToFile("index.html");

app.Run();
return;

static void LoadEnvironmentFileIfPresent()
{
    var candidates = new[]
        {
            Environment.GetEnvironmentVariable("ASYA_ENV_FILE"),
            Path.Combine(Environment.CurrentDirectory, ".env"),
            Path.GetDirectoryName(Environment.ProcessPath) is { } dir
                ? Path.Combine(dir, ".env")
                : null,
        }
        .Where(p => !string.IsNullOrWhiteSpace(p))
        .Distinct(StringComparer.OrdinalIgnoreCase);

    var envFilePath = candidates.FirstOrDefault(File.Exists);
    if (envFilePath == null)
    {
        return;
    }

    foreach (var line in File.ReadLines(envFilePath))
    {
        var trimmed = line.Trim();
        if (trimmed.Length == 0 || trimmed.StartsWith('#') || trimmed.StartsWith(';'))
        {
            continue;
        }

        if (trimmed.StartsWith("export ", StringComparison.Ordinal))
        {
            trimmed = trimmed["export ".Length..].TrimStart();
        }

        var eq = trimmed.IndexOf('=');
        if (eq <= 0)
        {
            continue;
        }

        var key = trimmed[..eq].Trim();
        var rawValue = trimmed[(eq + 1)..].Trim();
        if (rawValue.Length >= 2
            && ((rawValue[0] == '"' && rawValue[^1] == '"')
                || (rawValue[0] == '\'' && rawValue[^1] == '\'')))
        {
            rawValue = rawValue[1..^1];
        }

        if (key.Length == 0 || Environment.GetEnvironmentVariable(key) is not null)
        {
            continue;
        }

        Environment.SetEnvironmentVariable(key, rawValue);
    }
}