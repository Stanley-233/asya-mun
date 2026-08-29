using System.Globalization;
using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;
using AsyaMun.Api.Models;
using AsyaMun.Api.Services;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;

namespace AsyaMun.Api.Audit;

public partial class AuditActionFilter : IAsyncActionFilter
{
    private const int MaxDepth = 2;

    private readonly AuditLogService _auditLogService;

    public AuditActionFilter(AuditLogService auditLogService)
    {
        _auditLogService = auditLogService;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var auditable = context.ActionDescriptor.EndpointMetadata.OfType<AuditableAttribute>().FirstOrDefault();
        if (auditable == null)
        {
            await next();
            return;
        }

        var actionDescriptor = context.ActionDescriptor as ControllerActionDescriptor;
        var className = actionDescriptor?.ControllerName ?? "Unknown";
        var methodName = actionDescriptor?.ActionName ?? "Unknown";
        var actor = ResolveActor(context.HttpContext, context.ActionArguments);

        ActionExecutedContext executed;
        try
        {
            executed = await next();
        }
        catch (Exception ex)
        {
            await SaveLogAsync(auditable, className, methodName, actor, context.ActionArguments, null, ex);
            throw;
        }

        var resultData = ExtractResultData(executed.Result);
        if (actor is { Uuid: null })
        {
            var resultUuid = TryGetUuid(resultData);
            if (resultUuid.HasValue)
            {
                actor = actor with { Uuid = resultUuid };
            }
        }

        var hasError = executed.Exception != null;
        var error = executed.Exception;
        await SaveLogAsync(auditable, className, methodName, actor, context.ActionArguments, resultData, error);
    }

    private async Task SaveLogAsync(
        AuditableAttribute auditable,
        string className,
        string methodName,
        AuditActor actor,
        IDictionary<string, object?> arguments,
        object? resultData,
        Exception? error)
    {
        var resourceType = className.RemoveControllerSuffix();
        var resourceId = ResolveResourceId(arguments.Values)
            ?? ResolveResourceIdFromValue(resultData);

        var baseContent = $"{auditable.Content} [method={className}.{methodName} resourceId={resourceId}]";
        var contextData = BuildContextData(className, methodName, arguments, resultData, error);

        await _auditLogService.SaveAsync(
            actorUuid: actor.Uuid,
            actorName: actor.Name,
            actorIp: actor.Ip,
            requestMethod: actor.RequestMethod,
            requestPath: actor.RequestPath,
            requestQuery: actor.RequestQuery,
            userAgent: actor.UserAgent,
            actionType: auditable.Type,
            resourceType: resourceType,
            resourceId: resourceId,
            eventContent: error == null ? baseContent : $"{baseContent} [error={Truncate(error.Message, 200)}]",
            contextData: contextData,
            success: error == null);
    }

    private static AuditActor ResolveActor(HttpContext context, IDictionary<string, object?> arguments)
    {
        var actor = context.GetAuditActor() ?? new AuditActor(null, null, null, null, null, null, null);

        foreach (var arg in arguments.Values.OfType<object>())
        {
            if (arg is User user)
            {
                actor = actor with { Name = actor.Name ?? user.Name, Uuid = actor.Uuid ?? user.Uuid };
                break;
            }

            if (arg is IFormFile)
            {
                continue;
            }

            if (arg.GetType().GetProperty("Name")?.GetValue(arg) is string name
                && arg.GetType().GetProperty("Password") != null)
            {
                actor = actor with { Name = actor.Name ?? name };
                continue;
            }

            if (arg is Guid uuidArg)
            {
                actor = actor with { Uuid = actor.Uuid ?? uuidArg };
            }
        }

        return actor;
    }

    private static string? ResolveResourceId(IEnumerable<object?> sources)
    {
        foreach (var source in sources)
        {
            var id = ResolveResourceIdFromValue(source);
            if (id != null)
            {
                return id;
            }
        }

        return null;
    }

    private static string? ResolveResourceIdFromValue(object? source)
    {
        if (source == null)
        {
            return null;
        }

        if (source is Guid g)
        {
            return g.ToString("D");
        }

        if (source is short or int or long or ushort or uint or ulong)
        {
            return Convert.ToString(source, CultureInfo.InvariantCulture);
        }

        if (source is string str
            && (UuidPattern().IsMatch(str) || NumericPattern().IsMatch(str)))
        {
            return Truncate(str, 120);
        }

        if (source is IEnumerable<object?> iterable)
        {
            return iterable.Select(ResolveResourceIdFromValue).FirstOrDefault(x => x != null);
        }

        var type = source.GetType();
        if (type.IsPrimitive || type.IsEnum || type == typeof(string))
        {
            return null;
        }

        foreach (var propName in new[] { "Uuid", "Id" })
        {
            var prop = type.GetProperty(propName);
            if (prop == null)
            {
                continue;
            }

            var value = SafeGet(prop, source);
            if (value is Guid id)
            {
                return id.ToString("D");
            }

            if (value is string idStr && !string.IsNullOrEmpty(idStr))
            {
                return Truncate(idStr, 120);
            }
        }

        return null;
    }

    private static Guid? TryGetUuid(object? source)
    {
        if (source == null)
        {
            return null;
        }

        var type = source.GetType();
        var prop = type.GetProperty("Uuid");
        if (prop == null)
        {
            return null;
        }

        var value = SafeGet(prop, source);
        return value switch
        {
            Guid g => g,
            string s when Guid.TryParse(s, out var p) => p,
            _ => null
        };
    }

    private static string BuildContextData(
        string className,
        string methodName,
        IDictionary<string, object?> arguments,
        object? result,
        Exception? error)
    {
        var summary = new Dictionary<string, object?>
        {
            ["className"] = className,
            ["methodName"] = methodName,
            ["arguments"] = arguments
                .Select((kv, index) => new Dictionary<string, object?>
                {
                    ["index"] = index,
                    ["value"] = Summarize(kv.Value)
                })
                .ToList(),
            ["result"] = Summarize(result)
        };

        if (error != null)
        {
            summary["errorType"] = error.GetType().Name;
            summary["errorMessage"] = Truncate(error.Message, 500);
        }

        return JsonSerializer.Serialize(summary);
    }

    private static object? Summarize(object? value, int depth = 0)
    {
        if (value == null)
        {
            return null;
        }

        if (depth >= MaxDepth)
        {
            return Truncate(value.ToString() ?? string.Empty, 200);
        }

        return value switch
        {
            string s => Truncate(s, 500),
            short or int or long or ushort or uint or ulong or decimal or double or float or bool or Guid => value,
            Enum e => e.ToString(),
            DateTime dt => dt.ToString("O"),
            ObjectResult or StatusCodeResult => Summarize(ExtractResultData(value), depth + 1),
            IDictionary<string, object?> dictionary => dictionary
                .Take(10)
                .ToDictionary(
                    kv => Truncate(kv.Key, 80),
                    kv => Summarize(kv.Value, depth + 1)),
            IEnumerable<object?> enumerable => enumerable.Take(10).Select(x => Summarize(x, depth + 1)).ToList(),
            User user => new Dictionary<string, object?>
            {
                ["uuid"] = user.Uuid.ToString("D"),
                ["name"] = user.Name,
                ["displayName"] = user.DisplayName,
                ["role"] = user.Role.ToString(),
                ["conferenceUuid"] = user.ConferenceId?.ToString("D")
            },
            _ => SummarizeBean(value, depth)
        };
    }

    private static object? SummarizeBean(object value, int depth)
    {
        var type = value.GetType();
        var visible = type
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p => p.GetIndexParameters().Length == 0
                        && p.GetGetMethod() != null
                        && !ExcludedProperties().Contains(p.Name))
            .Take(12)
            .Select(p => new KeyValuePair<string, object?>(p.Name, Summarize(SafeGet(p, value), depth + 1)))
            .ToDictionary(x => x.Key, x => x.Value);

        return visible.Count == 0 ? Truncate(value.ToString() ?? string.Empty, 200) : visible;
    }

    private static object? ExtractResultData(object? result)
    {
        return result switch
        {
            ObjectResult { Value: not null } objectResult => objectResult.Value,
            JsonResult { Value: not null } jsonResult => jsonResult.Value,
            _ => null
        };
    }

    private static object? SafeGet(PropertyInfo prop, object target)
    {
        try
        {
            return prop.GetValue(target);
        }
        catch
        {
            return null;
        }
    }

    private static string Truncate(string text, int maxLength)
    {
        return text.Length <= maxLength ? text : text[..maxLength] + "...";
    }

    [GeneratedRegex("^[0-9a-fA-F-]{32,36}$")]
    private static partial Regex UuidPattern();

    [GeneratedRegex("^\\d+$")]
    private static partial Regex NumericPattern();

    [GeneratedRegex("[^\\w]")]
    private static partial Regex NonWordRegex();

    private static HashSet<string> ExcludedProperties()
    {
        return new HashSet<string>(StringComparer.Ordinal)
        {
            "Password",
            "FileBlob",
            "Bytes",
            "Headers",
            "Authorization",
            "Resource",
            "InputStream"
        };
    }
}

internal static class AuditNamingExtensions
{
    public static string RemoveControllerSuffix(this string controllerName)
    {
        var cleaned = controllerName;
        if (cleaned.EndsWith("Controller", StringComparison.Ordinal))
        {
            cleaned = cleaned[..^"Controller".Length];
        }

        return cleaned;
    }
}