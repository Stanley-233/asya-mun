namespace AsyaMun.Core.Notifications;

public enum NotificationKind
{
    PUBLIC_MESSAGE,
    SECRET_MESSAGE,
    INSTRUCTION_FEEDBACK
}

public record NotificationEventResponse(
    string EventId,
    NotificationKind Kind,
    DateTime OccurredAt,
    string? MessageUuid,
    string? InstructionUuid,
    string Title,
    string Brief,
    string? SenderName);