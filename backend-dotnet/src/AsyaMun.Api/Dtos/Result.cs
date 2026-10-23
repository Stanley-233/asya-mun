using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace AsyaMun.Api.Dtos;

public class Result<T>
{
    public int Code { get; set; }

    public string Message { get; set; } = "操作成功";

    public T? Data { get; set; }

    public static Result<T> Success(T data)
    {
        return new Result<T>
        {
            Code = (int)BizCode.SUCCESS,
            Message = BizMessages.Of(BizCode.SUCCESS),
            Data = data
        };
    }

    public static Result<T> Failure(BizCode code, string message)
    {
        return new Result<T>
        {
            Code = (int)code,
            Message = message
        };
    }
}

public static class ApiResp
{
    public static IActionResult Ok<T>(T data, int statusCode = StatusCodes.Status200OK)
    {
        return new ObjectResult(Result<T>.Success(data)) { StatusCode = statusCode };
    }

    public static IActionResult Ok()
    {
        return Ok<object?>(null);
    }

    public static IActionResult OkUnit()
    {
        return new ObjectResult(new Result<object>
        {
            Code = (int)BizCode.SUCCESS,
            Message = BizMessages.Of(BizCode.SUCCESS),
            Data = new object()
        })
        {
            StatusCode = StatusCodes.Status200OK
        };
    }

    public static IActionResult Fail<T>(BizCode code, string message, int statusCode = StatusCodes.Status200OK)
    {
        return new ObjectResult(Result<T>.Failure(code, message)) { StatusCode = statusCode };
    }

    public static IActionResult Fail(BizCode code, string message, int statusCode = StatusCodes.Status200OK)
    {
        return Fail<object>(code, message, statusCode);
    }
}