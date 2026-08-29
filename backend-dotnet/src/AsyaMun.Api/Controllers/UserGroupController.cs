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
[Route("api/user-groups")]
public class UserGroupController : ControllerBase
{
    private readonly UserGroupService _userGroupService;

    public UserGroupController(UserGroupService userGroupService)
    {
        _userGroupService = userGroupService;
    }

    [HttpPost]
    [Authorize]
    [Auditable(AuditActionType.USER_GROUP_CREATE, "创建用户组")]
    public async Task<IActionResult> CreateUserGroup([FromBody] UserGroupRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        if (!HasWriteRole(requester))
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "权限不足，需要 DH / DM / SYS_ADMIN 角色", StatusCodes.Status403Forbidden);
        }

        var response = await _userGroupService.CreateUserGroupAsync(request.GroupName);

        return ApiResp.Ok(response, StatusCodes.Status201Created);
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetAllUserGroups()
    {
        RequireCurrentUser();
        var response = await _userGroupService.GetAllUserGroupsAsync();

        return ApiResp.Ok(response);
    }

    [HttpGet("{id:long}")]
    [Authorize]
    public async Task<IActionResult> GetUserGroup(long id)
    {
        RequireCurrentUser();
        var response = await _userGroupService.GetUserGroupAsync(id);

        return ApiResp.Ok(response);
    }

    [HttpPut("{id:long}")]
    [Authorize]
    [Auditable(AuditActionType.USER_GROUP_UPDATE, "更新用户组")]
    public async Task<IActionResult> UpdateUserGroup(long id, [FromBody] UserGroupRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        if (!HasWriteRole(requester))
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "权限不足，需要 DH / DM / SYS_ADMIN 角色", StatusCodes.Status403Forbidden);
        }

        var response = await _userGroupService.UpdateUserGroupAsync(id, request.GroupName);

        return ApiResp.Ok(response);
    }

    [HttpDelete("{id:long}")]
    [Authorize]
    [Auditable(AuditActionType.USER_GROUP_DELETE, "删除用户组")]
    public async Task<IActionResult> DeleteUserGroup(long id)
    {
        var requester = RequireCurrentUser();
        if (!HasWriteRole(requester))
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "权限不足，需要 DH / DM / SYS_ADMIN 角色", StatusCodes.Status403Forbidden);
        }

        await _userGroupService.DeleteUserGroupAsync(id);

        return ApiResp.OkUnit();
    }

    [HttpPost("{id:long}/users")]
    [Authorize]
    [Auditable(AuditActionType.USER_GROUP_MEMBERS_UPDATE, "设置用户组成员")]
    public async Task<IActionResult> SetGroupMembers(long id, [FromBody] UserGroupMembersRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        if (!HasWriteRole(requester))
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "权限不足，需要 DH / DM / SYS_ADMIN 角色", StatusCodes.Status403Forbidden);
        }

        var response = await _userGroupService.SetGroupMembersAsync(id, request.UserUuids);

        return ApiResp.Ok(response);
    }

    [HttpDelete("{id:long}/users/{uuid:guid}")]
    [Authorize]
    [Auditable(AuditActionType.USER_GROUP_MEMBER_REMOVE, "移除用户组成员")]
    public async Task<IActionResult> RemoveUserFromGroup(long id, Guid uuid)
    {
        var requester = RequireCurrentUser();
        if (!HasWriteRole(requester))
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "权限不足，需要 DH / DM / SYS_ADMIN 角色", StatusCodes.Status403Forbidden);
        }

        var response = await _userGroupService.RemoveUserFromGroupAsync(id, uuid);

        return ApiResp.Ok(response);
    }

    private static bool HasWriteRole(User requester)
    {
        return requester.Role is UserRole.DH or UserRole.DM or UserRole.SYS_ADMIN;
    }

    private User RequireCurrentUser()
    {
        return HttpContext.GetCurrentUser()
            ?? throw new TokenInvalidException("登录状态已失效，请重新登录");
    }
}