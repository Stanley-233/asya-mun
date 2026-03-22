package top.bearingwall.asya.controller

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import top.bearingwall.asya.dto.*
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.service.RoundService
import top.bearingwall.asya.service.UserService
import java.util.UUID

@RestController
@RequestMapping("/api/round")
@Tag(name = "回合管理")
class RoundController(
    private val roundService: RoundService,
    private val userService: UserService
) {
    @Operation(summary = "发布回合", description = "DH、DM、SYS_ADMIN 可发布回合，发布后立即切换为当前回合")
    @PostMapping
    fun publish(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestBody request: RoundPublishRequest
    ): ResponseEntity<Result<RoundResponse>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            assertManagePermission(user.role)
            val conferenceId = user.conference?.uuid ?: throw IllegalArgumentException("未加入任何会议")

            val resp = roundService.publishRound(request, conferenceId)
            ResponseEntity.status(HttpStatus.CREATED).body(Result.success(resp))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "设置下一回合", description = "DH、DM、SYS_ADMIN 可设置某个 round 的 nextRoundId（可清空）")
    @PutMapping("/{roundId}/next")
    fun setNext(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable roundId: UUID,
        @RequestBody request: RoundSetNextRequest
    ): ResponseEntity<Result<RoundResponse>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            assertManagePermission(user.role)
            val conferenceId = user.conference?.uuid ?: throw IllegalArgumentException("未加入任何会议")

            val resp = roundService.setNextRound(roundId, request, conferenceId)
            ResponseEntity.ok(Result.success(resp))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "暂停当前回合", description = "DH、DM、SYS_ADMIN 可暂停当前回合")
    @PostMapping("/{roundId}/pause")
    fun pause(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable roundId: UUID
    ): ResponseEntity<Result<RoundResponse>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            assertManagePermission(user.role)
            val conferenceId = user.conference?.uuid ?: throw IllegalArgumentException("未加入任何会议")

            val resp = roundService.pauseRound(roundId, conferenceId)
            ResponseEntity.ok(Result.success(resp))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "恢复当前回合", description = "DH、DM、SYS_ADMIN 可恢复当前回合")
    @PostMapping("/{roundId}/resume")
    fun resume(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable roundId: UUID
    ): ResponseEntity<Result<RoundResponse>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            assertManagePermission(user.role)
            val conferenceId = user.conference?.uuid ?: throw IllegalArgumentException("未加入任何会议")

            val resp = roundService.resumeRound(roundId, conferenceId)
            ResponseEntity.ok(Result.success(resp))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "查询当前回合状态", description = "所有登录用户可查看当前回合与剩余时间")
    @GetMapping("/current")
    fun current(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<Result<RoundResponse?>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            val conferenceId = user.conference?.uuid ?: throw IllegalArgumentException("未加入任何会议")

            val resp = roundService.getCurrentRound(conferenceId)
            ResponseEntity.ok(Result.success(resp))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "参数错误"))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "操作失败"))
        }
    }

    @Operation(summary = "按ID查询回合详情", description = "所有登录用户可查询自己所在会议下的回合详情")
    @GetMapping("/{roundId}")
    fun detail(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable roundId: UUID
    ): ResponseEntity<Result<RoundResponse>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            val conferenceId = user.conference?.uuid ?: throw IllegalArgumentException("未加入任何会议")

            val resp = roundService.getRoundDetail(roundId, conferenceId)
            ResponseEntity.ok(Result.success(resp))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "列出本会议所有回合", description = "DH、DM、SYS_ADMIN 可查看")
    @GetMapping
    fun list(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<Result<List<RoundResponse>>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            assertManagePermission(user.role)
            val conferenceId = user.conference?.uuid ?: throw IllegalArgumentException("未加入任何会议")

            val resp = roundService.listRounds(conferenceId)
            ResponseEntity.ok(Result.success(resp))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    private fun assertManagePermission(role: UserRole) {
        if (role !in listOf(UserRole.DM, UserRole.DH, UserRole.SYS_ADMIN)) {
            throw SecurityException("无权访问")
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
            is SecurityException -> ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Result.failure(BizCode.PERMISSION_DENIED, e.message ?: "无权访问"))
            is IllegalArgumentException -> ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "参数错误"))
            is IllegalStateException -> ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "状态错误"))
            else -> ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "操作失败"))
        }
    }
}
