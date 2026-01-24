package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema
import top.bearingwall.asya.model.ConferenceStatus

@Schema(description = "会议信息请求")
data class ConferenceRequest(
    @Schema(description = "会议名称")
    val name: String,
    @Schema(description = "会议描述")
    val description: String,
    @Schema(description = "会议状态")
    val status: ConferenceStatus? = null
)

@Schema(description = "会议信息响应")
data class ConferenceResponse(
    @Schema(description = "会议ID")
    val uuid: String,
    @Schema(description = "会议名称")
    val name: String,
    @Schema(description = "会议描述")
    val description: String,
    @Schema(description = "会议状态")
    val status: ConferenceStatus
)

@Schema(description = "用户关联会议请求")
data class ConferenceAssignRequest(
    @Schema(description = "会议ID")
    val conferenceUuid: String,
    @Schema(description = "用户ID")
    val userUuid: String
)
