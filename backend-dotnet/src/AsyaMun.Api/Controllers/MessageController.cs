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
[Route("api/messages")]
public class MessageController : ControllerBase
{
    private readonly MessageService _messageService;

    public MessageController(MessageService messageService)
    {
        _messageService = messageService;
    }

    [HttpPost]
    [Authorize]
    [Auditable(AuditActionType.MESSAGE_CREATE, "创建消息")]
    public async Task<IActionResult> Create([FromBody] MessageCreateRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        if (requester.Role is not (UserRole.DM or UserRole.DH or UserRole.SYS_ADMIN))
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "无权访问", StatusCodes.Status403Forbidden);
        }

        var response = await _messageService.CreateMessageAsync(requester, request);
        return ApiResp.Ok(response);
    }

    [HttpPut("{uuid:guid}")]
    [Authorize]
    [Auditable(AuditActionType.MESSAGE_UPDATE, "更新消息")]
    public async Task<IActionResult> Update(Guid uuid, [FromBody] MessageUpdateRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        if (requester.Role is not (UserRole.DM or UserRole.DH or UserRole.SYS_ADMIN))
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "无权访问", StatusCodes.Status403Forbidden);
        }

        var response = await _messageService.UpdateMessageAsync(uuid, request);
        return ApiResp.Ok(response);
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetAll([FromQuery] string? keyword)
    {
        var requester = RequireCurrentUser();
        var input = PageInput.Parse(HttpContext.Request, 20);
        var page = await _messageService.GetMessagesForConferenceAsync(requester, input, keyword);

        return ApiResp.Ok(page);
    }

    [HttpGet("secret/conference")]
    [Authorize]
    public async Task<IActionResult> GetAllSecretInConference(
        [FromQuery] Guid? senderId,
        [FromQuery] Guid? receiverId,
        [FromQuery] string? keyword)
    {
        var requester = RequireCurrentUser();
        if (requester.Role is not (UserRole.DM or UserRole.DH or UserRole.SYS_ADMIN))
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "无权访问", StatusCodes.Status403Forbidden);
        }

        var input = PageInput.Parse(HttpContext.Request, 20);
        var page = await _messageService.GetSecretMessagesForConferenceAsync(
            requester, input, senderId, receiverId, keyword);

        return ApiResp.Ok(page);
    }

    [HttpGet("secret")]
    [Authorize]
    public async Task<IActionResult> GetSecretMessages([FromQuery] string? keyword)
    {
        var requester = RequireCurrentUser();
        var input = PageInput.Parse(HttpContext.Request, 20);
        var page = await _messageService.GetSecretMessagesForUserAsync(requester, input, keyword);

        return ApiResp.Ok(page);
    }

    [HttpGet("{uuid:guid}")]
    [Authorize]
    public async Task<IActionResult> GetOne(Guid uuid)
    {
        var requester = RequireCurrentUser();
        var response = await _messageService.GetMessageAsync(uuid, requester);

        return ApiResp.Ok(response);
    }

    [HttpGet("{uuid:guid}/receivers")]
    [Authorize]
    public async Task<IActionResult> GetReceivers(Guid uuid)
    {
        RequireCurrentUser();
        var receivers = await _messageService.GetMessageReceiversAsync(uuid);

        return ApiResp.Ok(receivers);
    }

    [HttpDelete("{uuid:guid}")]
    [Authorize]
    [Auditable(AuditActionType.MESSAGE_DELETE, "删除消息")]
    public async Task<IActionResult> Delete(Guid uuid)
    {
        var requester = RequireCurrentUser();
        if (requester.Role is not (UserRole.DM or UserRole.DH or UserRole.SYS_ADMIN))
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "无权访问", StatusCodes.Status403Forbidden);
        }

        await _messageService.DeleteMessageAsync(uuid);
        return ApiResp.OkUnit();
    }

    private User RequireCurrentUser()
    {
        return HttpContext.GetCurrentUser()
            ?? throw new TokenInvalidException("登录状态已失效，请重新登录");
    }
}