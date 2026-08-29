using System.Data;
using AsyaMun.Api.Data;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Errors;
using AsyaMun.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AsyaMun.Api.Services;

public class TimeService
{
    private readonly AppDbContext _db;

    public TimeService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<TimeAnchorResponse>> GetAllTimeAnchorsAsync(Guid conferenceUuid)
    {
        var anchors = await _db.TimeAnchors.AsNoTracking()
            .Where(a => a.ConferenceId == conferenceUuid)
            .OrderBy(a => a.Id)
            .ToListAsync();

        return anchors.Select(TimeAnchorResponse.From).ToList();
    }

    public async Task<TimeAnchorResponse?> GetLatestTimeAnchorAsync(Guid conferenceUuid)
    {
        var conferenceExists = await _db.Conferences.AsNoTracking().AnyAsync(c => c.Uuid == conferenceUuid);
        if (!conferenceExists)
        {
            return null;
        }

        var anchor = await _db.TimeAnchors.AsNoTracking()
            .FirstOrDefaultAsync(a => a.ConferenceId == conferenceUuid && a.IsCurrent)
            ?? await _db.TimeAnchors.AsNoTracking()
                .Where(a => a.ConferenceId == conferenceUuid)
                .OrderByDescending(a => a.Id)
                .FirstOrDefaultAsync();

        return anchor == null ? null : TimeAnchorResponse.From(anchor);
    }

    public async Task<TimeAnchorResponse> UpdateTimeAnchorAsync(TimeUpdateRequest request, Guid conferenceUuid)
    {
        return await ExecuteAsync(async () =>
        {
            var conferenceExists = await _db.Conferences.AsNoTracking().AnyAsync(c => c.Uuid == conferenceUuid);
            if (!conferenceExists)
            {
                throw AsyaBusinessException.ParamError($"Conference not found: {conferenceUuid}");
            }

            var lastAnchor = await _db.TimeAnchors.AsNoTracking()
                .Where(a => a.ConferenceId == conferenceUuid)
                .OrderByDescending(a => a.Id)
                .FirstOrDefaultAsync();

            var now = NowUtc();

            string baseGameTime;
            if (lastAnchor != null
                && lastAnchor.AnchorRealTime.HasValue
                && lastAnchor.AnchorGameTime != null
                && lastAnchor.TimeRatio.HasValue)
            {
                var elapsedSeconds = (long)(now - lastAnchor.AnchorRealTime.Value).TotalSeconds;
                var gameSeconds = (long)(elapsedSeconds * (double)lastAnchor.TimeRatio.Value);
                baseGameTime = GameTimeString.PlusSeconds(lastAnchor.AnchorGameTime, gameSeconds);
            }
            else
            {
                baseGameTime = GameTimeString.FromNow(now);
            }

            await ClearCurrentAnchorsAsync(conferenceUuid);

            var newAnchor = new TimeAnchor
            {
                ConferenceId = conferenceUuid,
                UpdateTime = now,
                AnchorRealTime = now,
                AnchorGameTime = baseGameTime,
                TimeRatio = request.TimeRatio,
                IsCurrent = true
            };

            _db.TimeAnchors.Add(newAnchor);
            await _db.SaveChangesAsync();

            return TimeAnchorResponse.From(newAnchor);
        });
    }

    public async Task<TimeAnchorResponse> JumpTimeAnchorAsync(TimeJumpRequest request, Guid conferenceUuid)
    {
        return await ExecuteAsync(async () =>
        {
            var conferenceExists = await _db.Conferences.AsNoTracking().AnyAsync(c => c.Uuid == conferenceUuid);
            if (!conferenceExists)
            {
                throw AsyaBusinessException.ParamError($"Conference not found: {conferenceUuid}");
            }

            var now = NowUtc();

            await ClearCurrentAnchorsAsync(conferenceUuid);

            var newAnchor = new TimeAnchor
            {
                ConferenceId = conferenceUuid,
                UpdateTime = now,
                AnchorRealTime = now,
                AnchorGameTime = GameTimeString.Normalize(request.TargetGameTime),
                TimeRatio = request.TimeRatio,
                IsCurrent = true
            };

            _db.TimeAnchors.Add(newAnchor);
            await _db.SaveChangesAsync();

            return TimeAnchorResponse.From(newAnchor);
        });
    }

    public async Task<string?> GetCurrentGameTimeAsync(Guid conferenceUuid)
    {
        var conferenceExists = await _db.Conferences.AsNoTracking().AnyAsync(c => c.Uuid == conferenceUuid);
        if (!conferenceExists)
        {
            return null;
        }

        var anchor = await _db.TimeAnchors.AsNoTracking()
            .FirstOrDefaultAsync(a => a.ConferenceId == conferenceUuid && a.IsCurrent)
            ?? await _db.TimeAnchors.AsNoTracking()
                .Where(a => a.ConferenceId == conferenceUuid)
                .OrderByDescending(a => a.Id)
                .FirstOrDefaultAsync();

        if (anchor == null)
        {
            return null;
        }

        if (!anchor.TimeRatio.HasValue)
        {
            return GameTimeString.Normalize(anchor.AnchorGameTime);
        }

        var ratio = (double)anchor.TimeRatio.Value;
        if (ratio == 0.0)
        {
            return GameTimeString.Normalize(anchor.AnchorGameTime);
        }

        var now = NowUtc();
        if (!anchor.AnchorRealTime.HasValue || anchor.AnchorGameTime == null)
        {
            return GameTimeString.Normalize(anchor.AnchorGameTime);
        }

        var elapsedSeconds = (long)(now - anchor.AnchorRealTime.Value).TotalSeconds;
        var gameSeconds = (long)(elapsedSeconds * ratio);

        return GameTimeString.PlusSeconds(anchor.AnchorGameTime, gameSeconds);
    }

    private Task<int> ClearCurrentAnchorsAsync(Guid conferenceUuid)
    {
        return _db.TimeAnchors
            .Where(a => a.ConferenceId == conferenceUuid && a.IsCurrent)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.IsCurrent, false));
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