using AsyaMun.Core.Models;

namespace AsyaMun.Application.Dtos;

public record TestDataUserResponse(
    string Uuid,
    string Name,
    string? DisplayName,
    UserRole Role,
    string Password,
    string Token);

public record TestDataBootstrapResponse(
    string ConferenceUuid,
    string ConferenceName,
    List<TestDataUserResponse> Users,
    int PublicMessageCount,
    int SecretMessageCount,
    int SecretMessagesForA,
    int SecretMessagesForB,
    int InstructionCountFromA,
    string TimeRatio);