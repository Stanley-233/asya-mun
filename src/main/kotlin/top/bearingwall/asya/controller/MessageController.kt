package top.bearingwall.asya.controller

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import top.bearingwall.asya.dto.*
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.service.MessageService
import top.bearingwall.asya.service.UserService
import java.util.UUID

@RestController
@RequestMapping("/api/messages")
@Tag(name = "消息管理")
class MessageController(
    private val messageService: MessageService,
    private val userService: UserService
) {

    @Operation(summary = "发布消息", description = "DH、DM、SYS_ADMIN 可发布")
    @PostMapping
    fun create(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestBody request: MessageCreateRequest
    ): ResponseEntity<Result<MessageResponse>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            if (user.role !in listOf(UserRole.DM, UserRole.DH, UserRole.SYS_ADMIN)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Result.failure(BizCode.PERMISSION_DENIED, "无权访问"))
            }
            val response = messageService.createMessage(request, user.uuid!!)
            ResponseEntity.ok(Result.success(response))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "更新消息", description = "DH、DM、SYS_ADMIN 可更新")
    @PutMapping("/{uuid}")
    fun update(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable uuid: UUID,
        @RequestBody request: MessageUpdateRequest
    ): ResponseEntity<Result<MessageResponse>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            if (user.role !in listOf(UserRole.DM, UserRole.DH, UserRole.SYS_ADMIN)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Result.failure(BizCode.PERMISSION_DENIED, "无权访问"))
            }
            val response = messageService.updateMessage(uuid, request)
            ResponseEntity.ok(Result.success(response))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "查询用户关联会议的所有消息", description = "分页查询，列表项省略 content 字段。查看用户当前所属 Conference 下的消息。")
    @GetMapping
    fun getAll(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        pageable: Pageable
    ): ResponseEntity<Result<Page<MessageResponse>>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            val conference = user.conference ?: // Return empty page if user not associated with any conference
            // Alternatively could throw error. Returning empty page is safer for generic UIs.
            return ResponseEntity.ok(Result.success(Page.empty()))
            val page = messageService.getMessagesForConference(conference.uuid!!, pageable)
            ResponseEntity.ok(Result.success(page))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "查询用户的非对称消息", description = "分页查询用户发送或接收的非对称消息。")
    @GetMapping("/secret")
    fun getSecretMessages(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        pageable: Pageable
    ): ResponseEntity<Result<Page<MessageResponse>>> {
         return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            val page = messageService.getSecretMessagesForUser(user.uuid!!, pageable)
            ResponseEntity.ok(Result.success(page))
        } catch (e: Exception) {
           handleException(e)
        }
    }

    @Operation(summary = "查询单条消息详情", description = "查看消息及完整内容。所有登录用户可查看。若消息为secret则检查请求者是否在receivers列表。")
    @GetMapping("/{uuid}")
    fun getOne(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable uuid: UUID
    ): ResponseEntity<Result<MessageResponse>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            val response = messageService.getMessage(uuid, user.uuid!!)
            ResponseEntity.ok(Result.success(response))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "查询消息可见用户", description = "查看某条消息能被哪些用户查看。")
    @GetMapping("/{uuid}/receivers")
    fun getReceivers(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable uuid: UUID
    ): ResponseEntity<Result<List<UserInfoResponse>>> {
         return try {
            userService.getUserFromToken(extractBearer(authorization))
            val response = messageService.getMessageReceivers(uuid)
            ResponseEntity.ok(Result.success(response))
        } catch (e: Exception) {
           handleException(e)
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
        e.printStackTrace()
        return when (e) {
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
}
