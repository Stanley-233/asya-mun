package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema
import top.bearingwall.asya.model.UserRole

@Schema(description = "用户注册请求信息")
data class UserRegistrationRequest(
    @Schema(description = "用户昵称", example = "Asya")
    val name: String,
    @Schema(description = "显示名称", example = "Asya Display")
    val displayName: String? = null,
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
    @Schema(description = "显示名称", example = "Asya Display")
    val displayName: String?,
    @Schema(description = "用户角色", example = "DELEGATE")
    val role: UserRole,
    @Schema(description = "JWT Token", example = "eyJhbGciOiJIUzI1NiJ9...")
    val token: String
)

@Schema(description = "刷新 access token 的响应")
data class TokenRefreshResponse(
    @Schema(description = "新的 access token", example = "eyJhbGciOiJIUzI1NiJ9...")
    val token: String
)

@Schema(description = "批量注册用户请求")
data class BatchRegisterUserItem(
    @Schema(description = "用户昵称", example = "Asya")
    val name: String,
    @Schema(description = "显示名称", example = "Asya Display")
    val displayName: String? = null,
    @Schema(description = "用户密码", example = "securePassword123")
    val password: String
)

@Schema(description = "批量注册请求")
data class BatchRegisterRequest(
    @Schema(description = "关联会议ID")
    val conferenceId: String,
    @Schema(description = "用户列表")
    val users: List<BatchRegisterUserItem>
)

@Schema(description = "批量注册响应")
data class BatchRegisterResponse(
    @Schema(description = "成功注册的用户数量")
    val successCount: Int,
    @Schema(description = "注册成功的用户列表")
    val createdUsers: List<UserInfoResponse>
)

@Schema(description = "批量注册用户项（含角色与用户组）")
data class BatchRegisterFullUserItem(
    @Schema(description = "用户昵称", example = "Asya")
    val name: String,
    @Schema(description = "显示名称", example = "Asya Display")
    val displayName: String? = null,
    @Schema(description = "用户密码", example = "securePassword123")
    val password: String,
    @Schema(description = "用户角色，仅允许 DELEGATE 或 DM", example = "DELEGATE")
    val role: UserRole,
    @Schema(description = "所属用户组名称，不存在则自动创建；留空表示不分配用户组", example = "中国组")
    val groupName: String? = null
)

@Schema(description = "批量注册请求（含角色与用户组）")
data class BatchRegisterFullRequest(
    @Schema(description = "关联会议ID")
    val conferenceId: String,
    @Schema(description = "用户列表")
    val users: List<BatchRegisterFullUserItem>
)
