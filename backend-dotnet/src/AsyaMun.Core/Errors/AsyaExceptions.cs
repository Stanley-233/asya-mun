

namespace AsyaMun.Core.Errors;

public class AsyaBusinessException : Exception
{
    public BizCode Code { get; }

    public int HttpStatus { get; }

    public AsyaBusinessException(BizCode code, string message, int httpStatus = 200)
        : base(message)
    {
        Code = code;
        HttpStatus = httpStatus;
    }

    public static AsyaBusinessException Permission(string message)
    {
        return new AsyaBusinessException(BizCode.PERMISSION_DENIED, message, 403);
    }

    public static AsyaBusinessException TokenInvalid(string message)
    {
        return new AsyaBusinessException(BizCode.TOKEN_INVALID, message);
    }

    public static AsyaBusinessException ParamError(string message)
    {
        return new AsyaBusinessException(BizCode.PARAM_ERROR, message);
    }
}

public class ForbiddenException : Exception
{
    public ForbiddenException(string message)
        : base(message)
    {
    }
}

public class TokenInvalidException : Exception
{
    public TokenInvalidException(string message)
        : base(message)
    {
    }
}