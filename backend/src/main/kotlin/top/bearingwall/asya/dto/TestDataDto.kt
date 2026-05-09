package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema
import top.bearingwall.asya.model.UserRole

@Schema(description = "测试数据账号信息")
data class TestDataUserResponse(
    @Schema(description = "用户UUID")
    val uuid: String,

    @Schema(description = "用户名")
    val name: String,

    @Schema(description = "显示名")
    val displayName: String?,

    @Schema(description = "角色")
    val role: UserRole,

    @Schema(description = "默认密码")
    val password: String,

    @Schema(description = "登录Token")
    val token: String
)

@Schema(description = "测试数据初始化响应")
data class TestDataBootstrapResponse(
    @Schema(description = "会议UUID")
    val conferenceUuid: String,

    @Schema(description = "会议名称")
    val conferenceName: String,

    @Schema(description = "生成账号列表")
    val users: List<TestDataUserResponse>,

    @Schema(description = "公开消息数量")
    val publicMessageCount: Int,

    @Schema(description = "非对称消息数量")
    val secretMessageCount: Int,

    @Schema(description = "A代表收到的非对称消息数量")
    val secretMessagesForA: Int,

    @Schema(description = "B代表收到的非对称消息数量")
    val secretMessagesForB: Int,

    @Schema(description = "A代表提交的指令数量")
    val instructionCountFromA: Int,

    @Schema(description = "时间流速")
    val timeRatio: String
)
