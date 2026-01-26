package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema
import java.math.BigDecimal
import java.time.LocalDateTime

@Schema(description = "时间锚点响应")
data class TimeAnchorResponse(
    @Schema(description = "ID")
    val id: Long,

    @Schema(description = "会期ID")
    val sessionId: String?,

    @Schema(description = "更新时间")
    val updateTime: LocalDateTime?,

    @Schema(description = "锚点物理时间")
    val anchorRealTime: LocalDateTime?,

    @Schema(description = "锚点游戏时间")
    val anchorGameTime: LocalDateTime?,

    @Schema(description = "流速")
    val timeRatio: BigDecimal?,

    @Schema(description = "是否当前生效")
    val isCurrent: Boolean
)

data class TimeUpdateRequest(
    @Schema(description = "会期ID")
    val sessionId: String,

    @Schema(description = "时间流速")
    val timeRatio: BigDecimal
)

data class TimeJumpRequest(
    @Schema(description = "会期ID")
    val sessionId: String,

    @Schema(description = "目标游戏时间")
    val targetGameTime: LocalDateTime,

    @Schema(description = "时间流速")
    val timeRatio: BigDecimal
)

data class CurrentTimeResponse(
    @Schema(description = "当前游戏时间")
    val currentGameTime: LocalDateTime
)
