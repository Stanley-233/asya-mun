package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema
import top.bearingwall.asya.model.AttachmentTargetType

@Schema(description = "上传附件响应")
data class AttachmentUploadResponse(
    @Schema(description = "附件UUID")
    val uuid: String,

    @Schema(description = "文件名(不含后缀)")
    val fileName: String,

    @Schema(description = "文件后缀")
    val fileType: String
)

@Schema(description = "附件信息(不含BLOB)")
data class AttachmentInfoResponse(
    @Schema(description = "附件UUID")
    val uuid: String,

    @Schema(description = "文件名(不含后缀)")
    val fileName: String,

    @Schema(description = "文件后缀")
    val fileType: String,

    @Schema(description = "文件大小(字节)")
    val fileSize: Long,

    @Schema(description = "关联目标类型")
    val targetType: AttachmentTargetType?,

    @Schema(description = "关联目标UUID")
    val targetId: String?,

    @Schema(description = "关联消息UUID")
    val messageId: String?
)
