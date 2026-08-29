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
[Route("api/delegate-attrs")]
public class DelegateAttrController : ControllerBase
{
    private readonly DelegateAttrService _delegateAttrService;

    public DelegateAttrController(DelegateAttrService delegateAttrService)
    {
        _delegateAttrService = delegateAttrService;
    }

    [HttpPost("configs")]
    [Authorize]
    [Auditable(AuditActionType.DELEGATE_ATTR_CONFIG_CREATE, "创建代表属性配置")]
    public async Task<IActionResult> CreateConfig([FromBody] DelegateAttrConfigCreateRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        var response = await _delegateAttrService.CreateConfigAsync(requester.Uuid, request);
        return ApiResp.Ok(response, StatusCodes.Status201Created);
    }

    [HttpPut("configs/{configId:guid}")]
    [Authorize]
    [Auditable(AuditActionType.DELEGATE_ATTR_CONFIG_UPDATE, "更新代表属性配置")]
    public async Task<IActionResult> UpdateConfig(Guid configId, [FromBody] DelegateAttrConfigUpdateRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        var response = await _delegateAttrService.UpdateConfigAsync(requester.Uuid, configId, request);
        return ApiResp.Ok(response);
    }

    [HttpGet("configs")]
    [Authorize]
    public async Task<IActionResult> ListConfigs()
    {
        var requester = RequireCurrentUser();
        var response = await _delegateAttrService.ListConfigsAsync(requester.Uuid);
        return ApiResp.Ok(response);
    }

    [HttpGet("my-records")]
    [Authorize]
    public async Task<IActionResult> ListMyRecords()
    {
        var requester = RequireCurrentUser();
        var input = PageInput.Parse(HttpContext.Request, 20);
        var response = await _delegateAttrService.ListMyRecordsAsync(requester.Uuid, input);
        return ApiResp.Ok(response);
    }

    [HttpPost("delegates/{delegateId:guid}/records")]
    [Authorize]
    [Auditable(AuditActionType.DELEGATE_ATTR_RECORD_CREATE, "创建代表属性记录")]
    public async Task<IActionResult> CreateRecord(Guid delegateId, [FromBody] DelegateAttrRecordUpsertRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        var response = await _delegateAttrService.CreateRecordForDelegateAsync(requester.Uuid, delegateId, request);
        return ApiResp.Ok(response, StatusCodes.Status201Created);
    }

    [HttpPut("delegates/{delegateId:guid}/records/{recordId:guid}")]
    [Authorize]
    [Auditable(AuditActionType.DELEGATE_ATTR_RECORD_UPDATE, "更新代表属性记录")]
    public async Task<IActionResult> UpdateRecord(Guid delegateId, Guid recordId, [FromBody] DelegateAttrRecordUpsertRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        var response = await _delegateAttrService.UpdateRecordForDelegateAsync(requester.Uuid, delegateId, recordId, request);
        return ApiResp.Ok(response);
    }

    [HttpDelete("delegates/{delegateId:guid}/records/{recordId:guid}")]
    [Authorize]
    [Auditable(AuditActionType.DELEGATE_ATTR_RECORD_DELETE, "删除代表属性记录")]
    public async Task<IActionResult> DeleteRecord(Guid delegateId, Guid recordId)
    {
        var requester = RequireCurrentUser();
        await _delegateAttrService.DeleteRecordForDelegateAsync(requester.Uuid, delegateId, recordId);
        return ApiResp.OkUnit();
    }

    [HttpPost("manage/query")]
    [Authorize]
    public async Task<IActionResult> QueryForManagement([FromBody] DelegateAttrManageQueryRequest? request)
    {
        if (request == null)
        {
            return ApiResp.Fail(BizCode.PARAM_ERROR, "请求体不能为空");
        }

        var requester = RequireCurrentUser();
        var input = PageInput.Parse(HttpContext.Request, 20);
        var response = await _delegateAttrService.QueryForManagementAsync(requester.Uuid, request, input);
        return ApiResp.Ok(response);
    }

    private User RequireCurrentUser()
    {
        return HttpContext.GetCurrentUser()
            ?? throw new TokenInvalidException("登录状态已失效，请重新登录");
    }
}