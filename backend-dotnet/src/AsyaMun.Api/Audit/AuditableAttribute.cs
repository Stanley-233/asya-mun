using AsyaMun.Api.Models;

namespace AsyaMun.Api.Audit;

[AttributeUsage(AttributeTargets.Method)]
public sealed class AuditableAttribute : Attribute
{
    public AuditActionType Type { get; }

    public string Content { get; }

    public AuditableAttribute(AuditActionType type, string content)
    {
        Type = type;
        Content = content;
    }
}