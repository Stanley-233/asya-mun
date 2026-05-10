package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema
import top.bearingwall.asya.model.InstructionStatus
import top.bearingwall.asya.model.InstructionType
import java.time.LocalDateTime

@Schema(description = "创建指令请求")
data class InstructionCreateRequest(
    @Schema(description = "标题")
    val title: String,

    @Schema(description = "指令类型: MILITARY, DIPLOMACY, INTERNAL, OTHER")
    val instructionType: InstructionType,

    @Schema(description = "指令内容")
    val content: String
)

@Schema(description = "批改指令请求")
data class InstructionReviewRequest(
    @Schema(description = "目标状态: IN_PROGRESS, REJECTED, FEEDBACKED")
    val status: InstructionStatus,

    @Schema(description = "批阅评语")
    val reviewComment: String? = null
)

@Schema(description = "设置会议指令提交暂停开关请求")
data class InstructionSubmissionSwitchRequest(
    @Schema(description = "true 表示暂停提交，false 表示恢复提交")
    val paused: Boolean? = null
)

@Schema(description = "指令响应")
data class InstructionResponse(
    @Schema(description = "指令UUID")
    val uuid: String,

    @Schema(description = "会议UUID")
    val conferenceId: String,

    @Schema(description = "提交人UUID")
    val submitterId: String,

    @Schema(description = "提交人名称")
    val submitterName: String,

    @Schema(description = "标题")
    val title: String,

    @Schema(description = "指令类型")
    val instructionType: InstructionType,

    @Schema(description = "内容")
    val content: String,

    @Schema(description = "状态")
    val status: InstructionStatus,

    @Schema(description = "批阅评语")
    val reviewComment: String?,

    @Schema(description = "提交现实时间")
    val submitRealTime: LocalDateTime,

    @Schema(description = "提交游戏时间")
    val submitGameTime: LocalDateTime,

    @Schema(description = "最后批改人UUID")
    val reviewedById: String? = null,

    @Schema(description = "最后批改人名称")
    val reviewedByName: String? = null,

    @Schema(description = "最后批改现实时间")
    val reviewedRealTime: LocalDateTime? = null,

    @Schema(description = "最后批改游戏时间")
    val reviewedGameTime: LocalDateTime? = null
)
