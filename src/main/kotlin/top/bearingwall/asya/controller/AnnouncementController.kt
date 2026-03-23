package top.bearingwall.asya.controller

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.ContentDisposition
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import top.bearingwall.asya.dto.AnnouncementImageResponse
import top.bearingwall.asya.dto.BizCode
import top.bearingwall.asya.dto.Result
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.service.AnnouncementService
import top.bearingwall.asya.service.UserService
import java.nio.charset.StandardCharsets

@RestController
@RequestMapping("/api/announcement/image")
@Tag(name = "公告图片")
class AnnouncementController(
    private val announcementService: AnnouncementService,
    private val userService: UserService
) {

    @Operation(summary = "更新公告图片", description = "仅 SYS_ADMIN、DH、DM 可更新公告图片，更新后自动替换旧图。")
    @PutMapping
    fun updateAnnouncementImage(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestParam("file") file: MultipartFile
    ): ResponseEntity<Result<AnnouncementImageResponse>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            if (user.role !in listOf(UserRole.SYS_ADMIN, UserRole.DH, UserRole.DM)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Result.failure(BizCode.PERMISSION_DENIED, "需要管理员或导演权限"))
            }
            if (file.size > MAX_FILE_SIZE_BYTES) {
                throw IllegalArgumentException("文件大小不能超过8MB")
            }
            if (file.contentType?.startsWith("image/") != true) {
                throw IllegalArgumentException("仅支持图片文件")
            }

            val response = announcementService.replaceAnnouncementImage(file)
            ResponseEntity.ok(Result.success(response))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "查询当前公告图片信息", description = "所有登录用户可查看。未设置时 data 为 null。")
    @GetMapping
    fun getAnnouncementImageInfo(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<Result<AnnouncementImageResponse?>> {
        return try {
            userService.getUserFromToken(extractBearer(authorization))
            val response = announcementService.getCurrentAnnouncementImageInfo()
            ResponseEntity.ok(Result.success(response))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "下载当前公告图片", description = "所有登录用户可下载当前公告图片。")
    @GetMapping("/download")
    fun downloadAnnouncementImage(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<*> {
        return try {
            userService.getUserFromToken(extractBearer(authorization))
            val attachment = announcementService.getCurrentAnnouncementImageAttachment()
            val fileName = buildDownloadFileName(attachment.fileName, attachment.fileType)

            val headers = HttpHeaders().apply {
                contentType = resolveImageMediaType(attachment.fileType)
                contentLength = attachment.fileSize
                contentDisposition = buildInlineContentDisposition(fileName)
            }

            ResponseEntity(attachment.fileBlob, headers, HttpStatus.OK)
        } catch (e: Exception) {
            handleException<Any>(e)
        }
    }

    private fun resolveImageMediaType(fileType: String): MediaType {
        val normalized = fileType.lowercase()
        return when (normalized) {
            "jpg", "jpeg" -> MediaType.IMAGE_JPEG
            "png" -> MediaType.IMAGE_PNG
            "gif" -> MediaType.IMAGE_GIF
            "webp" -> MediaType.parseMediaType("image/webp")
            "bmp" -> MediaType.parseMediaType("image/bmp")
            "svg" -> MediaType.parseMediaType("image/svg+xml")
            else -> MediaType.APPLICATION_OCTET_STREAM
        }
    }

    private fun buildInlineContentDisposition(fileName: String): ContentDisposition {
        val asciiFallback = fileName.map { ch -> if (ch.code in 32..126) ch else '_' }.joinToString("")
        return ContentDisposition.inline()
            .filename(asciiFallback)
            .filename(fileName, StandardCharsets.UTF_8)
            .build()
    }

    private fun buildDownloadFileName(fileName: String, fileType: String): String {
        val safeName = fileName.ifBlank { "announcement" }
        val safeType = fileType.ifBlank { "bin" }
        return if (safeName.endsWith(".$safeType")) safeName else "$safeName.$safeType"
    }

    private fun extractBearer(authorization: String): String {
        val prefix = "Bearer "
        if (!authorization.startsWith(prefix)) {
            throw IllegalArgumentException("Authorization header must start with 'Bearer '")
        }
        return authorization.substring(prefix.length)
    }

    private fun <T> handleException(e: Exception): ResponseEntity<Result<T>> {
        return when (e) {
            is IllegalArgumentException -> ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "参数错误"))
            is IllegalStateException -> ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "状态错误"))
            is SecurityException -> ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Result.failure(BizCode.PERMISSION_DENIED, e.message ?: "权限不足"))
            else -> ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "操作失败"))
        }
    }

    companion object {
        private const val MAX_FILE_SIZE_BYTES: Long = 8L * 1024L * 1024L
    }
}
