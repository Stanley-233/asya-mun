namespace AsyaMun.Core.Errors;

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
