package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema
import java.time.LocalDateTime

@Schema(description = "消息类型")
enum class MessageType {
    EVENT, NEWS, CRISIS, SECRET_LETTER, WAR_REPORT
}

@Schema(description = "创建消息请求")
data class MessageCreateRequest(
    @Schema(description = "标题")
    val title: String,

    @Schema(description = "内容(富文本)")
    val content: String,

    @Schema(description = "摘要(可选, 默认截取前30字)")
    val brief: String?,

    @Schema(description = "消息类型: EVENT, NEWS, CRISIS, SECRET_LETTER, WAR_REPORT")
    val msgType: MessageType,

    @Schema(description = "发布现实时间(可选，默认为服务器当前时间)")
    val publishRealTime: LocalDateTime? = null,

    @Schema(description = "发布游戏时间")
    val publishGameTime: LocalDateTime,

    @Schema(description = "是否加密(默认为false)")
    val isSecret: Boolean = false,

    @Schema(description = "接收者ID列表(UUID), 当isSecret为true时有效")
    val receiverIds: List<String>? = null
)

@Schema(description = "更新消息请求")
data class MessageUpdateRequest(
    @Schema(description = "标题")
    val title: String?,

    @Schema(description = "内容")
    val content: String?,

    @Schema(description = "摘要")
    val brief: String?,

    @Schema(description = "消息类型")
    val msgType: MessageType?,

    @Schema(description = "发布现实时间")
    val publishRealTime: LocalDateTime?,

    @Schema(description = "发布游戏时间")
    val publishGameTime: LocalDateTime?,

    @Schema(description = "是否加密")
    val isSecret: Boolean?
)

@Schema(description = "消息详情响应")
data class MessageResponse(
    @Schema(description = "消息UUID")
    val uuid: String,

    @Schema(description = "会议UUID")
    val conferenceId: String,

    @Schema(description = "发送者UUID")
    val senderId: String?,

    @Schema(description = "发送者名称")
    val senderName: String?,

    @Schema(description = "标题")
    val title: String?,

    @Schema(description = "摘要")
    val brief: String?,

    @Schema(description = "内容(列表查询时为空)")
    val content: String?,

    @Schema(description = "消息类型")
    val msgType: MessageType?,

    @Schema(description = "发布现实时间")
    val publishRealTime: LocalDateTime,

    @Schema(description = "发布游戏时间")
    val publishGameTime: LocalDateTime,

    @Schema(description = "是否加密")
    val isSecret: Boolean
)
