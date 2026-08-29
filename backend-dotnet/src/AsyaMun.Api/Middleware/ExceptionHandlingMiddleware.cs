using System.Net;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Errors;

namespace AsyaMun.Api.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            if (context.Response.HasStarted)
            {
                _logger.LogError(ex, "Response already started, aborting error handling");
                throw;
            }

            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        var (statusCode, code, message) = ex switch
        {
            AsyaBusinessException biz => (biz.HttpStatus, biz.Code, biz.Message),
            ForbiddenException f => (StatusCodes.Status403Forbidden, BizCode.PERMISSION_DENIED, f.Message),
            TokenInvalidException t => (StatusCodes.Status200OK, BizCode.TOKEN_INVALID, t.Message),
            KeyNotFoundException k => (StatusCodes.Status200OK, BizCode.PARAM_ERROR, k.Message),
            InvalidOperationException io => (StatusCodes.Status200OK, BizCode.PARAM_ERROR, io.Message),
            UnauthorizedAccessException ua => (StatusCodes.Status401Unauthorized, BizCode.TOKEN_INVALID, ua.Message),
            _ => (StatusCodes.Status200OK, BizCode.PARAM_ERROR, ex.Message ?? "操作失败")
        };

        if (statusCode >= 500)
        {
            _logger.LogError(ex, "Unhandled server error: {Message}", ex.Message);
        }
        else
        {
            _logger.LogWarning("Handled business error [{Code}] {Status}: {Message}",
                code, statusCode, ex.Message);
        }

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json; charset=utf-8";

        var envelope = new
        {
            code = (int)code,
            message,
            data = (object?)null
        };

        await context.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(envelope));
    }
}