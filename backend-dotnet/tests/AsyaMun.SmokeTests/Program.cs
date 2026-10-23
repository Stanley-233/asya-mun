using System.Text.Json;
using System.Net;
using System.Security.Claims;
using System.Text.Encodings.Web;
using AsyaMun.Api.Extensions;
using AsyaMun.Api.Http;
using AsyaMun.Application;
using AsyaMun.Application.Services;
using AsyaMun.Core.Data;
using AsyaMun.Core.Models;
using AsyaMun.Core.Notifications;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.FileProviders;

static void Check(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
    Console.WriteLine($"PASS: {message}");
}

// Verify the moved snapshot still describes exactly the current relational model without connecting to a database.
var options = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql("Host=localhost;Database=unused", provider =>
{
    var translator = EnumNameTranslator.Instance;
    provider.MapEnum<AttachmentTargetType>("attachmenttargettype", "public", translator);
    provider.MapEnum<AuditActionType>("auditactiontype", "public", translator);
    provider.MapEnum<ConferenceStatus>("conferencestatus", "public", translator);
    provider.MapEnum<DelegateAttrType>("delegateattrtype", "public", translator);
    provider.MapEnum<InstructionStatus>("instructionstatus", "public", translator);
    provider.MapEnum<InstructionType>("instructiontype", "public", translator);
    provider.MapEnum<MessageType>("messagetype", "public", translator);
    provider.MapEnum<RoundStatus>("roundstatus", "public", translator);
    provider.MapEnum<UserRole>("userrole", "public", translator);
}).Options;
using (var db = new AppDbContext(options))
{
    Check(db.Database.GetMigrations().SequenceEqual(["20260822154119_InitialCreate"]), "migration identity preserved in Core");
    Check(!db.Database.HasPendingModelChanges(), "moved model matches existing migration snapshot");
}
Check(!typeof(AppDbContext).Assembly.GetReferencedAssemblies().Any(a => a.Name!.StartsWith("Microsoft.AspNetCore") || a.Name.StartsWith("AsyaMun.Application") || a.Name.StartsWith("AsyaMun.Api")), "Core has no ASP.NET or upper-layer dependencies");
Check(!typeof(UserService).Assembly.GetReferencedAssemblies().Any(a => a.Name!.StartsWith("Microsoft.AspNetCore") || a.Name.StartsWith("AsyaMun.Api")), "Application has no HTTP host dependency");
var services = new ServiceCollection().AddLogging().AddAsyaApplication();
services.AddScoped(_ => new AppDbContext(options));
services.AddScoped<INotificationSender, TestNotificationSender>();
using (var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateOnBuild = true, ValidateScopes = true }))
using (var scope = provider.CreateScope())
{
    Check(scope.ServiceProvider.GetRequiredService<InstructionService>() is not null, "application services resolve with a transport adapter");
}

var http = new DefaultHttpContext();
http.Request.QueryString = new QueryString("?page=2&pageSize=7&current=4&sort=name,desc&sort=uuid,asc");
var page = PageInputParser.Parse(http.Request);
Check(page.Page == 3 && page.Size == 7 && page.Sort.Count == 2 && page.Sort[0].Descending, "legacy paging query semantics preserved at the API boundary");

var temporary = Path.Combine(Path.GetTempPath(), "asya-catalog-" + Guid.NewGuid());
try
{
    var directory = Path.Combine(temporary, "example.tool");
    Directory.CreateDirectory(directory);
    File.WriteAllText(Path.Combine(directory, "extension.json"), """
        {"schemaVersion":1,"hostApiVersion":1,"id":"example.tool","name":"Tool","version":"1.0.0","author":"Example","frontend":{"entry":"index.html"}}
        """);
    File.WriteAllText(Path.Combine(directory, "index.html"), "<main></main>");
    var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Extensions:Path"] = temporary }).Build();
    var catalog = new ExtensionCatalog(configuration, new TestEnvironment(), NullLogger<ExtensionCatalog>.Instance);
    Check(catalog.ListEnabled().Single().Id == "example.tool", "external package discovered at runtime");
    Check(catalog.ResolveAssetPath("example.tool", "../extension.json") is null, "asset traversal rejected");
    var builder = WebApplication.CreateBuilder();
    builder.WebHost.UseUrls("http://127.0.0.1:0");
    builder.Logging.ClearProviders();
    builder.Configuration["Extensions:Path"] = temporary;
    builder.Services.AddSingleton<ExtensionCatalog>();
    builder.Services.AddControllers().AddApplicationPart(typeof(AsyaMun.Api.Controllers.ExtensionController).Assembly);
    builder.Services.AddAuthentication("Smoke").AddScheme<AuthenticationSchemeOptions, SmokeAuthenticationHandler>("Smoke", _ => { });
    builder.Services.AddAuthorization();
    await using var host = builder.Build();
    host.UseAuthentication();
    host.UseAuthorization();
    host.MapControllers();
    await host.StartAsync();
    var address = host.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
    using var client = new HttpClient { BaseAddress = new Uri(address) };
    Check((await client.GetAsync("/api/extensions")).StatusCode == HttpStatusCode.Unauthorized, "catalog API requires authentication");
    Check((await client.GetAsync("/extension/example.tool/index.html")).StatusCode == HttpStatusCode.OK, "enabled plugin assets are served by the host");
    client.DefaultRequestHeaders.Authorization = new("Bearer", "smoke");
    Check((await client.GetStringAsync("/api/extensions")).Contains("example.tool"), "authenticated catalog publishes installed extension");
    File.WriteAllText(Path.Combine(temporary, ".settings.json"), "{\"disabled\":[\"example.tool\"]}");
    Check(catalog.ListEnabled().Count == 0, "disable takes effect without restarting host");
    Check((await client.GetAsync("/extension/example.tool/index.html")).StatusCode == HttpStatusCode.NotFound, "disabled plugin assets return 404");
    File.WriteAllText(Path.Combine(temporary, ".settings.json"), "invalid");
    Check(catalog.ListEnabled().Count == 0, "malformed settings fail closed");
    File.Delete(Path.Combine(temporary, ".settings.json"));
    File.Delete(Path.Combine(directory, "index.html"));
    Check(catalog.ListEnabled().Count == 0, "incomplete installations are not advertised");
    await host.StopAsync();
}
finally { Directory.Delete(temporary, true); }

sealed class TestNotificationSender : INotificationSender
{
    public Task SendAsync(IReadOnlyList<string> userIds, NotificationEventResponse notification, CancellationToken cancellationToken = default) => Task.CompletedTask;
}

sealed class TestEnvironment : IWebHostEnvironment
{
    public string ApplicationName { get; set; } = "Tests";
    public string EnvironmentName { get; set; } = "Production";
    public string WebRootPath { get; set; } = "";
    public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    public string ContentRootPath { get; set; } = "";
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}

sealed class SmokeAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger, UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        => Task.FromResult(Request.Headers.Authorization == "Bearer smoke"
            ? AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, "smoke")], Scheme.Name)), Scheme.Name))
            : AuthenticateResult.NoResult());
}
