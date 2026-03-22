package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema
import top.bearingwall.asya.model.RoundStatus
import java.time.LocalDateTime

@Schema(description = "发布回合请求")
data class RoundPublishRequest(
    @Schema(description = "回合名称")
    val name: String,

    @Schema(description = "回合持续时长（秒）")
    val durationSeconds: Long,

    @Schema(description = "初始状态")
    val initialStatus: RoundStatus,

    @Schema(description = "下一回合ID，可为空")
    val nextRoundId: String? = null
)

@Schema(description = "设置下一回合请求")
data class RoundSetNextRequest(
    @Schema(description = "下一回合ID，可为空（清空）")
    val nextRoundId: String? = null
)

@Schema(description = "修改回合请求")
data class RoundUpdateRequest(
    @Schema(description = "回合名称")
    val name: String,

    @Schema(description = "回合总时长（秒）")
    val durationSeconds: Long
)

@Schema(description = "设置当前回合请求")
data class RoundSetCurrentRequest(
    @Schema(description = "要切换成当前回合的 roundId")
    val roundId: String
)

@Schema(description = "回合响应")
data class RoundResponse(
    @Schema(description = "回合ID")
    val roundId: String,

    @Schema(description = "会议ID")
    val conferenceId: String,

    @Schema(description = "回合名称")
    val name: String,

    @Schema(description = "总时长（秒）")
    val durationSeconds: Long,

    @Schema(description = "剩余时长（秒）")
    val remainingSeconds: Long,

    @Schema(description = "回合状态")
    val status: RoundStatus,

    @Schema(description = "是否当前回合")
    val isCurrent: Boolean,

    @Schema(description = "下一回合ID")
    val nextRoundId: String?,

    @Schema(description = "结束时间（仅RUNNING时）")
    val endAt: LocalDateTime?,

    @Schema(description = "服务端时间")
    val serverTime: LocalDateTime
)
