package top.bearingwall.asya.controller

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import top.bearingwall.asya.dto.BizCode
import top.bearingwall.asya.dto.ConferenceAssignRequest
import top.bearingwall.asya.dto.ConferenceRequest
import top.bearingwall.asya.dto.ConferenceResponse
import top.bearingwall.asya.dto.Result
import top.bearingwall.asya.dto.UserInfoResponse
import top.bearingwall.asya.service.ConferenceService
import top.bearingwall.asya.service.UserService
import java.util.UUID

@RestController
@RequestMapping("/api/conference")
@Tag(name = "会议管理")
class ConferenceController(
    private val conferenceService: ConferenceService,
    private val userService: UserService
) {
    @Operation(summary = "新建会议", description = "仅 SYS_ADMIN 可创建会议")
    @PostMapping
    fun create(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestBody req: ConferenceRequest
    ): ResponseEntity<Result<ConferenceResponse>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            val resp = conferenceService.createConference(requester, req)
            ResponseEntity.status(HttpStatus.CREATED).body(Result.success(resp))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "参数错误"))
        } catch (e: IllegalStateException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "状态错误"))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "Token解析失败"))
        }
    }

    @Operation(summary = "更新会议信息", description = "DH、DM、SYS_ADMIN 可更新当前关联会议")
    @PutMapping
    fun update(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestBody req: ConferenceRequest
    ): ResponseEntity<Result<ConferenceResponse>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            val resp = conferenceService.updateConference(requester, req)
            ResponseEntity.ok(Result.success(resp))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "参数错误"))
        } catch (e: IllegalStateException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "状态错误"))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "Token解析失败"))
        }
    }

    @Operation(summary = "查看当前用户关联会议信息")
    @GetMapping
    fun getMine(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<Result<ConferenceResponse>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            val resp = conferenceService.getMyConference(requester)
            ResponseEntity.ok(Result.success(resp))
        } catch (e: IllegalStateException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "未关联会议"))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "Token解析失败"))
        }
    }

    @Operation(summary = "查看当前会议关联所有用户")
    @GetMapping("/users")
    fun getUsers(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<Result<List<UserInfoResponse>>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            val resp = conferenceService.getConferenceUsers(requester)
            ResponseEntity.ok(Result.success(resp))
        } catch (e: IllegalStateException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "未关联会议"))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "Token解析失败"))
        }
    }

    @Operation(summary = "列出所有会议", description = "仅 SYS_ADMIN 可用")
    @GetMapping("/all")
    fun listAll(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<Result<List<ConferenceResponse>>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            val resp = conferenceService.listAll(requester)
            ResponseEntity.ok(Result.success(resp))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "参数错误"))
        } catch (e: IllegalStateException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "状态错误"))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "Token解析失败"))
        }
    }

    @Operation(summary = "将用户关联到会议", description = "仅 SYS_ADMIN 可用")
    @PostMapping("/assign")
    fun assignUser(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestBody req: ConferenceAssignRequest
    ): ResponseEntity<Result<UserInfoResponse>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            val resp = conferenceService.assignUserToConference(
                requester = requester,
                conferenceUuid = UUID.fromString(req.conferenceUuid),
                userUuid = UUID.fromString(req.userUuid)
            )
            ResponseEntity.ok(Result.success(resp))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "参数错误"))
        } catch (e: IllegalStateException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "状态错误"))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "Token解析失败"))
        }
    }

    private fun extractBearer(authorization: String): String {
        val prefix = "Bearer "
        require(authorization.startsWith(prefix)) { "Authorization header must start with 'Bearer '" }
        return authorization.substring(prefix.length)
    }
}
