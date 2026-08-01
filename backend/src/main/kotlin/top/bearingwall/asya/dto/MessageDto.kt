package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema
import java.time.LocalDateTime

@Schema(description = "消息类型")
enum class MessageType {
    EVENT, NEWS, CRISIS, SECRET_LETTER, WAR_REPORT, MEMORANDUM, PROTOCOL, AMENDMENT, DECLARATION
}

@Schema(description = "接收者及延迟阅读配置")
data class MessageReceiverDelayItem(
    @Schema(description = "接收者ID(UUID)")
    val receiverId: String,

    @Schema(description = "延迟可读分钟数(>=0)")
    val delayMinutes: Int
)

@Schema(description = "接收者及可读时间配置")
data class MessageReceiverReadableAtItem(
    @Schema(description = "接收者ID(UUID)")
    val receiverId: String,

    @Schema(description = "可读时间")
    val readableAt: LocalDateTime
)

@Schema(description = "创建消息请求")
data class MessageCreateRequest(
    @Schema(description = "标题")
    val title: String,

    @Schema(description = "内容(富文本)")
    val content: String,

    @Schema(description = "摘要(可选, 默认截取前30字)")
    val brief: String?,

    @Schema(description = "消息类型: EVENT, NEWS, CRISIS, SECRET_LETTER, WAR_REPORT, MEMORANDUM, PROTOCOL, AMENDMENT, DECLARATION")
    val msgType: MessageType,

    @Schema(description = "发布现实时间(可选，默认为服务器当前时间)")
    val publishRealTime: LocalDateTime? = null,

    @Schema(description = "发布游戏时间")
    val publishGameTime: LocalDateTime,

    @Schema(description = "是否加密(默认为false)")
    val isSecret: Boolean = false,

    @Schema(description = "接收者列表(包含接收者ID和延迟分钟数), 当isSecret为true时有效")
    val receiverIds: List<MessageReceiverDelayItem>? = null,

    @Schema(description = "附件UUID列表")
    val attachmentUuids: List<String>? = null
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
    val isSecret: Boolean?,

    @Schema(description = "接收者列表(包含接收者ID和可读时间，null表示不修改，空数组表示清空)")
    val receiverIds: List<MessageReceiverReadableAtItem>? = null,

    @Schema(description = "附件UUID列表(为空表示清空，null表示不修改)")
    val attachmentUuids: List<String>? = null
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

    @Schema(description = "发送者显示名称")
    val senderDisplayName: String?,

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
    val isSecret: Boolean,

    @Schema(description = "是否有附件(仅详情返回)")
    val hasAttachment: Boolean? = null,

    @Schema(description = "附件UUID列表(仅详情返回)")
    val attachmentUuids: List<String>? = null
)

@Schema(description = "消息接收者可见性响应")
data class MessageReceiverVisibilityResponse(
    @Schema(description = "用户ID")
    val uuid: String,

    @Schema(description = "用户昵称")
    val name: String,

    @Schema(description = "显示名称")
    val displayName: String?,

    @Schema(description = "用户角色")
    val role: top.bearingwall.asya.model.UserRole,

    @Schema(description = "该用户可阅读这条消息的时间")
    val readableAt: LocalDateTime
)
