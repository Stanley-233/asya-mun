using AsyaMun.Api.Audit;
using AsyaMun.Api.Auth;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Errors;
using AsyaMun.Api.Models;
using AsyaMun.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AsyaMun.Api.Controllers;

[ApiController]
[Route("api/time")]
public class TimeController : ControllerBase
{
    private readonly TimeService _timeService;

    public TimeController(TimeService timeService)
    {
        _timeService = timeService;
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetAll()
    {
        RequireManagePermission();
        var conferenceId = RequireConferenceId();
        var response = await _timeService.GetAllTimeAnchorsAsync(conferenceId);

        return ApiResp.Ok(response);
    }

    [HttpGet("latest")]
    [Authorize]
    public async Task<IActionResult> GetLatest()
    {
        var conferenceId = RequireConferenceId();
        var latest = await _timeService.GetLatestTimeAnchorAsync(conferenceId);
        if (latest != null)
        {
            return ApiResp.Ok(latest);
        }

        return ApiResp.Fail(BizCode.PARAM_ERROR, "无时间锚点");
    }

    [HttpPost("update")]
    [Authorize]
    [Auditable(AuditActionType.TIMELINE_UPDATE, "更新时间轴")]
    public async Task<IActionResult> Update([FromBody] TimeUpdateRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        RequireManagePermission();
        var conferenceId = RequireConferenceId();
        var response = await _timeService.UpdateTimeAnchorAsync(request, conferenceId);

        return ApiResp.Ok(response);
    }

    [HttpPost("jump")]
    [Authorize]
    [Auditable(AuditActionType.TIMELINE_JUMP, "时间轴跳跃")]
    public async Task<IActionResult> Jump([FromBody] TimeJumpRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        RequireManagePermission();
        var conferenceId = RequireConferenceId();
        var response = await _timeService.JumpTimeAnchorAsync(request, conferenceId);

        return ApiResp.Ok(response);
    }

    [HttpGet("current")]
    [Authorize]
    public async Task<IActionResult> GetCurrent()
    {
        var conferenceId = RequireConferenceId();
        var time = await _timeService.GetCurrentGameTimeAsync(conferenceId);
        if (time != null)
        {
            return ApiResp.Ok(new CurrentTimeResponse(time));
        }

        return ApiResp.Fail(BizCode.PARAM_ERROR, "无时间锚点");
    }

    private void RequireManagePermission()
    {
        var user = RequireCurrentUser();
        if (user.Role is not (UserRole.DM or UserRole.DH or UserRole.SYS_ADMIN))
        {
            throw new ForbiddenException("无权访问");
        }
    }

    private Guid RequireConferenceId()
    {
        var user = RequireCurrentUser();
        return user.ConferenceId
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "未加入任何会议", StatusCodes.Status400BadRequest);
    }

    private User RequireCurrentUser()
    {
        return HttpContext.GetCurrentUser()
            ?? throw new TokenInvalidException("登录状态已失效，请重新登录");
    }
}