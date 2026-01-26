package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema

@Schema(description = "会期状态")
enum class SessionStatus {
    PREPARE, RUNNING, PAUSED, ENDED
}

@Schema(description = "创建/修改会期请求")
data class ConferenceSessionRequest(
    @Schema(description = "会期名称")
    val name: String,
    @Schema(description = "会期描述")
    val description: String?,
    @Schema(description = "会期状态")
    val status: SessionStatus
)

@Schema(description = "会期响应信息")
data class ConferenceSessionResponse(
    @Schema(description = "会期ID")
    val uuid: String,
    @Schema(description = "所属会议ID")
    val conferenceId: String,
    @Schema(description = "会期名称")
    val name: String,
    @Schema(description = "会期描述")
    val description: String?,
    @Schema(description = "会期状态")
    val status: SessionStatus
)
