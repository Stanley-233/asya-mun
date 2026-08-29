using AsyaMun.Api.Auth;
using AsyaMun.Api.Data;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Errors;
using AsyaMun.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AsyaMun.Api.Services;

public record AuthenticatedUserResponse(UserResponse Response, string RefreshToken);

public record TokenRefreshResult(TokenRefreshResponse Response, string RefreshToken);

public class UserService
{
    private readonly AppDbContext _db;
    private readonly SystemConfigService _systemConfigService;

    public UserService(AppDbContext db, SystemConfigService systemConfigService)
    {
        _db = db;
        _systemConfigService = systemConfigService;
    }

    public async Task<bool> HasSysAdminAsync()
    {
        return await _db.Users.AsNoTracking().AnyAsync(u => u.Role == UserRole.SYS_ADMIN);
    }

    public async Task<bool> IsRegistrationAvailableAsync()
    {
        return !await HasSysAdminAsync() || await _systemConfigService.IsRegistrationAllowedAsync();
    }

    public async Task<AuthenticatedUserResponse> RegisterUserAsync(UserRegistrationRequest request)
    {
        if (!await IsRegistrationAvailableAsync())
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "系统当前禁止新用户注册");
        }

        var existing = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Name == request.Name);
        if (existing != null)
        {
            throw new AsyaBusinessException(BizCode.USER_EXISTS, $"用户已存在: {request.Name}");
        }

        if (request.Role == UserRole.SYS_ADMIN && await HasSysAdminAsync())
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "已经存在系统管理员，禁止重复注册");
        }

        var user = new User
        {
            Name = request.Name,
            DisplayName = request.DisplayName,
            Password = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = request.Role,
            AuthVersion = 0
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return IssueAuthenticatedUserResponse(user);
    }

    public async Task<AuthenticatedUserResponse> LoginUserAsync(UserRegistrationRequest request)
    {
        var user = await _db.Users
            .Include(u => u.Conference)
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Name == request.Name);

        if (user == null)
        {
            throw new AsyaBusinessException(BizCode.USER_NOT_FOUND, "系统中还没有该用户，请先完成注册");
        }

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.Password))
        {
            throw new AsyaBusinessException(BizCode.PASSWORD_ERROR, "用户密码不正确");
        }

        return IssueAuthenticatedUserResponse(user);
    }

    public async Task<TokenRefreshResult> RefreshAccessTokenAsync(string refreshToken)
    {
        var user = await GetUserFromTokenAsync(refreshToken, TokenType.Refresh);
        var tokens = IssueTokens(user);

        return new TokenRefreshResult(
            new TokenRefreshResponse(tokens.AccessToken),
            tokens.RefreshToken);
    }

    public async Task<Page<UserInfoResponse>> GetUsersAsync(
        PageInput pageInput,
        string? name,
        string? displayName,
        Guid? conferenceUuid,
        UserRole? role,
        CancellationToken ct = default)
    {
        IQueryable<User> query = _db.Users.AsNoTracking().Include(u => u.Conference);

        if (!string.IsNullOrWhiteSpace(name))
        {
            var keyword = name.Trim().ToLower();
            query = query.Where(u => u.Name.ToLower().Contains(keyword));
        }

        if (!string.IsNullOrWhiteSpace(displayName))
        {
            var keyword = displayName.Trim().ToLower();
            query = query.Where(u => u.DisplayName != null && u.DisplayName.ToLower().Contains(keyword));
        }

        if (conferenceUuid.HasValue)
        {
            query = query.Where(u => u.ConferenceId == conferenceUuid.Value);
        }

        if (role.HasValue)
        {
            query = query.Where(u => u.Role == role.Value);
        }

        var effectiveInput = pageInput.Sort.Count == 0
            ? new PageInput { Page = pageInput.Page, Size = pageInput.Size, Sort = new List<SortSpec> { new("Name", false) } }
            : pageInput;

        var page = await query.ToPageAsync(effectiveInput, ct);

        return Page<UserInfoResponse>.Of(
            page.Content.Select(UserInfoResponse.From).ToList(),
            page.Number,
            page.Size,
            page.TotalElements);
    }

    public async Task DeleteUserAsync(Guid uuid)
    {
        var exists = await _db.Users.AsNoTracking().AnyAsync(u => u.Uuid == uuid);
        if (!exists)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"用户不存在: {uuid}");
        }

        var user = await _db.Users.Include(u => u.MessageReceivers).FirstOrDefaultAsync(u => u.Uuid == uuid);
        if (user != null)
        {
            _db.MessageReceivers.RemoveRange(user.MessageReceivers);
            _db.Users.Remove(user);
            await _db.SaveChangesAsync();
        }
    }

    public UserInfoResponse GetCurrentUserInfo(User user)
    {
        return UserInfoResponse.From(user);
    }

    public async Task<UserInfoResponse> UpdateUserAsync(Guid targetUuid, User requester, UserUpdateRequest request)
    {
        var target = await _db.Users.Include(u => u.Conference)
            .FirstOrDefaultAsync(u => u.Uuid == targetUuid)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "目标用户不存在");

        var canEditAny = requester.Role == UserRole.SYS_ADMIN;
        var isSelf = requester.Uuid == target.Uuid;
        if (!canEditAny && !isSelf)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Permission denied", StatusCodes.Status403Forbidden);
        }

        if (request.Name != null)
        {
            var existed = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Name == request.Name);
            if (existed != null && existed.Uuid != target.Uuid)
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, "用户名已存在");
            }

            target.Name = request.Name;
        }

        if (request.DisplayName != null)
        {
            target.DisplayName = request.DisplayName;
        }

        if (request.Password != null)
        {
            target.Password = BCrypt.Net.BCrypt.HashPassword(request.Password);
            target.AuthVersion += 1;
        }

        if (request.Role.HasValue)
        {
            if (!canEditAny)
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Only admin can change role", StatusCodes.Status403Forbidden);
            }

            target.Role = request.Role.Value;
        }

        await _db.SaveChangesAsync();

        return UserInfoResponse.From(target);
    }

    public async Task ResetPasswordAsync(Guid uuid, string newPassword, Guid? requesterUuid)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Uuid == uuid)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"用户不存在: {uuid}");

        if (requesterUuid.HasValue)
        {
            var requester = await _db.Users.Include(u => u.Conference)
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Uuid == requesterUuid.Value)
                ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"操作者不存在: {requesterUuid}");

            if (requester.Role == UserRole.DH)
            {
                if (requester.ConferenceId == null || requester.ConferenceId != user.ConferenceId)
                {
                    throw new ForbiddenException("DH 只能重置本会议内用户的密码");
                }
            }
        }

        user.Password = BCrypt.Net.BCrypt.HashPassword(newPassword);
        user.AuthVersion += 1;
        await _db.SaveChangesAsync();
    }

    public async Task<BatchRegisterResponse> BatchRegisterAsync(User requester, BatchRegisterRequest request)
    {
        if (requester.Role is not (UserRole.SYS_ADMIN or UserRole.DH))
        {
            throw new ForbiddenException("Only SYS_ADMIN or DH can perform batch registration");
        }

        if (!Guid.TryParse(request.ConferenceId, out var conferenceUuid))
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"会议ID无效: {request.ConferenceId}");
        }

        var conference = await _db.Conferences.FirstOrDefaultAsync(c => c.Uuid == conferenceUuid)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"会议不存在: {request.ConferenceId}");

        if (requester.Role == UserRole.DH)
        {
            if (requester.ConferenceId == null || requester.ConferenceId != conferenceUuid)
            {
                throw new ForbiddenException("DH can only batch register delegates to their own conference");
            }
        }

        await using var transaction = await _db.Database.BeginTransactionAsync();

        var createdUsers = new List<UserInfoResponse>();
        foreach (var item in request.Users)
        {
            var existing = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Name == item.Name);
            if (existing != null)
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"用户已存在: {item.Name}");
            }

            var user = new User
            {
                Name = item.Name,
                DisplayName = item.DisplayName,
                Password = BCrypt.Net.BCrypt.HashPassword(item.Password),
                Role = UserRole.DELEGATE,
                ConferenceId = conferenceUuid
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            createdUsers.Add(UserInfoResponse.From(user));
        }

        await transaction.CommitAsync();

        return new BatchRegisterResponse(createdUsers.Count, createdUsers);
    }

    public async Task<BatchRegisterResponse> BatchRegisterFullAsync(User requester, BatchRegisterFullRequest request)
    {
        if (requester.Role is not (UserRole.SYS_ADMIN or UserRole.DH))
        {
            throw new ForbiddenException("Only SYS_ADMIN or DH can perform batch registration");
        }

        if (!Guid.TryParse(request.ConferenceId, out var conferenceUuid))
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"会议ID无效: {request.ConferenceId}");
        }

        var conference = await _db.Conferences.FirstOrDefaultAsync(c => c.Uuid == conferenceUuid)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"会议不存在: {request.ConferenceId}");

        if (requester.Role == UserRole.DH)
        {
            if (requester.ConferenceId == null || requester.ConferenceId != conferenceUuid)
            {
                throw new ForbiddenException("DH can only batch register users to their own conference");
            }
        }

        if (request.Users.Count == 0)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "用户列表不能为空");
        }

        if (request.Users.Any(u => u.Role is not (UserRole.DELEGATE or UserRole.DM)))
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "批量注册仅支持 DELEGATE 或 DM 角色");
        }

        await using var transaction = await _db.Database.BeginTransactionAsync();

        var createdUsers = new List<UserInfoResponse>();
        var groupCache = new Dictionary<string, UserGroup>();
        var namesInBatch = new HashSet<string>();

        foreach (var item in request.Users)
        {
            var name = item.Name.Trim();
            var password = item.Password;

            if (name.Length == 0)
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, "用户昵称不能为空");
            }

            if (string.IsNullOrWhiteSpace(password))
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"用户密码不能为空：{name}");
            }

            if (!namesInBatch.Add(name))
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"用户名重复：{name}");
            }

            var existing = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Name == name);
            if (existing != null)
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"用户已存在: {name}");
            }

            var user = new User
            {
                Name = name,
                DisplayName = item.DisplayName,
                Password = BCrypt.Net.BCrypt.HashPassword(password),
                Role = item.Role,
                ConferenceId = conferenceUuid
            };

            var groupName = item.GroupName?.Trim();
            if (!string.IsNullOrEmpty(groupName))
            {
                if (!groupCache.TryGetValue(groupName, out var group))
                {
                    group = await _db.UserGroups.FirstOrDefaultAsync(g => g.GroupName == groupName);
                    if (group == null)
                    {
                        group = new UserGroup { GroupName = groupName };
                        _db.UserGroups.Add(group);
                    }

                    groupCache[groupName] = group;
                }

                group.UserUus.Add(user);
            }

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            createdUsers.Add(UserInfoResponse.From(user));
        }

        await transaction.CommitAsync();

        return new BatchRegisterResponse(createdUsers.Count, createdUsers);
    }

    public async Task<User> GetUserFromTokenAsync(string token, TokenType expectedType)
    {
        var parsed = JwtUtil.ParseToken(token);
        JwtUtil.RequireTokenType(parsed, expectedType);
        var tokenVersion = JwtUtil.GetAuthVersion(parsed);

        if (!Guid.TryParse(parsed.Subject, out var userId))
        {
            throw new TokenInvalidException("Token用户ID无效");
        }

        var user = await _db.Users.Include(u => u.Conference).FirstOrDefaultAsync(u => u.Uuid == userId)
            ?? throw new TokenInvalidException("用户不存在");

        if (user.AuthVersion != tokenVersion)
        {
            throw new TokenInvalidException("Token已失效，请重新登录");
        }

        return user;
    }

    public UserInfoResponse ToUserInfoResponse(User user)
    {
        return UserInfoResponse.From(user);
    }

    private AuthenticatedUserResponse IssueAuthenticatedUserResponse(User user)
    {
        var tokens = IssueTokens(user);

        return new AuthenticatedUserResponse(
            new UserResponse(
                user.Uuid.ToString("D"),
                user.Name,
                user.DisplayName,
                user.Role,
                tokens.AccessToken),
            tokens.RefreshToken);
    }

    private AuthTokenPair IssueTokens(User user)
    {
        var accessToken = JwtUtil.GenerateAccessToken(
            user.Uuid.ToString("D"),
            user.AuthVersion,
            user.Name,
            user.Role);

        var refreshToken = JwtUtil.GenerateRefreshToken(user.Uuid.ToString("D"), user.AuthVersion);

        return new AuthTokenPair(accessToken, refreshToken);
    }

    private sealed record AuthTokenPair(string AccessToken, string RefreshToken);
}