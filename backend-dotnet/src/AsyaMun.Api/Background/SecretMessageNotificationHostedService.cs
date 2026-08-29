namespace AsyaMun.Api.Background;

using AsyaMun.Api.Services;

public class SecretMessageNotificationHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SecretMessageNotificationHostedService> _logger;
    private readonly TimeSpan _interval;
    private DateTime _lastScanAt;

    public SecretMessageNotificationHostedService(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<SecretMessageNotificationHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        var seconds = configuration.GetValue("Background:SecretMessageNotificationIntervalSeconds", 5);
        _interval = TimeSpan.FromSeconds(Math.Max(1, seconds));
        _lastScanAt = NowUtc();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(_interval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            var now = NowUtc();
            var after = _lastScanAt;
            _lastScanAt = now;

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var notificationService = scope.ServiceProvider.GetRequiredService<NotificationService>();
                await notificationService.NotifyReadableSecretMessagesBetweenAsync(after, now);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Secret message notification scan tick failed");
            }
        }
    }

    private static DateTime NowUtc()
    {
        return DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);
    }
}