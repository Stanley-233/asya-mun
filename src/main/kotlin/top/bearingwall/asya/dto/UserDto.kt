package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema
import top.bearingwall.asya.model.UserRole

@Schema(description = "用户注册请求信息")
data class UserRegistrationRequest(
    @Schema(description = "用户昵称", example = "Asya")
    val name: String,
    @Schema(description = "用户密码", example = "securePassword123")
    val password: String,
    @Schema(description = "用户角色", example = "DELEGATE")
    val role: UserRole
)

@Schema(description = "用户响应信息")
data class UserResponse(
    @Schema(description = "用户ID", example = "user_123456")
    val uuid: String,
    @Schema(description = "用户昵称", example = "Asya")
    val name: String,
    @Schema(description = "用户角色", example = "DELEGATE")
    val role: UserRole,
    @Schema(description = "JWT Token", example = "eyJhbGciOiJIUzI1NiJ9...")
    val token: String
)
