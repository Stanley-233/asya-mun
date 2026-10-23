using System.Text.Json;
using AsyaMun.Core.Extensions;

namespace AsyaMun.Api.Extensions;

public sealed class ExtensionCatalog(IConfiguration configuration, IWebHostEnvironment environment,
    ILogger<ExtensionCatalog> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public string RootPath
    {
        get
        {
            if (configuration["Extensions:Path"] is { Length: > 0 } configured)
                return Path.GetFullPath(configured, AppContext.BaseDirectory);
            if (Environment.GetEnvironmentVariable("ASYA_WEBROOT") is { Length: > 0 } webRoot)
                return Path.Combine(Path.GetFullPath(webRoot), "extension");
            var deployed = Path.Combine(AppContext.BaseDirectory, "wwwroot", "extension");
            if (Directory.Exists(deployed) || !environment.IsDevelopment()) return deployed;
            return Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../../frontend/public/extension"));
        }
    }

    public IReadOnlyList<ExtensionManifest> ListEnabled()
    {
        if (!Directory.Exists(RootPath)) return [];
        var disabled = ReadDisabledIds();
        var extensions = new List<ExtensionManifest>();
        foreach (var directory in Directory.EnumerateDirectories(RootPath).Order(StringComparer.Ordinal))
        {
            var id = Path.GetFileName(directory);
            if (!ExtensionManifest.IsValidId(id) || disabled.Contains(id)) continue;
            try
            {
                if ((File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0) continue;
                var manifestPath = Path.Combine(directory, "extension.json");
                if (!File.Exists(manifestPath)) continue;
                using var document = JsonDocument.Parse(File.ReadAllText(manifestPath));
                if (document.RootElement.ValueKind != JsonValueKind.Object) continue;
                // Backend loading is reserved for a later protocol revision.
                if (document.RootElement.TryGetProperty("backend", out var backend) && backend.ValueKind != JsonValueKind.Null)
                    continue;
                var manifest = document.Deserialize<ExtensionManifest>(JsonOptions);
                if (manifest is null || manifest.Id != id || !manifest.IsSupported()
                    || ResolveAssetPath(id, manifest.Frontend.Entry) is null) continue;
                extensions.Add(manifest);
            }
            catch (Exception exception) when (exception is IOException or JsonException or UnauthorizedAccessException)
            {
                logger.LogWarning(exception, "Ignoring invalid extension {ExtensionId}", id);
            }
        }
        return extensions;
    }

    public string? ResolveAssetPath(string id, string asset)
    {
        if (!ExtensionManifest.IsValidId(id) || string.IsNullOrEmpty(asset)
            || asset.Contains('\\') || asset.Contains(':') || asset.StartsWith('/')) return null;
        var segments = asset.Split('/');
        if (segments.Any(part => part.Length == 0 || part is "." or ".." || part.StartsWith('.'))) return null;
        try
        {
            var current = Path.Combine(RootPath, id);
            foreach (var segment in segments)
            {
                current = Path.Combine(current, segment);
                if (!Path.Exists(current) || (File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0) return null;
            }
            return File.Exists(current) ? current : null;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            // A package can disappear while an uninstall is in progress.
            return null;
        }
    }

    private HashSet<string> ReadDisabledIds()
    {
        var settingsPath = Path.Combine(RootPath, ".settings.json");
        if (!File.Exists(settingsPath)) return new(StringComparer.Ordinal);
        try
        {
            var settings = JsonSerializer.Deserialize<ExtensionSettings>(File.ReadAllText(settingsPath), JsonOptions);
            return new(settings?.Disabled ?? [], StringComparer.Ordinal);
        }
        catch (Exception exception) when (exception is IOException or JsonException or UnauthorizedAccessException)
        {
            logger.LogError(exception, "Cannot read extension settings; disabling all extensions");
            return new(Directory.EnumerateDirectories(RootPath).Select(Path.GetFileName).OfType<string>(), StringComparer.Ordinal);
        }
    }

    private sealed record ExtensionSettings(string[]? Disabled);
}
