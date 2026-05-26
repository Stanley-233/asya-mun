package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema
import java.time.LocalDateTime

@Schema(description = "代表端通知类型")
enum class NotificationKind {
    PUBLIC_MESSAGE,
    SECRET_MESSAGE,
    INSTRUCTION_FEEDBACK
}

@Schema(description = "代表端通知同步请求")
data class NotificationSyncRequest(
    @Schema(description = "该浏览器已展示到的最新公开消息时间")
    val publicMessageAfter: LocalDateTime? = null,

    @Schema(description = "该浏览器已展示到的最新非对称消息可读时间")
    val secretMessageAfter: LocalDateTime? = null,

    @Schema(description = "该浏览器已展示到的最新指令反馈时间")
    val instructionFeedbackAfter: LocalDateTime? = null,
)

@Schema(description = "代表端通知事件")
data class NotificationEventResponse(
    @Schema(description = "稳定事件ID，用于前端去重")
    val eventId: String,

    @Schema(description = "通知类型")
    val kind: NotificationKind,

    @Schema(description = "事件发生时间")
    val occurredAt: LocalDateTime,

    @Schema(description = "消息UUID")
    val messageUuid: String? = null,

    @Schema(description = "指令UUID")
    val instructionUuid: String? = null,

    @Schema(description = "通知标题")
    val title: String,

    @Schema(description = "通知摘要")
    val brief: String,

    @Schema(description = "发送者或批改人名称")
    val senderName: String? = null,
)
