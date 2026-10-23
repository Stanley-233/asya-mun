using AsyaMun.Api.Audit;
using AsyaMun.Api.Auth;
using AsyaMun.Core.Auth;
using AsyaMun.Api.Dtos;
using AsyaMun.Core.Errors;
using AsyaMun.Core.Models;
using AsyaMun.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AsyaMun.Api.Controllers;

[ApiController]
[Route("api/test-data")]
public class TestDataController : ControllerBase
{
    private readonly TestDataService _testDataService;

    public TestDataController(TestDataService testDataService)
    {
        _testDataService = testDataService;
    }

    [HttpPost("bootstrap")]
    [Authorize]
    [Auditable(AuditActionType.TEST_DATA_BOOTSTRAP, "初始化测试数据")]
    public async Task<IActionResult> Bootstrap()
    {
        var requester = HttpContext.GetCurrentUser()
            ?? throw new TokenInvalidException("登录状态已失效，请重新登录");

        var response = await _testDataService.BootstrapScenarioAsync(requester);

        return ApiResp.Ok(response, StatusCodes.Status201Created);
    }
}