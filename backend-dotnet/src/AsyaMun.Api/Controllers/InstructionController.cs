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
[Route("api/instructions")]
public class InstructionController : ControllerBase
{
    private readonly InstructionService _instructionService;

    public InstructionController(InstructionService instructionService)
    {
        _instructionService = instructionService;
    }

    [HttpPost]
    [Authorize]
    [Auditable(AuditActionType.INSTRUCTION_CREATE, "提交指令")]
    public async Task<IActionResult> Create([FromBody] InstructionCreateRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        if (requester.Role != UserRole.DELEGATE)
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "仅代表可提交指令", StatusCodes.Status403Forbidden);
        }

        var response = await _instructionService.CreateInstructionAsync(requester, request);
        return ApiResp.Ok(response);
    }

    [HttpGet("my")]
    [Authorize]
    public async Task<IActionResult> GetMyInstructions(
        [FromQuery] InstructionStatus? status,
        [FromQuery] string? keyword)
    {
        var requester = RequireCurrentUser();
        var input = PageInput.Parse(HttpContext.Request, 20);
        var page = await _instructionService.GetMyInstructionsAsync(requester, input, status, keyword);

        return ApiResp.Ok(page);
    }

    [HttpGet("{uuid:guid}")]
    [Authorize]
    public async Task<IActionResult> GetInstruction(Guid uuid)
    {
        var requester = RequireCurrentUser();
        var response = await _instructionService.GetInstructionAsync(uuid, requester);

        return ApiResp.Ok(response);
    }

    [HttpGet("manage")]
    [Authorize]
    public async Task<IActionResult> GetInstructionsForManagement(
        [FromQuery] InstructionStatus? status,
        [FromQuery] InstructionType? instructionType,
        [FromQuery] long? userGroupId,
        [FromQuery] List<Guid>? submitterUuids,
        [FromQuery] string? keyword)
    {
        var requester = RequireCurrentUser();
        var input = PageInput.Parse(HttpContext.Request, 20);
        var page = await _instructionService.QueryInstructionsForManagementAsync(
            requester, input, status, instructionType, userGroupId, submitterUuids, keyword);

        return ApiResp.Ok(page);
    }

    [HttpPost("{uuid:guid}/review")]
    [Authorize]
    [Auditable(AuditActionType.INSTRUCTION_REVIEW, "批改指令")]
    public async Task<IActionResult> Review(Guid uuid, [FromBody] InstructionReviewRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        var response = await _instructionService.ReviewInstructionAsync(uuid, requester, request);

        return ApiResp.Ok(response);
    }

    [HttpPost("submission-switch")]
    [Authorize]
    [Auditable(AuditActionType.INSTRUCTION_SUBMISSION_SWITCH, "设置会议指令提交暂停开关")]
    public async Task<IActionResult> SetSubmissionSwitch(
        [FromQuery] bool? paused,
        [FromBody] InstructionSubmissionSwitchRequest? request)
    {
        var requester = RequireCurrentUser();
        if (requester.Role is not (UserRole.DH or UserRole.SYS_ADMIN))
        {
            throw new ForbiddenException("仅DH或系统管理员可设置");
        }

        var conferenceId = requester.ConferenceId
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "用户未关联任何会议");

        var targetPaused = paused ?? request?.Paused;
        if (targetPaused == null)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "缺少 paused 参数");
        }

        var result = await _instructionService.SetInstructionSubmissionPausedAsync(conferenceId, targetPaused.Value);
        return ApiResp.Ok(result);
    }

    [HttpGet("submission-switch")]
    [Authorize]
    public async Task<IActionResult> GetSubmissionSwitch()
    {
        var requester = RequireCurrentUser();
        var conferenceId = requester.ConferenceId
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "用户未关联任何会议");

        var paused = await _instructionService.IsInstructionSubmissionPausedAsync(conferenceId);
        return ApiResp.Ok(paused);
    }

    private User RequireCurrentUser()
    {
        return HttpContext.GetCurrentUser()
            ?? throw new TokenInvalidException("登录状态已失效，请重新登录");
    }
}