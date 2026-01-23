package top.bearingwall.asya.dto

import com.fasterxml.jackson.annotation.JsonInclude
import io.swagger.v3.oas.annotations.media.Schema

interface IErrorCode {
    val code: Int
    val message: String
}

// 常用错误枚举
enum class BizCode(override val code: Int, override val message: String) : IErrorCode {
    SUCCESS(200, "操作成功"),
    PARAM_ERROR(4001, "参数校验失败"),
    TOKEN_INVALID(4003, "Token无效");
}

/**
 * 统一接口返回结构
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
@Schema(description = "统一接口返回结构")
data class Result<T>(
    @Schema(description = "状态码", example = "200")
    val code: Int,
    @Schema(description = "提示信息", example = "操作成功")
    val message: String,
    val data: T? = null
) {
    companion object {
        fun <T> success(data: T): Result<T> = Result(
            code = BizCode.SUCCESS.code,
            message = BizCode.SUCCESS.message,
            data = data
        )

        // 无数据的成功响应
        fun success(): Result<Nothing?> = Result(
            code = BizCode.SUCCESS.code,
            message = BizCode.SUCCESS.message,
            data = null
        )

        // 直接传错误枚举
        fun <T> failure(errorCode: IErrorCode): Result<T> = Result(
            code = errorCode.code,
            message = errorCode.message,
            data = null
        )

        // 允许覆盖错误信息的 failure（例如：参数错误，具体是哪个参数错）
        fun <T> failure(errorCode: IErrorCode, customMessage: String): Result<T> = Result(
            code = errorCode.code,
            message = customMessage, // 覆盖默认 message
            data = null
        )
    }
}