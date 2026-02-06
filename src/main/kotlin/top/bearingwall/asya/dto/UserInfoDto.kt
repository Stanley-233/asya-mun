package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema
import top.bearingwall.asya.model.UserRole

@Schema(description = "用户信息响应")
data class UserInfoResponse(
    @Schema(description = "用户ID")
    val uuid: String,
    @Schema(description = "用户昵称")
    val name: String,
    @Schema(description = "显示名称")
    val displayName: String?,
    @Schema(description = "用户角色")
    val role: UserRole
)

@Schema(description = "用户更新请求")
data class UserUpdateRequest(
    @Schema(description = "用户昵称", example = "Asya")
    val name: String? = null,
    @Schema(description = "显示名称", example = "Asya Display")
    val displayName: String? = null,
    @Schema(description = "用户密码", example = "newStrongPassword123")
    val password: String? = null,
    @Schema(description = "用户角色", example = "DELEGATE")
    val role: UserRole? = null
)
