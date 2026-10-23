namespace AsyaMun.Core.Models;

public class SystemConfig
{
    public string ConfigKey { get; set; } = null!;

    public string? Description { get; set; }

    public string ConfigValue { get; set; } = null!;
}