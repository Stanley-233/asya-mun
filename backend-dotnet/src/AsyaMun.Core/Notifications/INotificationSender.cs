namespace AsyaMun.Core.Notifications;

public interface INotificationSender
{
    Task SendAsync(IReadOnlyList<string> userIds, NotificationEventResponse notification,
        CancellationToken cancellationToken = default);
}
