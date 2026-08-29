using AsyaMun.Api.Dtos;
using Microsoft.AspNetCore.Mvc;

namespace AsyaMun.Api.Controllers;

[ApiController]
[Route("api/hello")]
public class HelloController : ControllerBase
{
    [HttpGet]
    public IActionResult Hello()
    {
        return ApiResp.Ok("Hello World");
    }
}