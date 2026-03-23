package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema

@Schema(description = "公告图片信息")
data class AnnouncementImageResponse(
    @Schema(description = "附件UUID")
    val uuid: String,

    @Schema(description = "文件名(不含后缀)")
    val fileName: String,

    @Schema(description = "文件后缀")
    val fileType: String,

    @Schema(description = "文件大小(字节)")
    val fileSize: Long
)
