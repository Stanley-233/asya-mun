using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace AsyaMun.Api.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    private readonly ILogger<NotificationHub> _logger;

    public NotificationHub(ILogger<NotificationHub> logger)
    {
        _logger = logger;
    }

    public override Task OnConnectedAsync()
    {
        var identity = Context.User;
        _logger.LogInformation(
            "NotificationHub connected, connectionId={ConnectionId}, userUuid={UserUuid}",
            Context.ConnectionId,
            identity?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value);

        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation(
            "NotificationHub disconnected, connectionId={ConnectionId}",
            Context.ConnectionId);

        return base.OnDisconnectedAsync(exception);
    }
}