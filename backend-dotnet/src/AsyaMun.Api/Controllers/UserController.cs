using AsyaMun.Api.Auth;
using AsyaMun.Api.Audit;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Errors;
using AsyaMun.Api.Models;
using AsyaMun.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AsyaMun.Api.Controllers;

[ApiController]
[Route("api/users")]
public class UserController : ControllerBase
{
    private readonly UserService _userService;
    private readonly SystemConfigService _systemConfigService;

    public UserController(UserService userService, SystemConfigService systemConfigService)
    {
        _userService = userService;
        _systemConfigService = systemConfigService;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    [Auditable(AuditActionType.USER_REGISTER, "用户注册")]
    public async Task<IActionResult> Register([FromBody] UserRegistrationRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var response = await _userService.RegisterUserAsync(request);
        Response.WriteBearer(response.Response.Token);
        RefreshCookieHelper.Append(HttpContext, response.RefreshToken);

        return ApiResp.Ok(response.Response, StatusCodes.Status201Created);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [Auditable(AuditActionType.USER_LOGIN, "用户登录")]
    public async Task<IActionResult> Login([FromBody] UserRegistrationRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var response = await _userService.LoginUserAsync(request);
        Response.WriteBearer(response.Response.Token);
        RefreshCookieHelper.Append(HttpContext, response.RefreshToken);

        return ApiResp.Ok(response.Response);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> Refresh()
    {
        var refreshToken = RefreshCookieHelper.Read(HttpContext);
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            RefreshCookieHelper.Clear(HttpContext);
            return ApiResp.Fail(BizCode.TOKEN_INVALID, "Refresh token 不存在", StatusCodes.Status401Unauthorized);
        }

        try
        {
            var response = await _userService.RefreshAccessTokenAsync(refreshToken);
            Response.WriteBearer(response.Response.Token);
            RefreshCookieHelper.Append(HttpContext, response.RefreshToken);

            return ApiResp.Ok(response.Response);
        }
        catch (Exception ex)
        {
            RefreshCookieHelper.Clear(HttpContext);
            return ApiResp.Fail(BizCode.TOKEN_INVALID, ex.Message ?? "Refresh token 无效", StatusCodes.Status401Unauthorized);
        }
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public IActionResult Logout()
    {
        RefreshCookieHelper.Clear(HttpContext);
        return ApiResp.OkUnit();
    }

    [HttpPost("batch")]
    [Authorize]
    [Auditable(AuditActionType.USER_BATCH_REGISTER, "批量注册用户")]
    public async Task<IActionResult> Batch([FromBody] BatchRegisterRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        var response = await _userService.BatchRegisterAsync(requester, request);

        return ApiResp.Ok(response);
    }

    [HttpPost("batch-full")]
    [Authorize]
    [Auditable(AuditActionType.USER_BATCH_REGISTER_FULL, "批量注册用户（含角色与会组）")]
    public async Task<IActionResult> BatchFull([FromBody] BatchRegisterFullRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        var response = await _userService.BatchRegisterFullAsync(requester, request);

        return ApiResp.Ok(response);
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> ListAll(
        [FromQuery] string? name,
        [FromQuery] string? displayName,
        [FromQuery] Guid? conferenceUuid,
        [FromQuery] UserRole? role)
    {
        var requester = RequireCurrentUser();
        if (requester.Role != UserRole.SYS_ADMIN)
        {
            return ApiResp.Fail(BizCode.TOKEN_INVALID, "需要管理员权限");
        }

        var input = PageInput.Parse(HttpContext.Request, 20);
        var page = await _userService.GetUsersAsync(input, name, displayName, conferenceUuid, role);

        return ApiResp.Ok(page);
    }

    [HttpGet("user")]
    [Authorize]
    public IActionResult GetCurrentUser()
    {
        var requester = RequireCurrentUser();
        return ApiResp.Ok(_userService.GetCurrentUserInfo(requester));
    }

    [HttpPut("user/{uuid:guid}")]
    [Authorize]
    [Auditable(AuditActionType.USER_UPDATE, "更新用户信息")]
    public async Task<IActionResult> UpdateUser(Guid uuid, [FromBody] UserUpdateRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        var updated = await _userService.UpdateUserAsync(uuid, requester, request);

        return ApiResp.Ok(updated);
    }

    [HttpPost("{uuid:guid}/password-reset")]
    [Authorize]
    [Auditable(AuditActionType.USER_PASSWORD_RESET, "重置用户密码")]
    public async Task<IActionResult> ResetPassword(Guid uuid, [FromBody] ResetPasswordBody? body)
    {
        var requester = RequireCurrentUser();
        if (requester.Role is not (UserRole.SYS_ADMIN or UserRole.DH))
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "需要管理员或主席团指导权限", StatusCodes.Status403Forbidden);
        }

        var newPassword = body?.Password;
        if (string.IsNullOrWhiteSpace(newPassword))
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "密码不能为空");
        }

        await _userService.ResetPasswordAsync(uuid, newPassword, requester.Uuid);

        return ApiResp.OkUnit();
    }

    [HttpDelete("{uuid:guid}")]
    [Authorize]
    [Auditable(AuditActionType.USER_DELETE, "删除用户")]
    public async Task<IActionResult> DeleteUser(Guid uuid)
    {
        var requester = RequireCurrentUser();
        if (requester.Role != UserRole.SYS_ADMIN)
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "需要管理员权限", StatusCodes.Status403Forbidden);
        }

        await _userService.DeleteUserAsync(uuid);

        return ApiResp.OkUnit();
    }

    [HttpPost("registration-switch")]
    [Authorize]
    [Auditable(AuditActionType.USER_REGISTRATION_SWITCH, "设置用户注册开关")]
    public async Task<IActionResult> SetRegistrationSwitch([FromQuery] bool allowed)
    {
        var requester = RequireCurrentUser();
        if (requester.Role != UserRole.SYS_ADMIN)
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "需要管理员权限", StatusCodes.Status403Forbidden);
        }

        await _systemConfigService.SetRegistrationAllowedAsync(allowed);

        return ApiResp.Ok(allowed);
    }

    [HttpGet("registration-switch")]
    [AllowAnonymous]
    public async Task<IActionResult> GetRegistrationSwitch()
    {
        return ApiResp.Ok(await _userService.IsRegistrationAvailableAsync());
    }

    private User RequireCurrentUser()
    {
        return HttpContext.GetCurrentUser()
            ?? throw new TokenInvalidException("登录状态已失效，请重新登录");
    }
}

public record ResetPasswordBody(string? Password);