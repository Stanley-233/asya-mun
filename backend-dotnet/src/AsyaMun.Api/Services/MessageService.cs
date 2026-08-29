using AsyaMun.Api.Data;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Errors;
using AsyaMun.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AsyaMun.Api.Services;

public class MessageService
{
    private readonly AppDbContext _db;
    private readonly NotificationService _notificationService;

    public MessageService(AppDbContext db, NotificationService notificationService)
    {
        _db = db;
        _notificationService = notificationService;
    }

    public async Task<MessageResponse> CreateMessageAsync(User sender, MessageCreateRequest request)
    {
        if (sender.ConferenceId == null)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Sender not associated with any conference");
        }

        var content = request.Content ?? string.Empty;
        var brief = string.IsNullOrWhiteSpace(request.Brief)
            ? (content.Length <= 30 ? content : content[..30])
            : request.Brief;

        var message = new Message
        {
            Uuid = Guid.NewGuid(),
            ConferenceId = sender.ConferenceId.Value,
            SenderId = sender.Uuid,
            Title = request.Title,
            Brief = brief,
            MsgContent = content,
            MsgType = request.MsgType,
            PublishRealTime = request.PublishRealTime ?? NowUtc(),
            PublishGameTime = request.PublishGameTime,
            IsSecret = request.IsSecret
        };

        if (request.IsSecret && request.ReceiverIds != null && request.ReceiverIds.Count > 0)
        {
            if (request.ReceiverIds.Any(r => r.DelayMinutes < 0))
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, "delayMinutes must be >= 0");
            }

            var receiverIds = ParseUuids(request.ReceiverIds.Select(r => r.ReceiverId), "Receiver");
            var receivers = await _db.Users.AsNoTracking()
                .Where(u => receiverIds.Contains(u.Uuid))
                .ToListAsync();

            var distinctReceiverIds = receiverIds.ToHashSet();
            if (receivers.Count != distinctReceiverIds.Count)
            {
                var foundIds = receivers.Select(u => u.Uuid).ToHashSet();
                var missing = distinctReceiverIds.Where(id => !foundIds.Contains(id)).ToList();
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Receiver not found: {string.Join(", ", missing)}");
            }

            var receiverMap = receivers.ToDictionary(r => r.Uuid);
            foreach (var item in request.ReceiverIds)
            {
                if (!Guid.TryParse(item.ReceiverId, out var receiverId) || !receiverMap.TryGetValue(receiverId, out var receiver))
                {
                    throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Receiver not found: {item.ReceiverId}");
                }

                message.MessageReceivers.Add(new MessageReceiver
                {
                    MessageId = message.Uuid,
                    UserId = receiver.Uuid,
                    ReadableAt = message.PublishRealTime.AddMinutes(item.DelayMinutes)
                });
            }
        }

        await using var transaction = await _db.Database.BeginTransactionAsync();

        _db.Messages.Add(message);
        await ApplyAttachmentsAsync(message, request.AttachmentUuids);
        await _db.SaveChangesAsync();
        await transaction.CommitAsync();

        var persisted = await _db.Messages.AsNoTracking()
            .Include(m => m.Sender)
            .Include(m => m.Attachments)
            .Include(m => m.MessageReceivers)
            .FirstAsync(m => m.Uuid == message.Uuid);

        await NotifyMessageChangedAsync(persisted, wasSecret: true);

        return ToResponse(persisted, false);
    }

    public async Task<MessageResponse> UpdateMessageAsync(Guid uuid, MessageUpdateRequest request)
    {
        var message = await _db.Messages
            .Include(m => m.Sender)
            .Include(m => m.Attachments)
            .Include(m => m.MessageReceivers)
            .FirstOrDefaultAsync(m => m.Uuid == uuid)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Message not found: {uuid}");

        var wasSecret = message.IsSecret;

        await using var transaction = await _db.Database.BeginTransactionAsync();

        if (request.Title != null) message.Title = request.Title;
        if (request.Content != null) message.MsgContent = request.Content;
        if (request.Brief != null) message.Brief = request.Brief;
        if (request.MsgType.HasValue) message.MsgType = request.MsgType;
        if (request.PublishRealTime.HasValue) message.PublishRealTime = request.PublishRealTime.Value;
        if (request.PublishGameTime != null) message.PublishGameTime = request.PublishGameTime;
        if (request.IsSecret.HasValue) message.IsSecret = request.IsSecret.Value;

        if (request.ReceiverIds != null)
        {
            var targetByReceiverId = ReadTargetReadableAtByReceiverId(request.ReceiverIds);
            var receiverIds = targetByReceiverId.Keys.ToList();
            var receivers = await _db.Users.AsNoTracking()
                .Where(u => receiverIds.Contains(u.Uuid))
                .ToListAsync();

            if (receivers.Count != receiverIds.Count)
            {
                var foundIds = receivers.Select(u => u.Uuid).ToHashSet();
                var missing = receiverIds.Where(id => !foundIds.Contains(id)).ToList();
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Receiver not found: {string.Join(", ", missing)}");
            }

            var receiverMap = receivers.ToDictionary(r => r.Uuid);
            var existingByReceiverId = message.MessageReceivers.ToDictionary(r => r.UserId);

            foreach (var (receiverId, readableAt) in targetByReceiverId)
            {
                if (existingByReceiverId.Remove(receiverId, out var existing))
                {
                    existing.ReadableAt = readableAt;
                }
                else
                {
                    if (!receiverMap.TryGetValue(receiverId, out var receiver))
                    {
                        throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Receiver not found: {receiverId}");
                    }

                    message.MessageReceivers.Add(new MessageReceiver
                    {
                        MessageId = message.Uuid,
                        UserId = receiver.Uuid,
                        ReadableAt = readableAt
                    });
                }
            }

            foreach (var stale in existingByReceiverId.Values)
            {
                message.MessageReceivers.Remove(stale);
                _db.MessageReceivers.Remove(stale);
            }
        }

        await ApplyAttachmentsAsync(message, request.AttachmentUuids);
        await _db.SaveChangesAsync();
        await transaction.CommitAsync();

        var persisted = await _db.Messages.AsNoTracking()
            .Include(m => m.Sender)
            .Include(m => m.Attachments)
            .Include(m => m.MessageReceivers)
            .FirstAsync(m => m.Uuid == message.Uuid);

        await NotifyMessageChangedAsync(persisted, wasSecret);

        return ToResponse(persisted, false);
    }

    public async Task<Page<MessageResponse>> GetMessagesForConferenceAsync(
        User requester,
        PageInput pageInput,
        string? keyword,
        CancellationToken ct = default)
    {
        if (requester.ConferenceId == null)
        {
            return EmptyPage<MessageResponse>(pageInput.Size);
        }

        IQueryable<Message> query = _db.Messages.AsNoTracking()
            .Include(m => m.Sender)
            .Where(m => m.ConferenceId == requester.ConferenceId.Value && !m.IsSecret);

        query = ApplyMessageKeyword(query, keyword);

        var page = await query.ToPageAsync(ApplyDefaultMessageSort(pageInput), ct);
        return Page<MessageResponse>.Of(
            page.Content.Select(m => ToResponse(m, true)).ToList(),
            page.Number,
            page.Size,
            page.TotalElements);
    }

    public async Task<Page<MessageResponse>> GetSecretMessagesForConferenceAsync(
        User requester,
        PageInput pageInput,
        Guid? senderId,
        Guid? receiverId,
        string? keyword,
        CancellationToken ct = default)
    {
        if (requester.ConferenceId == null)
        {
            return EmptyPage<MessageResponse>(pageInput.Size);
        }

        IQueryable<Message> query = _db.Messages.AsNoTracking()
            .Include(m => m.Sender)
            .Where(m => m.ConferenceId == requester.ConferenceId.Value && m.IsSecret);

        if (senderId.HasValue)
        {
            query = query.Where(m => m.SenderId == senderId.Value);
        }

        if (receiverId.HasValue)
        {
            query = query.Where(m => m.MessageReceivers.Any(r => r.UserId == receiverId.Value));
        }

        query = ApplyMessageKeyword(query, keyword);

        var page = await query.ToPageAsync(ApplyDefaultMessageSort(pageInput), ct);
        return Page<MessageResponse>.Of(
            page.Content.Select(m => ToResponse(m, true)).ToList(),
            page.Number,
            page.Size,
            page.TotalElements);
    }

    public async Task<Page<MessageResponse>> GetSecretMessagesForUserAsync(
        User requester,
        PageInput pageInput,
        string? keyword,
        CancellationToken ct = default)
    {
        var now = NowUtc();

        IQueryable<Message> query = _db.Messages.AsNoTracking()
            .Include(m => m.Sender)
            .Where(m => m.IsSecret && m.MessageReceivers.Any(r => r.UserId == requester.Uuid && r.ReadableAt <= now));

        query = ApplyMessageKeyword(query, keyword);

        var page = await query.ToPageAsync(ApplyDefaultMessageSort(pageInput), ct);
        return Page<MessageResponse>.Of(
            page.Content.Select(m => ToResponse(m, true)).ToList(),
            page.Number,
            page.Size,
            page.TotalElements);
    }

    public async Task<MessageResponse> GetMessageAsync(Guid uuid, User requester, CancellationToken ct = default)
    {
        var message = await _db.Messages.AsNoTracking()
            .Include(m => m.Sender)
            .Include(m => m.Attachments)
            .Include(m => m.MessageReceivers)
            .FirstOrDefaultAsync(m => m.Uuid == uuid, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Message not found: {uuid}");

        if (message.IsSecret)
        {
            var isPrivileged = requester.Role is (UserRole.DH or UserRole.DM or UserRole.SYS_ADMIN);
            if (!isPrivileged)
            {
                var receiver = message.MessageReceivers.FirstOrDefault(r => r.UserId == requester.Uuid);
                var canReadByTime = receiver != null && receiver.ReadableAt <= NowUtc();
                var isSender = message.SenderId == requester.Uuid;
                if (!canReadByTime && !isSender)
                {
                    throw new ForbiddenException("Access denied for secret message");
                }
            }
        }

        return ToResponse(message, false);
    }

    public async Task<List<MessageReceiverVisibilityResponse>> GetMessageReceiversAsync(Guid uuid, CancellationToken ct = default)
    {
        var message = await _db.Messages.AsNoTracking()
            .Include(m => m.MessageReceivers)
            .ThenInclude(r => r.User)
            .FirstOrDefaultAsync(m => m.Uuid == uuid, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Message not found: {uuid}");

        var receivers = new List<MessageReceiverVisibilityResponse>();
        foreach (var mapping in message.MessageReceivers)
        {
            if (mapping.User == null)
            {
                continue;
            }

            receivers.Add(new MessageReceiverVisibilityResponse(
                mapping.User.Uuid.ToString("D"),
                mapping.User.Name,
                mapping.User.DisplayName,
                mapping.User.Role,
                mapping.ReadableAt));
        }

        return receivers;
    }

    public async Task DeleteMessageAsync(Guid uuid, CancellationToken ct = default)
    {
        var message = await _db.Messages
            .Include(m => m.MessageReceivers)
            .FirstOrDefaultAsync(m => m.Uuid == uuid, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Message not found: {uuid}");

        _db.MessageReceivers.RemoveRange(message.MessageReceivers);
        _db.Messages.Remove(message);
        await _db.SaveChangesAsync(ct);
    }

    private async Task NotifyMessageChangedAsync(Message message, bool wasSecret = false)
    {
        if (message.IsSecret)
        {
            await _notificationService.NotifyReadableSecretReceiversAsync(message);
            return;
        }

        if (wasSecret)
        {
            await _notificationService.NotifyPublicMessageAsync(message);
        }
    }

    private async Task ApplyAttachmentsAsync(Message message, List<string>? attachmentUuids, CancellationToken ct = default)
    {
        if (attachmentUuids == null)
        {
            return;
        }

        var targetUuids = ParseUuids(attachmentUuids, "Attachment").ToHashSet();
        var hasChange = false;

        foreach (var existing in message.Attachments.ToList())
        {
            if (!targetUuids.Contains(existing.Uuid))
            {
                message.Attachments.Remove(existing);
                existing.MessageId = null;
                existing.TargetType = null;
                existing.TargetId = null;
                hasChange = true;
            }
        }

        if (targetUuids.Count > 0)
        {
            var fetched = await _db.Attachments.Where(a => targetUuids.Contains(a.Uuid)).ToListAsync(ct);
            if (fetched.Count != targetUuids.Count)
            {
                var foundIds = fetched.Select(a => a.Uuid).ToHashSet();
                var missing = targetUuids.Where(id => !foundIds.Contains(id)).ToList();
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Attachment not found: {string.Join(", ", missing)}");
            }

            foreach (var attachment in fetched)
            {
                if (attachment.MessageId != null && attachment.MessageId != message.Uuid)
                {
                    throw new AsyaBusinessException(
                        BizCode.PARAM_ERROR,
                        $"Attachment already bound to another message: {attachment.Uuid}");
                }

                if (message.Attachments.All(a => a.Uuid != attachment.Uuid))
                {
                    attachment.MessageId = message.Uuid;
                    attachment.TargetType = AttachmentTargetType.MESSAGE;
                    attachment.TargetId = message.Uuid;
                    message.Attachments.Add(attachment);
                    hasChange = true;
                }
            }
        }

        if (hasChange)
        {
            await _db.SaveChangesAsync(ct);
        }
    }

    private static Dictionary<Guid, DateTime> ReadTargetReadableAtByReceiverId(IEnumerable<MessageReceiverReadableAtItem> items)
    {
        var result = new Dictionary<Guid, DateTime>();
        foreach (var item in items)
        {
            if (!Guid.TryParse(item.ReceiverId, out var receiverId))
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Invalid receiverId: {item.ReceiverId}");
            }

            result[receiverId] = item.ReadableAt;
        }

        return result;
    }

    private static List<Guid> ParseUuids(IEnumerable<string> uuidStrings, string label)
    {
        var ids = new List<Guid>();
        foreach (var uuidString in uuidStrings)
        {
            if (!Guid.TryParse(uuidString, out var id))
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Invalid {label} uuid: {uuidString}");
            }

            ids.Add(id);
        }

        return ids;
    }

    private static IQueryable<Message> ApplyMessageKeyword(IQueryable<Message> query, string? keyword)
    {
        var normalized = keyword?.Trim();
        if (string.IsNullOrEmpty(normalized))
        {
            return query;
        }

        var kw = normalized.ToLowerInvariant();
        return query.Where(m =>
            (m.Title != null && m.Title.ToLower().Contains(kw)) ||
            (m.MsgContent != null && m.MsgContent.ToLower().Contains(kw)));
    }

    private static PageInput ApplyDefaultMessageSort(PageInput input)
    {
        return input.Sort.Count == 0
            ? new PageInput
            {
                Page = input.Page,
                Size = input.Size,
                Sort = new List<SortSpec> { new("PublishRealTime", true) }
            }
            : input;
    }

    private static MessageResponse ToResponse(Message message, bool omitContent)
    {
        return new MessageResponse(
            message.Uuid.ToString("D"),
            message.ConferenceId.ToString("D"),
            message.SenderId?.ToString("D"),
            message.Sender?.Name,
            message.Sender?.DisplayName,
            message.Title,
            message.Brief,
            omitContent ? null : message.MsgContent,
            message.MsgType,
            message.PublishRealTime,
            message.PublishGameTime,
            message.IsSecret,
            omitContent ? null : message.Attachments.Count > 0,
            omitContent ? null : message.Attachments.Select(a => a.Uuid.ToString("D")).ToList());
    }

    private static Page<T> EmptyPage<T>(int size)
    {
        return Page<T>.Of(new List<T>(), 0, size, 0);
    }

    private static DateTime NowUtc()
    {
        return DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);
    }
}