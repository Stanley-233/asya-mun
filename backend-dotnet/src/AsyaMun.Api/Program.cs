using System.Text.Json.Serialization;
using AsyaMun.Api.Audit;
using AsyaMun.Api.Auth;
using AsyaMun.Api.Background;
using AsyaMun.Api.Data;
using AsyaMun.Api.Hubs;
using AsyaMun.Api.Middleware;
using AsyaMun.Api.Models;
using AsyaMun.Api.Services;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

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
    else
    {
        db.Database.Migrate();
    }
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

app.Run();