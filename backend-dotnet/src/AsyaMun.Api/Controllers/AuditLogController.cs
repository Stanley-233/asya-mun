using AsyaMun.Api.Auth;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Errors;
using AsyaMun.Api.Models;
using AsyaMun.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AsyaMun.Api.Controllers;

[ApiController]
[Route("api/audit-logs")]
public class AuditLogController : ControllerBase
{
    private readonly AuditLogService _auditLogService;

    public AuditLogController(AuditLogService auditLogService)
    {
        _auditLogService = auditLogService;
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> ListAuditLogs(
        [FromQuery] string? actorName,
        [FromQuery] AuditActionType? actionType,
        [FromQuery] bool? success,
        [FromQuery] string? ip,
        [FromQuery] DateTime? eventTimeFrom,
        [FromQuery] DateTime? eventTimeTo)
    {
        var requester = RequireCurrentUser();
        if (requester.Role != UserRole.SYS_ADMIN)
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "需要管理员权限", StatusCodes.Status403Forbidden);
        }

        var input = PageInput.Parse(HttpContext.Request, 20);
        var page = await _auditLogService.GetAuditLogsAsync(
            input, actorName, actionType, success, ip, eventTimeFrom, eventTimeTo);

        return ApiResp.Ok(page);
    }

    [HttpGet("{id:long}")]
    [Authorize]
    public async Task<IActionResult> GetAuditLog(long id)
    {
        var requester = RequireCurrentUser();
        if (requester.Role != UserRole.SYS_ADMIN)
        {
            return ApiResp.Fail(BizCode.PERMISSION_DENIED, "需要管理员权限", StatusCodes.Status403Forbidden);
        }

        var log = await _auditLogService.GetAuditLogByIdAsync(id);
        return ApiResp.Ok(log);
    }

    private User RequireCurrentUser()
    {
        return HttpContext.GetCurrentUser()
            ?? throw new TokenInvalidException("登录状态已失效，请重新登录");
    }
}