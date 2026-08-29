using AsyaMun.Api.Models;

namespace AsyaMun.Api.Dtos;

public record AttachmentUploadResponse(string Uuid, string FileName, string FileType);

public record AttachmentInfoResponse(
    string Uuid,
    string FileName,
    string FileType,
    long FileSize,
    AttachmentTargetType? TargetType,
    string? TargetId,
    string? MessageId);