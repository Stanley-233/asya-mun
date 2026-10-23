using AsyaMun.Api.Dtos;
using AsyaMun.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;

namespace AsyaMun.Api.Controllers;

public sealed class ExtensionController(ExtensionCatalog catalog) : ControllerBase
{
    private static readonly FileExtensionContentTypeProvider ContentTypes = new();

    [Authorize]
    [HttpGet("api/extensions")]
    public IActionResult List()
    {
        Response.Headers.CacheControl = "no-store";
        return ApiResp.Ok(catalog.ListEnabled());
    }

    // Static assets contain no user data. Host authentication gates the mounted tool page.
    [AllowAnonymous]
    [HttpGet("extension/{id}/{**asset}")]
    public IActionResult Asset(string id, string? asset)
    {
        if (!catalog.ListEnabled().Any(extension => extension.Id == id)) return NotFound();
        var path = catalog.ResolveAssetPath(id, asset ?? "index.html");
        if (path is null || !ContentTypes.TryGetContentType(path, out var contentType)) return NotFound();
        Response.Headers.CacheControl = "no-store";
        Response.Headers.XContentTypeOptions = "nosniff";
        Response.Headers.ContentSecurityPolicy = "frame-ancestors 'self'";
        try
        {
            return File(new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete), contentType);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return NotFound();
        }
    }
}
