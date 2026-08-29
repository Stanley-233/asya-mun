using AsyaMun.Api.Dtos;
using AsyaMun.Api.Errors;
using AsyaMun.Api.Models;
using Microsoft.AspNetCore.Http;

namespace AsyaMun.Api.Services;

public class AnnouncementService
{
    private readonly AttachmentService _attachmentService;
    private readonly SystemConfigService _systemConfigService;

    public AnnouncementService(AttachmentService attachmentService, SystemConfigService systemConfigService)
    {
        _attachmentService = attachmentService;
        _systemConfigService = systemConfigService;
    }

    public async Task<AnnouncementImageResponse> ReplaceAnnouncementImageAsync(IFormFile file, CancellationToken ct = default)
    {
        var oldUuid = await _systemConfigService.GetAnnouncementImageUuidAsync();
        var uploaded = await _attachmentService.UploadAttachmentAsync(file, AttachmentTargetType.ANNOUNCEMENT, null, ct);
        var newUuid = Guid.Parse(uploaded.Uuid);

        await _systemConfigService.SetAnnouncementImageUuidAsync(newUuid);

        if (oldUuid.HasValue && oldUuid.Value != newUuid)
        {
            try
            {
                await _attachmentService.DeleteAttachmentAsync(oldUuid.Value, ct);
            }
            catch (AsyaBusinessException)
            {
            }
        }

        var attachment = await _attachmentService.GetAttachmentAsync(newUuid, ct);
        return ToResponse(attachment);
    }

    public async Task<AnnouncementImageResponse?> GetCurrentAnnouncementImageInfoAsync(CancellationToken ct = default)
    {
        var uuid = await _systemConfigService.GetAnnouncementImageUuidAsync();
        if (!uuid.HasValue)
        {
            return null;
        }

        var attachment = await FindAnnouncementAttachmentAsync(uuid.Value, ct);
        return ToResponse(attachment);
    }

    public async Task<Attachment> GetCurrentAnnouncementImageAttachmentAsync(CancellationToken ct = default)
    {
        var uuid = await _systemConfigService.GetAnnouncementImageUuidAsync()
            ?? throw new InvalidOperationException("当前未设置公告图");

        return await FindAnnouncementAttachmentAsync(uuid, ct);
    }

    private async Task<Attachment> FindAnnouncementAttachmentAsync(Guid uuid, CancellationToken ct)
    {
        var attachment = await _attachmentService.GetAttachmentAsync(uuid, ct);
        if (attachment.TargetType != AttachmentTargetType.ANNOUNCEMENT)
        {
            throw new InvalidOperationException("公告图配置无效");
        }

        return attachment;
    }

    private static AnnouncementImageResponse ToResponse(Attachment attachment)
    {
        return new AnnouncementImageResponse(
            attachment.Uuid.ToString("D"),
            attachment.FileName,
            attachment.FileType,
            attachment.FileSize);
    }
}