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

// 始终以 exe 所在目录为 ContentRoot（无论从哪个 CWD 启动，都能找到 wwwroot / appsettings）
if (Environment.ProcessPath is { } exePath)
{
    var exeDir = Path.GetDirectoryName(exePath);
    if (!string.IsNullOrEmpty(exeDir) && Directory.Exists(exeDir))
    {
        Environment.CurrentDirectory = exeDir;
    }
}

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseContentRoot(Environment.CurrentDirectory);

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

// 单进程部署形态：wwwroot 独立文件夹
var webRootPath = Path.Combine(app.Environment.ContentRootPath, "wwwroot");
app.Environment.WebRootPath = webRootPath;
app.Environment.WebRootFileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(webRootPath);

// 前端静态托管：等价 nginx `location / { try_files $uri.html $uri/index.html $uri /index.html; }`。
// 在认证之前处理，命中即短路返回，完全不经过认证/授权，保证与 nginx 静态托管行为一致。
app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value ?? string.Empty;
    var staticFile = context.RequestServices.GetRequiredService<IWebHostEnvironment>().WebRootFileProvider.GetFileInfo(
        path.StartsWith('/') ? path.TrimStart('/') : path);

    // API / WebSocket / Scalar / OpenAPI 等请求不发 || 非 GET：交给后续
    if (!HttpMethods.IsGet(context.Request.Method)
        || path.StartsWith("/api", StringComparison.Ordinal)
        || path.StartsWith("/ws", StringComparison.Ordinal)
        || path.StartsWith("/scalar", StringComparison.Ordinal)
        || path.StartsWith("/openapi", StringComparison.Ordinal)
        || path is "/" or "" or "/_next" or "/_next/")
    {
        await next(context);
        return;
    }

    // 依次尝试：$uri.html -> $uri/index.html -> $uri
    var candidates = new[]
    {
        path.TrimStart('/') + ".html",
        (path.TrimStart('/') + "/index.html").TrimStart('/'),
        path.TrimStart('/'),
    };
    foreach (var candidate in candidates)
    {
        var info = context.RequestServices.GetRequiredService<IWebHostEnvironment>().WebRootFileProvider.GetFileInfo(candidate);
        if (info.Exists && !info.IsDirectory)
        {
            context.Response.ContentType = path.EndsWith(".txt", StringComparison.Ordinal) ? "text/plain"
                : path.EndsWith(".js", StringComparison.Ordinal) ? "application/javascript"
                : path.EndsWith(".css", StringComparison.Ordinal) ? "text/css"
                : path.EndsWith(".json", StringComparison.Ordinal) ? "application/json"
                : path.EndsWith(".png", StringComparison.Ordinal) ? "image/png"
                : path.EndsWith(".svg", StringComparison.Ordinal) ? "image/svg+xml"
                : path.EndsWith(".ico", StringComparison.Ordinal) ? "image/x-icon"
                : "text/html";
            context.Response.Headers.CacheControl = path.StartsWith("/_next", StringComparison.Ordinal)
                ? "public, max-age=31536000, immutable"
                : "no-store";
            await context.Response.SendFileAsync(info, context.RequestAborted);
            return;
        }
    }
    
    var fallback = context.RequestServices.GetRequiredService<IWebHostEnvironment>().WebRootFileProvider.GetFileInfo("index.html");
    if (fallback.Exists && !fallback.IsDirectory)
    {
        context.Response.ContentType = "text/html";
        context.Response.Headers.CacheControl = "no-store";
        await context.Response.SendFileAsync(fallback, context.RequestAborted);
        return;
    }

    await next(context);
});

app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi();
app.MapScalarApiReference(options => options
    .WithTitle("AsyaMun API")
    .ForceDarkMode());

app.MapControllers();
app.MapHub<NotificationHub>("/ws");

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