using System.Data;
using AsyaMun.Api.Data;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Errors;
using AsyaMun.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AsyaMun.Api.Services;

public class RoundService
{
    private readonly AppDbContext _db;
    private readonly ILogger<RoundService> _logger;

    public RoundService(AppDbContext db, ILogger<RoundService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<RoundResponse> PublishRoundAsync(RoundPublishRequest request, Guid conferenceUuid)
    {
        return await ExecuteAsync(async () =>
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                throw AsyaBusinessException.ParamError("Round name cannot be blank");
            }

            if (request.DurationSeconds <= 0)
            {
                throw AsyaBusinessException.ParamError("durationSeconds must be greater than 0");
            }

            var conferenceExists = await _db.Conferences.AsNoTracking().AnyAsync(c => c.Uuid == conferenceUuid);
            if (!conferenceExists)
            {
                throw AsyaBusinessException.ParamError($"Conference not found: {conferenceUuid}");
            }

            var nextRoundId = await ParseNextRoundAsync(request.NextRoundId, conferenceUuid);
            var now = NowUtc();

            await ClearCurrentRoundsAsync(conferenceUuid);

            var round = new Round
            {
                ConferenceId = conferenceUuid,
                Name = request.Name.Trim(),
                DurationSeconds = request.DurationSeconds,
                RemainingSeconds = request.DurationSeconds,
                Status = request.InitialStatus,
                IsCurrent = true,
                EndAt = request.InitialStatus == RoundStatus.RUNNING
                    ? now.AddSeconds(request.DurationSeconds)
                    : null,
                UpdatedAt = now,
                NextRoundId = nextRoundId
            };

            _db.Rounds.Add(round);
            await _db.SaveChangesAsync();

            return ToResponse(round, now);
        });
    }

    public async Task<RoundResponse> SetNextRoundAsync(Guid roundUuid, RoundSetNextRequest request, Guid conferenceUuid)
    {
        return await ExecuteAsync(async () =>
        {
            var round = await FindByUuidAndConferenceAsync(roundUuid, conferenceUuid)
                ?? throw AsyaBusinessException.ParamError($"Round not found: {roundUuid}");

            round.NextRoundId = await ParseNextRoundAsync(request.NextRoundId, conferenceUuid);
            round.UpdatedAt = NowUtc();
            await _db.SaveChangesAsync();

            return ToResponse(round, NowUtc());
        });
    }

    public async Task<RoundResponse> UpdateRoundAsync(Guid roundUuid, RoundUpdateRequest request, Guid conferenceUuid)
    {
        return await ExecuteAsync(async () =>
        {
            await AdvanceIfExpiredAsync(conferenceUuid);

            var round = await FindByUuidAndConferenceAsync(roundUuid, conferenceUuid)
                ?? throw AsyaBusinessException.ParamError($"Round not found: {roundUuid}");

            return await UpdateRoundCoreAsync(round, request);
        });
    }

    public async Task<RoundResponse> SetCurrentRoundAsync(RoundSetCurrentRequest request, Guid conferenceUuid)
    {
        return await ExecuteAsync(async () =>
        {
            await AdvanceIfExpiredAsync(conferenceUuid);

            if (!Guid.TryParse(request.RoundId, out var targetRoundUuid))
            {
                throw AsyaBusinessException.ParamError("Invalid roundId");
            }

            var now = NowUtc();

            var target = await FindByUuidAndConferenceAsync(targetRoundUuid, conferenceUuid)
                ?? throw AsyaBusinessException.ParamError($"Round not found: {targetRoundUuid}");

            var current = await FindCurrentAsync(conferenceUuid);
            if (current?.Uuid == target.Uuid)
            {
                return ToResponse(target, now);
            }

            if (current != null)
            {
                current.IsCurrent = false;
                if (current.Status == RoundStatus.RUNNING)
                {
                    current.RemainingSeconds = RemainingSeconds(current, now);
                    current.Status = RoundStatus.PAUSED;
                    current.EndAt = null;
                }

                current.UpdatedAt = now;
            }

            target.IsCurrent = true;
            target.EndAt = target.Status == RoundStatus.RUNNING
                ? now.AddSeconds(target.RemainingSeconds)
                : null;
            target.UpdatedAt = now;

            await _db.SaveChangesAsync();

            return ToResponse(target, now);
        });
    }

    public async Task<RoundResponse> SetRoundRemainingAsync(Guid roundUuid, RoundSetRemainingRequest request, Guid conferenceUuid)
    {
        return await ExecuteAsync(async () =>
        {
            if (request.RemainingSeconds < 0)
            {
                throw AsyaBusinessException.ParamError("remainingSeconds must be greater than or equal to 0");
            }

            await AdvanceIfExpiredAsync(conferenceUuid);

            var round = await FindByUuidAndConferenceAsync(roundUuid, conferenceUuid)
                ?? throw AsyaBusinessException.ParamError($"Round not found: {roundUuid}");

            var now = NowUtc();
            round.RemainingSeconds = request.RemainingSeconds;
            round.EndAt = round.Status == RoundStatus.RUNNING
                ? now.AddSeconds(request.RemainingSeconds)
                : null;
            round.UpdatedAt = now;
            await _db.SaveChangesAsync();

            return ToResponse(round, now);
        });
    }

    public async Task<RoundResponse> PauseRoundAsync(Guid roundUuid, Guid conferenceUuid)
    {
        return await ExecuteAsync(async () =>
        {
            await AdvanceIfExpiredAsync(conferenceUuid);

            var current = await FindCurrentAsync(conferenceUuid)
                ?? throw new InvalidOperationException("No current round");
            if (current.Uuid != roundUuid)
            {
                throw AsyaBusinessException.ParamError("Only current round can be paused");
            }

            if (current.Status != RoundStatus.RUNNING)
            {
                throw AsyaBusinessException.ParamError("Round is not running");
            }

            var now = NowUtc();
            current.RemainingSeconds = RemainingSeconds(current, now);
            current.Status = RoundStatus.PAUSED;
            current.EndAt = null;
            current.UpdatedAt = now;
            await _db.SaveChangesAsync();

            return ToResponse(current, now);
        });
    }

    public async Task<RoundResponse> ResumeRoundAsync(Guid roundUuid, Guid conferenceUuid)
    {
        return await ExecuteAsync(async () =>
        {
            await AdvanceIfExpiredAsync(conferenceUuid);

            var current = await FindCurrentAsync(conferenceUuid)
                ?? throw new InvalidOperationException("No current round");
            if (current.Uuid != roundUuid)
            {
                throw AsyaBusinessException.ParamError("Only current round can be resumed");
            }

            if (current.Status != RoundStatus.PAUSED)
            {
                throw AsyaBusinessException.ParamError("Round is not paused");
            }

            var now = NowUtc();
            if (current.RemainingSeconds <= 0)
            {
                current.RemainingSeconds = current.DurationSeconds;
            }

            current.Status = RoundStatus.RUNNING;
            current.EndAt = now.AddSeconds(current.RemainingSeconds);
            current.UpdatedAt = now;
            await _db.SaveChangesAsync();

            return ToResponse(current, now);
        });
    }

    public async Task<List<RoundResponse>> ListRoundsAsync(Guid conferenceUuid)
    {
        var now = NowUtc();
        var rounds = await _db.Rounds.AsNoTracking()
            .Where(r => r.ConferenceId == conferenceUuid)
            .OrderByDescending(r => r.UpdatedAt)
            .ToListAsync();

        return rounds.Select(r => ToResponse(r, now)).ToList();
    }

    public async Task<RoundResponse> GetRoundDetailAsync(Guid roundUuid, Guid conferenceUuid)
    {
        return await ExecuteAsync(async () =>
        {
            await AdvanceIfExpiredAsync(conferenceUuid);

            var round = await FindByUuidAndConferenceAsync(roundUuid, conferenceUuid)
                ?? throw AsyaBusinessException.ParamError($"Round not found: {roundUuid}");

            return ToResponse(round, NowUtc());
        });
    }

    public async Task<RoundResponse?> GetCurrentRoundAsync(Guid conferenceUuid)
    {
        return await ExecuteAsync(async () =>
        {
            await AdvanceIfExpiredAsync(conferenceUuid);

            var now = NowUtc();
            var round = await _db.Rounds.AsNoTracking()
                .FirstOrDefaultAsync(r => r.ConferenceId == conferenceUuid && r.IsCurrent);

            return round == null ? null : ToResponse(round, now);
        });
    }

    public async Task<RoundResponse?> AdvanceIfExpiredAsync(Guid conferenceUuid)
    {
        return await ExecuteAsync(async () =>
        {
            var now = NowUtc();
            var current = await FindCurrentAsync(conferenceUuid);
            if (current == null)
            {
                return null;
            }

            if (current.Status != RoundStatus.RUNNING || current.EndAt == null || current.EndAt.Value > now)
            {
                return ToResponse(current, now);
            }

            current.IsCurrent = false;
            current.Status = RoundStatus.PAUSED;
            current.RemainingSeconds = 0;
            current.EndAt = null;
            current.UpdatedAt = now;
            await _db.SaveChangesAsync();

            var nextRoundId = current.NextRoundId;
            if (nextRoundId == null)
            {
                return null;
            }

            var nextRound = await FindByUuidAndConferenceAsync(nextRoundId.Value, conferenceUuid)
                ?? throw new InvalidOperationException($"Next round not found in same conference: {nextRoundId}");

            await ClearCurrentRoundsAsync(conferenceUuid);

            nextRound.IsCurrent = true;
            nextRound.Status = RoundStatus.RUNNING;
            nextRound.RemainingSeconds = nextRound.DurationSeconds;
            nextRound.EndAt = now.AddSeconds(nextRound.DurationSeconds);
            nextRound.UpdatedAt = now;
            await _db.SaveChangesAsync();

            return ToResponse(nextRound, now);
        });
    }

    public async Task AdvanceExpiredRoundsAsync()
    {
        var now = NowUtc();
        var conferenceIds = await _db.Rounds.AsNoTracking()
            .Where(r => r.IsCurrent
                && r.Status == RoundStatus.RUNNING
                && r.EndAt != null
                && r.EndAt <= now)
            .Select(r => r.ConferenceId)
            .Distinct()
            .ToListAsync();

        foreach (var conferenceId in conferenceIds)
        {
            try
            {
                await AdvanceIfExpiredAsync(conferenceId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to auto advance round for conference {ConferenceId}", conferenceId);
            }
        }
    }

    private async Task<Guid?> ParseNextRoundAsync(string? nextRoundId, Guid conferenceUuid)
    {
        if (string.IsNullOrWhiteSpace(nextRoundId))
        {
            return null;
        }

        if (!Guid.TryParse(nextRoundId, out var nextUuid))
        {
            throw AsyaBusinessException.ParamError("Invalid nextRoundId");
        }

        var exists = await _db.Rounds.AsNoTracking()
            .AnyAsync(r => r.Uuid == nextUuid && r.ConferenceId == conferenceUuid);
        if (!exists)
        {
            throw AsyaBusinessException.ParamError("nextRoundId not found in current conference");
        }

        return nextUuid;
    }

    private async Task<RoundResponse> UpdateRoundCoreAsync(Round round, RoundUpdateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw AsyaBusinessException.ParamError("Round name cannot be blank");
        }

        if (request.DurationSeconds <= 0)
        {
            throw AsyaBusinessException.ParamError("durationSeconds must be greater than 0");
        }

        var now = NowUtc();
        var currentRemaining = RemainingSeconds(round, now);
        var elapsedSeconds = Math.Max(0, round.DurationSeconds - currentRemaining);
        var newRemainingSeconds = Math.Max(0, request.DurationSeconds - elapsedSeconds);

        round.Name = request.Name.Trim();
        round.DurationSeconds = request.DurationSeconds;
        round.RemainingSeconds = newRemainingSeconds;
        round.UpdatedAt = now;

        if (round.Status == RoundStatus.RUNNING)
        {
            round.EndAt = now.AddSeconds(newRemainingSeconds);
        }

        if (round.Status == RoundStatus.PAUSED)
        {
            round.EndAt = null;
        }

        await _db.SaveChangesAsync();

        return ToResponse(round, now);
    }

    private long RemainingSeconds(Round round, DateTime now)
    {
        if (round.Status == RoundStatus.PAUSED)
        {
            return round.RemainingSeconds;
        }

        if (round.EndAt == null)
        {
            return round.RemainingSeconds;
        }

        var seconds = (long)((round.EndAt.Value - now).TotalSeconds);
        return Math.Max(0, seconds);
    }

    private RoundResponse ToResponse(Round round, DateTime now)
    {
        return new RoundResponse(
            round.Uuid.ToString("D"),
            round.ConferenceId.ToString("D"),
            round.Name,
            round.DurationSeconds,
            RemainingSeconds(round, now),
            round.Status,
            round.IsCurrent,
            round.NextRoundId?.ToString("D"),
            round.EndAt,
            now);
    }

    private async Task<Round?> FindByUuidAndConferenceAsync(Guid roundUuid, Guid conferenceUuid)
    {
        return await _db.Rounds.FirstOrDefaultAsync(r => r.Uuid == roundUuid && r.ConferenceId == conferenceUuid);
    }

    private async Task<Round?> FindCurrentAsync(Guid conferenceUuid)
    {
        return await _db.Rounds.FirstOrDefaultAsync(r => r.ConferenceId == conferenceUuid && r.IsCurrent);
    }

    private Task<int> ClearCurrentRoundsAsync(Guid conferenceUuid)
    {
        return _db.Rounds
            .Where(r => r.ConferenceId == conferenceUuid && r.IsCurrent)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.IsCurrent, false));
    }

    private async Task<T> ExecuteAsync<T>(Func<Task<T>> action)
    {
        if (_db.Database.CurrentTransaction != null)
        {
            return await action();
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var result = await action();
        await transaction.CommitAsync();
        return result;
    }

    private static DateTime NowUtc()
    {
        return DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);
    }
}