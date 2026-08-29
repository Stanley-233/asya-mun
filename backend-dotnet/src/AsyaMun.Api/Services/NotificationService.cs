using System.Globalization;
using AsyaMun.Api.Data;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Hubs;
using AsyaMun.Api.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AsyaMun.Api.Services;

public class NotificationService
{
    private const int BriefPreviewMaxLength = 64;

    private readonly AppDbContext _db;
    private readonly IHubContext<NotificationHub> _hub;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(
        AppDbContext db,
        IHubContext<NotificationHub> hub,
        ILogger<NotificationService> logger)
    {
        _db = db;
        _hub = hub;
        _logger = logger;
    }

    public async Task NotifyPublicMessageAsync(Message message)
    {
        try
        {
            var delegateIds = await _db.Users.AsNoTracking()
                .Where(u => u.ConferenceId == message.ConferenceId && u.Role == UserRole.DELEGATE)
                .Select(u => u.Uuid.ToString("D"))
                .ToListAsync();
            if (delegateIds.Count == 0)
            {
                return;
            }

            var e = ToPublicMessageEvent(message);
            await _hub.Clients.Users(delegateIds).SendAsync("Notification", e);
            _logger.LogInformation(
                "Dispatch notification, kind={Kind}, eventId={EventId}, delegateCount={Count}",
                e.Kind,
                e.EventId,
                delegateIds.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to dispatch public message notification, messageUuid={MessageUuid}", message.Uuid);
        }
    }

    public async Task NotifyReadableSecretReceiversAsync(Message message)
    {
        var now = NowUtc();
        foreach (var receiver in message.MessageReceivers)
        {
            if (receiver.ReadableAt <= now)
            {
                await NotifySecretMessageAsync(message, receiver.UserId, receiver.ReadableAt);
            }
        }
    }

    public async Task NotifySecretMessageAsync(Message message, User receiver, DateTime readableAt)
    {
        if (receiver.Role != UserRole.DELEGATE)
        {
            return;
        }

        await SendSecretMessageAsync(message, receiver.Uuid, readableAt);
    }

    public async Task NotifyInstructionFeedbackAsync(Instruction instruction)
    {
        try
        {
            if (instruction.Status != InstructionStatus.FEEDBACKED)
            {
                return;
            }

            var submitter = instruction.Submitter;
            if (submitter == null || submitter.Role != UserRole.DELEGATE)
            {
                return;
            }

            var e = ToInstructionFeedbackEvent(instruction);
            await _hub.Clients.User(submitter.Uuid.ToString("D")).SendAsync("Notification", e);
            _logger.LogInformation(
                "Dispatch notification, kind={Kind}, eventId={EventId}, userUuid={UserUuid}",
                e.Kind,
                e.EventId,
                submitter.Uuid);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to dispatch instruction feedback notification, instructionUuid={InstructionUuid}", instruction.Uuid);
        }
    }

    public async Task NotifyReadableSecretMessagesBetweenAsync(DateTime after, DateTime before)
    {
        if (after >= before)
        {
            return;
        }

        try
        {
            var entries = await _db.MessageReceivers.AsNoTracking()
                .Include(mr => mr.Message)
                .ThenInclude(m => m.Sender)
                .Include(mr => mr.User)
                .Where(mr => mr.Message.IsSecret && mr.ReadableAt > after && mr.ReadableAt <= before)
                .ToListAsync();

            foreach (var entry in entries)
            {
                await NotifySecretMessageAsync(entry.Message, entry.User, entry.ReadableAt);
            }

            if (entries.Count > 0)
            {
                _logger.LogInformation(
                    "Dispatched readable secret message notifications, count={Count}, after={After}, before={Before}",
                    entries.Count,
                    FormatIso(after),
                    FormatIso(before));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to dispatch readable secret message notifications");
        }
    }

    private async Task NotifySecretMessageAsync(Message message, Guid receiverUuid, DateTime readableAt)
    {
        try
        {
            var isDelegate = await _db.Users.AsNoTracking()
                .AnyAsync(u => u.Uuid == receiverUuid && u.Role == UserRole.DELEGATE);
            if (!isDelegate)
            {
                return;
            }

            await SendSecretMessageAsync(message, receiverUuid, readableAt);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to dispatch secret message notification, messageUuid={MessageUuid}, receiverUuid={ReceiverUuid}",
                message.Uuid,
                receiverUuid);
        }
    }

    private async Task SendSecretMessageAsync(Message message, Guid receiverUuid, DateTime readableAt)
    {
        var e = ToSecretMessageEvent(message, receiverUuid, readableAt);
        await _hub.Clients.User(receiverUuid.ToString("D")).SendAsync("Notification", e);
        _logger.LogInformation(
            "Dispatch notification, kind={Kind}, eventId={EventId}, userUuid={UserUuid}",
            e.Kind,
            e.EventId,
            receiverUuid);
    }

    private static NotificationEventResponse ToPublicMessageEvent(Message message)
    {
        var messageUuid = message.Uuid.ToString("D");
        var occurredAt = message.PublishRealTime;
        return new NotificationEventResponse(
            $"public:{messageUuid}:{FormatIso(occurredAt)}",
            NotificationKind.PUBLIC_MESSAGE,
            occurredAt,
            messageUuid,
            null,
            string.IsNullOrWhiteSpace(message.Title) ? "新公开消息" : message.Title.Trim(),
            string.IsNullOrWhiteSpace(message.Brief) ? SummarizeMessageContent(message.MsgContent) : message.Brief.Trim(),
            DisplayName(message.Sender));
    }

    private static NotificationEventResponse ToSecretMessageEvent(Message message, Guid receiverUuid, DateTime readableAt)
    {
        var messageUuid = message.Uuid.ToString("D");
        return new NotificationEventResponse(
            $"secret:{messageUuid}:{receiverUuid:D}:{FormatIso(readableAt)}",
            NotificationKind.SECRET_MESSAGE,
            readableAt,
            messageUuid,
            null,
            string.IsNullOrWhiteSpace(message.Title) ? "新的非对称消息" : message.Title.Trim(),
            string.IsNullOrWhiteSpace(message.Brief) ? SummarizeMessageContent(message.MsgContent) : message.Brief.Trim(),
            DisplayName(message.Sender));
    }

    private static NotificationEventResponse ToInstructionFeedbackEvent(Instruction instruction)
    {
        var instructionUuid = instruction.Uuid.ToString("D");
        var occurredAt = instruction.ReviewedRealTime ?? DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);
        return new NotificationEventResponse(
            $"instruction:{instructionUuid}:{FormatIso(occurredAt)}",
            NotificationKind.INSTRUCTION_FEEDBACK,
            occurredAt,
            null,
            instructionUuid,
            string.IsNullOrWhiteSpace(instruction.Title) ? "指令已反馈" : instruction.Title.Trim(),
            string.IsNullOrWhiteSpace(instruction.ReviewComment)
                ? "您的指令已收到反馈，点击查看详情。"
                : instruction.ReviewComment.Trim(),
            DisplayName(instruction.ReviewedByNavigation));
    }

    private static string? DisplayName(User? user)
    {
        if (user == null)
        {
            return null;
        }

        return !string.IsNullOrWhiteSpace(user.DisplayName) ? user.DisplayName.Trim() : user.Name;
    }

    private static string SummarizeMessageContent(string? content)
    {
        var normalized = content?.Trim() ?? string.Empty;
        if (normalized.Length == 0)
        {
            return "点击查看详情。";
        }

        return normalized.Length > BriefPreviewMaxLength
            ? $"{normalized[..BriefPreviewMaxLength]}..."
            : normalized;
    }

    private static string FormatIso(DateTime value)
    {
        return value.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture);
    }

    private static DateTime NowUtc()
    {
        return DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);
    }
}