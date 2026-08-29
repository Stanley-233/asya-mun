using AsyaMun.Api.Models;

namespace AsyaMun.Api.Dtos;

public record RoundPublishRequest(
    string Name,
    long DurationSeconds,
    RoundStatus InitialStatus,
    string? NextRoundId = null);

public record RoundSetNextRequest(string? NextRoundId = null);

public record RoundUpdateRequest(string Name, long DurationSeconds);

public record RoundSetCurrentRequest(string RoundId);

public record RoundSetRemainingRequest(long RemainingSeconds);

public record RoundResponse(
    string RoundId,
    string ConferenceId,
    string Name,
    long DurationSeconds,
    long RemainingSeconds,
    RoundStatus Status,
    bool IsCurrent,
    string? NextRoundId,
    DateTime? EndAt,
    DateTime ServerTime);