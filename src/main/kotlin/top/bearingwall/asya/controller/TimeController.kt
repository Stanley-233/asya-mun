package top.bearingwall.asya.controller

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import top.bearingwall.asya.dto.*
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.service.TimeService
import top.bearingwall.asya.service.UserService

@RestController
@RequestMapping("/api/time")
@Tag(name = "时间轴管理")
class TimeController(
    private val timeService: TimeService,
    private val userService: UserService,
) {
    @Operation(summary = "查看所有时间锚点", description = "DM、DH、SYS_ADMIN 可查看")
    @GetMapping
    fun getAll(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<Result<List<TimeAnchorResponse>>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            if (user.role !in listOf(UserRole.DM, UserRole.DH, UserRole.SYS_ADMIN)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Result.failure(BizCode.PERMISSION_DENIED, "无权访问"))
            }
            val conferenceId = user.conference?.uuid ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Result.failure(BizCode.PARAM_ERROR, "未加入任何会议"))

            val list = timeService.getAllTimeAnchors(conferenceId)
            ResponseEntity.ok(Result.success(list))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "查看最新时间锚点", description = "所有登录用户可查看")
    @GetMapping("/latest")
    fun getLatest(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<Result<TimeAnchorResponse>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            val conferenceId = user.conference?.uuid ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Result.failure(BizCode.PARAM_ERROR, "未加入任何会议"))

            val latest = timeService.getLatestTimeAnchor(conferenceId)
            if (latest != null) {
                ResponseEntity.ok(Result.success(latest))
            } else {
                ResponseEntity.ok(Result.failure(BizCode.PARAM_ERROR, "无时间锚点"))
            }
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "订阅时间轴变化", description = "SSE流")
    @GetMapping("/stream", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun stream(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): SseEmitter {
        // 验证用户身份
        val user = userService.getUserFromToken(extractBearer(authorization))
        val conferenceId = user.conference?.uuid ?: throw IllegalArgumentException("未加入任何会议")
        return timeService.subscribe(conferenceId)
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
            else -> ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "操作失败"))
        }
    }

    @Operation(summary = "启动/恢复/变速时间轴", description = "仅 DM、DH、SYS_ADMIN 可操作")
    @PostMapping("/update")
    fun update(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestBody request: TimeUpdateRequest
    ): ResponseEntity<Result<TimeAnchorResponse>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            if (user.role !in listOf(UserRole.DM, UserRole.DH, UserRole.SYS_ADMIN)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Result.failure(BizCode.PERMISSION_DENIED, "无权访问"))
            }
            // 确保用户已加入会议
            val conferenceId = user.conference?.uuid ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Result.failure(BizCode.PARAM_ERROR, "未加入任何会议"))

            val resp = timeService.updateTimeAnchor(request, conferenceId)
            ResponseEntity.ok(Result.success(resp))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "时间跨度跳跃", description = "用于时间快进/回滚，仅 DM、DH、SYS_ADMIN 可操作")
    @PostMapping("/jump")
    fun jump(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestBody request: TimeJumpRequest
    ): ResponseEntity<Result<TimeAnchorResponse>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            if (user.role !in listOf(UserRole.DM, UserRole.DH, UserRole.SYS_ADMIN)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Result.failure(BizCode.PERMISSION_DENIED, "无权访问"))
            }

            val conferenceId = user.conference?.uuid ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Result.failure(BizCode.PARAM_ERROR, "未加入任何会议"))

            val resp = timeService.jumpTimeAnchor(request, conferenceId)
            ResponseEntity.ok(Result.success(resp))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "查询当前游戏时间", description = "基于最新锚点计算的实时游戏时间")
    @GetMapping("/current")
    fun getCurrent(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<Result<CurrentTimeResponse>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            val conferenceId = user.conference?.uuid ?: return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Result.failure(BizCode.PARAM_ERROR, "未加入任何会议"))

            val time = timeService.getCurrentGameTime(conferenceId)
            if (time != null) {
                ResponseEntity.ok(Result.success(CurrentTimeResponse(time)))
            } else {
                ResponseEntity.ok(Result.failure(BizCode.PARAM_ERROR, "无时间锚点"))
            }
        } catch (e: Exception) {
            handleException(e)
        }
    }
}
