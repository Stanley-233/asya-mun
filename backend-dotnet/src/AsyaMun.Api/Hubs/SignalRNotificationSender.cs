using AsyaMun.Core.Notifications;
using Microsoft.AspNetCore.SignalR;

namespace AsyaMun.Api.Hubs;

public sealed class SignalRNotificationSender(IHubContext<NotificationHub> hub) : INotificationSender
{
    public Task SendAsync(IReadOnlyList<string> userIds, NotificationEventResponse notification,
        CancellationToken cancellationToken = default)
        => hub.Clients.Users(userIds).SendAsync("Notification", notification, cancellationToken);
}
