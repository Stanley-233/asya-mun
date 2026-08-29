using AsyaMun.Api.Models;

namespace AsyaMun.Api.Dtos;

public record UserRegistrationRequest(string Name, string? DisplayName, string Password, UserRole Role);

public record UserResponse(string Uuid, string Name, string? DisplayName, UserRole Role, string Token);

public record TokenRefreshResponse(string Token);

public record BatchRegisterUserItem(string Name, string? DisplayName, string Password);

public record BatchRegisterRequest(string ConferenceId, List<BatchRegisterUserItem> Users);

public record BatchRegisterFullUserItem(string Name, string? DisplayName, string Password, UserRole Role, string? GroupName);

public record BatchRegisterFullRequest(string ConferenceId, List<BatchRegisterFullUserItem> Users);

public record BatchRegisterResponse(int SuccessCount, List<UserInfoResponse> CreatedUsers);

public record UserInfoResponse(
    string Uuid,
    string Name,
    string? DisplayName,
    UserRole Role,
    string? ConferenceUuid,
    string? ConferenceName)
{
    public static UserInfoResponse From(User user)
    {
        return new UserInfoResponse(
            user.Uuid.ToString("D"),
            user.Name,
            user.DisplayName,
            user.Role,
            user.ConferenceId?.ToString("D"),
            user.Conference?.Name);
    }
}

public record UserUpdateRequest(string? Name, string? DisplayName, string? Password, UserRole? Role);