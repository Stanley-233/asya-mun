using AsyaMun.Api.Audit;
using AsyaMun.Api.Auth;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Errors;
using AsyaMun.Api.Models;
using AsyaMun.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;

namespace AsyaMun.Api.Controllers;

[ApiController]
[Route("api/announcement/image")]
public class AnnouncementController : ControllerBase
{
    private const long MaxFileSizeBytes = 8L * 1024L * 1024L;

    private readonly AnnouncementService _announcementService;
    private readonly AttachmentService _attachmentService;

    public AnnouncementController(AnnouncementService announcementService, AttachmentService attachmentService)
    {
        _announcementService = announcementService;
        _attachmentService = attachmentService;
    }

    [HttpPut]
    [Authorize]
    [Auditable(AuditActionType.ANNOUNCEMENT_IMAGE_UPDATE, "更新公告图片")]
    public async Task<IActionResult> UpdateAnnouncementImage([FromForm] IFormFile? file)
    {
        var requester = RequireCurrentUser();
        if (requester.Role is not (UserRole.SYS_ADMIN or UserRole.DH or UserRole.DM))
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "需要管理员或导演权限", StatusCodes.Status403Forbidden);
        }

        if (file == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "文件为空");
        }

        if (file.Length > MaxFileSizeBytes)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "文件大小不能超过8MB");
        }

        if (file.ContentType?.StartsWith("image/", StringComparison.Ordinal) != true)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "仅支持图片文件");
        }

        var response = await _announcementService.ReplaceAnnouncementImageAsync(file);
        return ApiResp.Ok(response);
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetAnnouncementImageInfo()
    {
        _ = RequireCurrentUser();
        var response = await _announcementService.GetCurrentAnnouncementImageInfoAsync();
        return ApiResp.Ok(response);
    }

    [HttpGet("download")]
    [Authorize]
    public async Task<IActionResult> DownloadAnnouncementImage()
    {
        _ = RequireCurrentUser();
        var attachment = await _announcementService.GetCurrentAnnouncementImageAttachmentAsync();
        var fileName = BuildDownloadFileName(attachment.FileName, attachment.FileType);
        var bytes = await _attachmentService.ReadBlobAsync(attachment.FileBlob);
        var contentType = ResolveImageMediaType(attachment.FileType);

        Response.ContentType = contentType;
        Response.ContentLength = attachment.FileSize;
        Response.Headers.ContentDisposition = BuildInlineContentDisposition(fileName).ToString();

        return File(bytes, contentType);
    }

    private static string ResolveImageMediaType(string fileType)
    {
        return fileType.ToLowerInvariant() switch
        {
            "jpg" or "jpeg" => "image/jpeg",
            "png" => "image/png",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "bmp" => "image/bmp",
            "svg" => "image/svg+xml",
            _ => "application/octet-stream"
        };
    }

    private static ContentDispositionHeaderValue BuildInlineContentDisposition(string fileName)
    {
        var asciiFallback = new string(fileName.Select(ch => ch is >= ' ' and <= '~' ? ch : '_').ToArray());
        return new ContentDispositionHeaderValue("inline")
        {
            FileName = asciiFallback,
            FileNameStar = fileName
        };
    }

    private static string BuildDownloadFileName(string fileName, string fileType)
    {
        var safeName = string.IsNullOrWhiteSpace(fileName) ? "announcement" : fileName;
        var safeType = string.IsNullOrWhiteSpace(fileType) ? "bin" : fileType;
        return safeName.EndsWith("." + safeType, StringComparison.Ordinal)
            ? safeName
            : safeName + "." + safeType;
    }

    private User RequireCurrentUser()
    {
        return HttpContext.GetCurrentUser()
            ?? throw new TokenInvalidException("登录状态已失效，请重新登录");
    }
}