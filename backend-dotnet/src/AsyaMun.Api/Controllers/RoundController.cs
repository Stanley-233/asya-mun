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
[Route("api/round")]
public class RoundController : ControllerBase
{
    private readonly RoundService _roundService;

    public RoundController(RoundService roundService)
    {
        _roundService = roundService;
    }

    [HttpPost]
    [Authorize]
    [Auditable(AuditActionType.ROUND_PUBLISH, "发布回合")]
    public async Task<IActionResult> Publish([FromBody] RoundPublishRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        RequireManagePermission();
        var conferenceId = RequireConferenceId();
        var response = await _roundService.PublishRoundAsync(request, conferenceId);

        return ApiResp.Ok(response, StatusCodes.Status201Created);
    }

    [HttpPut("{roundId:guid}/next")]
    [Authorize]
    [Auditable(AuditActionType.ROUND_SET_NEXT, "设置回合下一跳")]
    public async Task<IActionResult> SetNext(Guid roundId, [FromBody] RoundSetNextRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        RequireManagePermission();
        var conferenceId = RequireConferenceId();
        var response = await _roundService.SetNextRoundAsync(roundId, request, conferenceId);

        return ApiResp.Ok(response);
    }

    [HttpPut("{roundId:guid}")]
    [Authorize]
    [Auditable(AuditActionType.ROUND_UPDATE, "修改回合")]
    public async Task<IActionResult> Update(Guid roundId, [FromBody] RoundUpdateRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        RequireManagePermission();
        var conferenceId = RequireConferenceId();
        var response = await _roundService.UpdateRoundAsync(roundId, request, conferenceId);

        return ApiResp.Ok(response);
    }

    [HttpPut("current")]
    [Authorize]
    [Auditable(AuditActionType.ROUND_SET_CURRENT, "切换当前回合")]
    public async Task<IActionResult> UpdateCurrent([FromBody] RoundSetCurrentRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        RequireManagePermission();
        var conferenceId = RequireConferenceId();
        var response = await _roundService.SetCurrentRoundAsync(request, conferenceId);

        return ApiResp.Ok(response);
    }

    [HttpPut("{roundId:guid}/remaining")]
    [Authorize]
    [Auditable(AuditActionType.ROUND_SET_REMAINING, "设置回合剩余时间")]
    public async Task<IActionResult> UpdateRemaining(Guid roundId, [FromBody] RoundSetRemainingRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        RequireManagePermission();
        var conferenceId = RequireConferenceId();
        var response = await _roundService.SetRoundRemainingAsync(roundId, request, conferenceId);

        return ApiResp.Ok(response);
    }

    [HttpPost("{roundId:guid}/pause")]
    [Authorize]
    [Auditable(AuditActionType.ROUND_PAUSE, "暂停回合")]
    public async Task<IActionResult> Pause(Guid roundId)
    {
        RequireManagePermission();
        var conferenceId = RequireConferenceId();
        var response = await _roundService.PauseRoundAsync(roundId, conferenceId);

        return ApiResp.Ok(response);
    }

    [HttpPost("{roundId:guid}/resume")]
    [Authorize]
    [Auditable(AuditActionType.ROUND_RESUME, "恢复回合")]
    public async Task<IActionResult> Resume(Guid roundId)
    {
        RequireManagePermission();
        var conferenceId = RequireConferenceId();
        var response = await _roundService.ResumeRoundAsync(roundId, conferenceId);

        return ApiResp.Ok(response);
    }

    [HttpGet("current")]
    [Authorize]
    public async Task<IActionResult> Current()
    {
        var conferenceId = RequireConferenceId();
        var response = await _roundService.GetCurrentRoundAsync(conferenceId);

        return ApiResp.Ok(response);
    }

    [HttpGet("{roundId:guid}")]
    [Authorize]
    public async Task<IActionResult> Detail(Guid roundId)
    {
        var conferenceId = RequireConferenceId();
        var response = await _roundService.GetRoundDetailAsync(roundId, conferenceId);

        return ApiResp.Ok(response);
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> List()
    {
        RequireManagePermission();
        var conferenceId = RequireConferenceId();
        var response = await _roundService.ListRoundsAsync(conferenceId);

        return ApiResp.Ok(response);
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
        return user.ConferenceId ?? throw AsyaBusinessException.ParamError("未加入任何会议");
    }

    private User RequireCurrentUser()
    {
        return HttpContext.GetCurrentUser()
            ?? throw new TokenInvalidException("登录状态已失效，请重新登录");
    }
}