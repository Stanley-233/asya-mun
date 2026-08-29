using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace AsyaMun.Api.Dtos;

public enum BizCode
{
    SUCCESS = 200,
    PARAM_ERROR = 4001,
    TOKEN_INVALID = 4003,
    USER_NOT_FOUND = 4004,
    PASSWORD_ERROR = 4005,
    USER_EXISTS = 4006,
    PERMISSION_DENIED = 4009
}

public static class BizMessages
{
    public static string Of(BizCode code)
    {
        return code switch
        {
            BizCode.PARAM_ERROR => "参数校验失败",
            BizCode.TOKEN_INVALID => "Token无效",
            BizCode.USER_NOT_FOUND => "用户未注册",
            BizCode.PASSWORD_ERROR => "密码错误",
            BizCode.USER_EXISTS => "用户已存在",
            BizCode.PERMISSION_DENIED => "权限不足",
            _ => "操作成功"
        };
    }
}

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