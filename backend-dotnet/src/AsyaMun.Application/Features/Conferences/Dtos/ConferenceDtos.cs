using AsyaMun.Core.Models;

namespace AsyaMun.Application.Dtos;

public record ConferenceRequest(string Name, string Description, ConferenceStatus? Status);

public record ConferenceResponse(
    string Uuid,
    string Name,
    string Description,
    ConferenceStatus Status,
    bool InstructionSubmissionPaused = false);

public record ConferenceAssignRequest(string ConferenceUuid, string UserUuid);