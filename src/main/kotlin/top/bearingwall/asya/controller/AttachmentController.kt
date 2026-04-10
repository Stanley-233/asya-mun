package top.bearingwall.asya.controller

import io.jsonwebtoken.JwtException
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.ContentDisposition
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile
import top.bearingwall.asya.dto.AttachmentInfoResponse
import top.bearingwall.asya.dto.AttachmentUploadResponse
import top.bearingwall.asya.dto.BizCode
import top.bearingwall.asya.dto.Result
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.service.AttachmentService
import top.bearingwall.asya.service.UserService
import java.nio.charset.StandardCharsets
import java.util.UUID

@RestController
@RequestMapping("/api/attachments")
@Tag(name = "附件管理")
class AttachmentController(
    private val attachmentService: AttachmentService,
    private val userService: UserService
) {

    @Operation(summary = "上传附件", description = "仅登录用户可上传，单个文件不超过8MB。无需传入targetId。")
    @PostMapping
    fun upload(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestParam("file") file: MultipartFile
    ): ResponseEntity<Result<AttachmentUploadResponse>> {
        return try {
            userService.getUserFromToken(extractBearer(authorization))
            if (file.size > MAX_FILE_SIZE_BYTES) {
                throw IllegalArgumentException("文件大小不能超过8MB")
            }
            val response = attachmentService.uploadAttachment(file)
            ResponseEntity.ok(Result.success(response))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "删除附件", description = "DH、DM、SYS_ADMIN 可删除")
    @DeleteMapping("/{uuid}")
    fun delete(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable uuid: UUID
    ): ResponseEntity<Result<Unit>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            if (user.role !in listOf(UserRole.DM, UserRole.DH, UserRole.SYS_ADMIN)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Result.failure(BizCode.PERMISSION_DENIED, "无权访问"))
            }
            attachmentService.deleteAttachment(uuid)
            ResponseEntity.ok(Result.success(Unit))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "列出所有附件", description = "仅 SYS_ADMIN 可查看，不包含BLOB")
    @GetMapping
    fun listAll(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<Result<List<AttachmentInfoResponse>>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            if (user.role != UserRole.SYS_ADMIN) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Result.failure(BizCode.PERMISSION_DENIED, "需要管理员权限"))
            }
            val response = attachmentService.listAll()
            ResponseEntity.ok(Result.success(response))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "查询单个附件信息", description = "登录用户可查看单个附件信息，不包含BLOB")
    @GetMapping("/{uuid}")
    fun getOne(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable uuid: UUID
    ): ResponseEntity<Result<AttachmentInfoResponse>> {
        return try {
            userService.getUserFromToken(extractBearer(authorization))
            val response = attachmentService.getAttachmentInfo(uuid)
            ResponseEntity.ok(Result.success(response))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "下载附件", description = "登录用户可下载附件")
    @GetMapping("/{uuid}/download")
    fun download(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable uuid: UUID
    ): ResponseEntity<*> {
        return try {
            userService.getUserFromToken(extractBearer(authorization))
            val attachment = attachmentService.getAttachment(uuid)
            val fileName = buildDownloadFileName(attachment.fileName, attachment.fileType)
            val headers = HttpHeaders().apply {
                contentType = MediaType.APPLICATION_OCTET_STREAM
                contentLength = attachment.fileSize
                contentDisposition = buildContentDisposition(fileName)
            }
            ResponseEntity(attachment.fileBlob, headers, HttpStatus.OK)
        } catch (e: Exception) {
            handleException<Any>(e)
        }
    }

    private fun buildContentDisposition(fileName: String): ContentDisposition {
        val asciiFallback = fileName.map { ch -> if (ch.code in 32..126) ch else '_' }.joinToString("")
        return ContentDisposition.attachment()
            .filename(asciiFallback)
            .filename(fileName, StandardCharsets.UTF_8)
            .build()
    }

    private fun buildDownloadFileName(fileName: String, fileType: String): String {
        val safeName = fileName.ifBlank { "file" }
        val safeType = fileType.ifBlank { "bin" }
        return if (safeName.endsWith(".$safeType")) {
            safeName
        } else {
            "$safeName.$safeType"
        }
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
            is JwtException -> ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.TOKEN_INVALID, "Token已失效，请重新登录"))
            is UnsupportedOperationException -> ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
                .body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "未实现"))
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
