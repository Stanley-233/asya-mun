namespace AsyaMun.Api.Background;

using AsyaMun.Api.Services;

public class RoundAutoAdvanceHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RoundAutoAdvanceHostedService> _logger;
    private readonly TimeSpan _interval;

    public RoundAutoAdvanceHostedService(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<RoundAutoAdvanceHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        var seconds = configuration.GetValue("Background:RoundAdvanceIntervalSeconds", 1);
        _interval = TimeSpan.FromSeconds(Math.Max(1, seconds));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(_interval);
        using var gate = new SemaphoreSlim(1, 1);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            if (!await gate.WaitAsync(0, stoppingToken))
            {
                continue;
            }

            try
            {
                using var scope = _scopeFactory.CreateScope();
                var roundService = scope.ServiceProvider.GetRequiredService<RoundService>();
                await roundService.AdvanceExpiredRoundsAsync();
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Round auto advance tick failed");
            }
            finally
            {
                gate.Release();
            }
        }
    }
}