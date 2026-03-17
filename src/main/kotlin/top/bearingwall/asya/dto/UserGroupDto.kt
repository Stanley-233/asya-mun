package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema

@Schema(description = "用户组创建/更新请求")
data class UserGroupRequest(
    @Schema(description = "组名称")
    val groupName: String
)

@Schema(description = "用户组成员设置请求")
data class UserGroupMembersRequest(
    @Schema(description = "用户UUID列表")
    val userUuids: List<String>
)

@Schema(description = "用户组响应")
data class UserGroupResponse(
    @Schema(description = "组ID")
    val id: Long,
    @Schema(description = "组名称")
    val groupName: String,
    @Schema(description = "成员UUID列表")
    val userUuids: List<String>
)
