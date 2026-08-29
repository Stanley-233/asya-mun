using AsyaMun.Api.Models;

namespace AsyaMun.Api.Dtos;

public record MessageReceiverDelayItem(string ReceiverId, int DelayMinutes);

public record MessageReceiverReadableAtItem(string ReceiverId, DateTime ReadableAt);

public record MessageCreateRequest(
    string Title,
    string Content,
    string? Brief,
    MessageType MsgType,
    DateTime? PublishRealTime = null,
    string PublishGameTime = "",
    bool IsSecret = false,
    List<MessageReceiverDelayItem>? ReceiverIds = null,
    List<string>? AttachmentUuids = null);

public record MessageUpdateRequest(
    string? Title = null,
    string? Content = null,
    string? Brief = null,
    MessageType? MsgType = null,
    DateTime? PublishRealTime = null,
    string? PublishGameTime = null,
    bool? IsSecret = null,
    List<MessageReceiverReadableAtItem>? ReceiverIds = null,
    List<string>? AttachmentUuids = null);

public record MessageResponse(
    string Uuid,
    string ConferenceId,
    string? SenderId,
    string? SenderName,
    string? SenderDisplayName,
    string? Title,
    string? Brief,
    string? Content,
    MessageType? MsgType,
    DateTime PublishRealTime,
    string PublishGameTime,
    bool IsSecret,
    bool? HasAttachment,
    List<string>? AttachmentUuids);

public record MessageReceiverVisibilityResponse(
    string Uuid,
    string Name,
    string? DisplayName,
    UserRole Role,
    DateTime ReadableAt);