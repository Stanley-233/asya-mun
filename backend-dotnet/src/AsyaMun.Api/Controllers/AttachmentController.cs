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
[Route("api/attachments")]
public class AttachmentController : ControllerBase
{
    private const long MaxFileSizeBytes = 8L * 1024L * 1024L;

    private readonly AttachmentService _attachmentService;

    public AttachmentController(AttachmentService attachmentService)
    {
        _attachmentService = attachmentService;
    }

    [HttpPost]
    [Authorize]
    [Auditable(AuditActionType.ATTACHMENT_UPLOAD, "上传附件")]
    public async Task<IActionResult> Upload([FromForm] IFormFile? file)
    {
        _ = RequireCurrentUser();

        if (file == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "文件为空");
        }

        if (file.Length > MaxFileSizeBytes)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "文件大小不能超过8MB");
        }

        var response = await _attachmentService.UploadAttachmentAsync(file);
        return ApiResp.Ok(response);
    }

    [HttpDelete("{uuid:guid}")]
    [Authorize]
    [Auditable(AuditActionType.ATTACHMENT_DELETE, "删除附件")]
    public async Task<IActionResult> Delete(Guid uuid)
    {
        var requester = RequireCurrentUser();
        if (requester.Role is not (UserRole.DM or UserRole.DH or UserRole.SYS_ADMIN))
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "无权访问", StatusCodes.Status403Forbidden);
        }

        await _attachmentService.DeleteAttachmentAsync(uuid);
        return ApiResp.OkUnit();
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> ListAll()
    {
        var requester = RequireCurrentUser();
        if (requester.Role != UserRole.SYS_ADMIN)
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "需要管理员权限", StatusCodes.Status403Forbidden);
        }

        var response = await _attachmentService.ListAllAsync();
        return ApiResp.Ok(response);
    }

    [HttpGet("{uuid:guid}")]
    [Authorize]
    public async Task<IActionResult> GetOne(Guid uuid)
    {
        _ = RequireCurrentUser();
        var response = await _attachmentService.GetAttachmentInfoAsync(uuid);
        return ApiResp.Ok(response);
    }

    [HttpGet("{uuid:guid}/download")]
    [Authorize]
    public async Task<IActionResult> Download(Guid uuid)
    {
        _ = RequireCurrentUser();
        var attachment = await _attachmentService.GetAttachmentAsync(uuid);
        var fileName = BuildDownloadFileName(attachment.FileName, attachment.FileType);
        var bytes = await _attachmentService.ReadBlobAsync(attachment.FileBlob);

        Response.ContentType = "application/octet-stream";
        Response.ContentLength = attachment.FileSize;
        Response.Headers.ContentDisposition = BuildContentDisposition("attachment", fileName).ToString();

        return File(bytes, "application/octet-stream");
    }

    private static ContentDispositionHeaderValue BuildContentDisposition(string type, string fileName)
    {
        var asciiFallback = new string(fileName.Select(ch => ch is >= ' ' and <= '~' ? ch : '_').ToArray());
        return new ContentDispositionHeaderValue(type)
        {
            FileName = asciiFallback,
            FileNameStar = fileName
        };
    }

    private static string BuildDownloadFileName(string fileName, string fileType)
    {
        var safeName = string.IsNullOrWhiteSpace(fileName) ? "file" : fileName;
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