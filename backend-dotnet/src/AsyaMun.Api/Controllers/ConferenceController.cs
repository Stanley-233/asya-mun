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
[Route("api/conference")]
public class ConferenceController : ControllerBase
{
    private readonly ConferenceService _conferenceService;

    public ConferenceController(ConferenceService conferenceService)
    {
        _conferenceService = conferenceService;
    }

    [HttpPost]
    [Authorize]
    [Auditable(AuditActionType.CONFERENCE_CREATE, "创建会议")]
    public async Task<IActionResult> Create([FromBody] ConferenceRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        var response = await _conferenceService.CreateConferenceAsync(requester, request);

        return ApiResp.Ok(response, StatusCodes.Status201Created);
    }

    [HttpPut]
    [Authorize]
    [Auditable(AuditActionType.CONFERENCE_UPDATE, "更新会议")]
    public async Task<IActionResult> Update([FromBody] ConferenceRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        var response = await _conferenceService.UpdateConferenceAsync(requester, request);

        return ApiResp.Ok(response);
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetMine()
    {
        var requester = RequireCurrentUser();
        var response = await _conferenceService.GetMyConferenceAsync(requester);

        return ApiResp.Ok(response);
    }

    [HttpGet("users")]
    [Authorize]
    public async Task<IActionResult> GetUsers()
    {
        var requester = RequireCurrentUser();
        var response = await _conferenceService.GetConferenceUsersAsync(requester);

        return ApiResp.Ok(response);
    }

    [HttpGet("delegates")]
    [Authorize]
    public async Task<IActionResult> GetDelegates(
        [FromQuery] string? name,
        [FromQuery] string? displayName)
    {
        var requester = RequireCurrentUser();
        if (requester.Role is not (UserRole.DH or UserRole.DM or UserRole.SYS_ADMIN))
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "需要主席团指导或更高权限", StatusCodes.Status403Forbidden);
        }

        var input = PageInput.Parse(HttpContext.Request, 20);
        if (input.Sort.Count == 0)
        {
            input = new PageInput { Page = input.Page, Size = input.Size, Sort = new List<SortSpec> { new("Name", false) } };
        }

        var page = await _conferenceService.GetConferenceDelegatesAsync(requester, input, name, displayName);

        return ApiResp.Ok(page);
    }

    [HttpGet("all")]
    [Authorize]
    public async Task<IActionResult> ListAll()
    {
        var requester = RequireCurrentUser();
        var response = await _conferenceService.ListAllAsync(requester);

        return ApiResp.Ok(response);
    }

    [HttpGet("page")]
    [Authorize]
    public async Task<IActionResult> ListPage()
    {
        var requester = RequireCurrentUser();

        var input = PageInput.Parse(HttpContext.Request, 20);
        if (input.Sort.Count == 0)
        {
            input = new PageInput { Page = input.Page, Size = input.Size, Sort = new List<SortSpec> { new("Name", false) } };
        }

        var page = await _conferenceService.ListPageAsync(requester, input);

        return ApiResp.Ok(page);
    }

    [HttpPut("{uuid:guid}")]
    [Authorize]
    [Auditable(AuditActionType.CONFERENCE_UPDATE, "管理员更新会议")]
    public async Task<IActionResult> UpdateByUuid(Guid uuid, [FromBody] ConferenceRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        var response = await _conferenceService.UpdateConferenceByUuidAsync(requester, uuid, request);

        return ApiResp.Ok(response);
    }

    [HttpPost("assign")]
    [Authorize]
    [Auditable(AuditActionType.CONFERENCE_ASSIGN_USER, "分配用户到会议")]
    public async Task<IActionResult> AssignUser([FromBody] ConferenceAssignRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        if (!Guid.TryParse(request.ConferenceUuid, out var conferenceUuid)
            || !Guid.TryParse(request.UserUuid, out var userUuid))
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "参数错误");
        }

        var requester = RequireCurrentUser();
        var response = await _conferenceService.AssignUserToConferenceAsync(requester, conferenceUuid, userUuid);

        return ApiResp.Ok(response);
    }

    private User RequireCurrentUser()
    {
        return HttpContext.GetCurrentUser()
            ?? throw new TokenInvalidException("登录状态已失效，请重新登录");
    }
}