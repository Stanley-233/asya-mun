using AsyaMun.Api.Models;

namespace AsyaMun.Api.Dtos;

public record InstructionCreateRequest(
    string Title,
    InstructionType InstructionType,
    string Content);

public record InstructionReviewRequest(
    InstructionStatus Status,
    string? ReviewComment = null);

public record InstructionSubmissionSwitchRequest(bool? Paused = null);

public record InstructionResponse(
    string Uuid,
    string ConferenceId,
    string SubmitterId,
    string SubmitterName,
    string Title,
    InstructionType InstructionType,
    string Content,
    InstructionStatus Status,
    string? ReviewComment,
    DateTime SubmitRealTime,
    string SubmitGameTime,
    string? ReviewedById,
    string? ReviewedByName,
    DateTime? ReviewedRealTime,
    string? ReviewedGameTime);