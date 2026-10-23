using System.Text.RegularExpressions;

namespace AsyaMun.Core.Extensions;

/// <summary>Versioned contract shared by built-in and externally distributed extensions.</summary>
public sealed record ExtensionManifest(
    int SchemaVersion, string Id, string Name, string Version, string Author,
    string? Description, int HostApiVersion, ExtensionFrontend Frontend, string[]? Permissions)
{
    public bool IsSupported()
        => SchemaVersion == 1 && HostApiVersion == 1 && IsValidId(Id)
           && !string.IsNullOrWhiteSpace(Name) && !string.IsNullOrWhiteSpace(Author)
           && Regex.IsMatch(Version ?? "", @"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$")
           && Frontend is not null && IsValidEntry(Frontend.Entry);

    public static bool IsValidId(string? id)
        => id is { Length: > 0 and <= 80 }
           && Regex.IsMatch(id, @"^[a-z0-9]+(?:[._-][a-z0-9]+)*$")
           && !Regex.IsMatch(id, @"^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)", RegexOptions.IgnoreCase);

    public static bool IsValidEntry(string? entry)
        => !string.IsNullOrWhiteSpace(entry) && entry.EndsWith(".html", StringComparison.Ordinal)
           && !entry.Contains('\\') && !entry.Contains(':') && !entry.StartsWith('/')
           && entry.Split('/').All(segment => segment.Length > 0 && segment is not "." and not ".."
               && Regex.IsMatch(segment, @"^[a-zA-Z0-9_.-]+$"));
}

public sealed record ExtensionFrontend(string Entry, string? Icon);
