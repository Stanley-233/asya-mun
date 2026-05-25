package top.bearingwall.asya.controller

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.web.PageableDefault
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import top.bearingwall.asya.dto.BizCode
import top.bearingwall.asya.dto.InstructionCreateRequest
import top.bearingwall.asya.dto.InstructionResponse
import top.bearingwall.asya.dto.InstructionReviewRequest
import top.bearingwall.asya.dto.InstructionSubmissionSwitchRequest
import top.bearingwall.asya.dto.Result
import top.bearingwall.asya.model.InstructionStatus
import top.bearingwall.asya.model.InstructionType
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.service.InstructionService
import top.bearingwall.asya.service.UserService
import java.util.UUID

@RestController
@RequestMapping("/api/instructions")
@Tag(name = "指令管理")
class InstructionController(
    private val instructionService: InstructionService,
    private val userService: UserService,
    private val conferenceService: top.bearingwall.asya.service.ConferenceService
) {

    @Operation(summary = "提交指令", description = "仅代表可提交，提交后不可修改")
    @PostMapping
    fun create(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestBody request: InstructionCreateRequest
    ): ResponseEntity<Result<InstructionResponse>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            if (user.role != UserRole.DELEGATE) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Result.failure(BizCode.PERMISSION_DENIED, "仅代表可提交指令"))
            }
            ResponseEntity.ok(Result.success(instructionService.createInstruction(request, user.uuid!!)))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "查询我的指令", description = "代表分页查询自己提交的指令")
    @GetMapping("/my")
    fun getMyInstructions(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestParam(required = false) status: InstructionStatus?,
        @RequestParam(required = false) keyword: String?,
        @RequestParam(required = false) current: Int?,
        @RequestParam(required = false) pageNum: Int?,
        @PageableDefault(sort = ["submitRealTime", "uuid"], direction = Sort.Direction.DESC) pageable: Pageable
    ): ResponseEntity<Result<Page<InstructionResponse>>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            val effectivePageable = resolvePageable(pageable, current, pageNum)
            ResponseEntity.ok(Result.success(instructionService.getMyInstructions(user.uuid!!, effectivePageable, status, keyword)))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "查询指令详情", description = "代表仅可查看自己的，DH/DM/SYS_ADMIN 可查看当前会议全部")
    @GetMapping("/{uuid}")
    fun getInstruction(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable uuid: UUID
    ): ResponseEntity<Result<InstructionResponse>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            ResponseEntity.ok(Result.success(instructionService.getInstruction(uuid, user.uuid!!)))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "管理端分页查询指令", description = "DH/DM/SYS_ADMIN 可按状态、类型、用户组、代表多选筛选当前会议的指令")
    @GetMapping("/manage")
    fun getForManagement(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestParam(required = false) status: InstructionStatus?,
        @RequestParam(required = false) instructionType: InstructionType?,
        @RequestParam(required = false) userGroupId: Long?,
        @RequestParam(required = false) submitterUuids: List<UUID>?,
        @RequestParam(required = false) keyword: String?,
        @RequestParam(required = false) current: Int?,
        @RequestParam(required = false) pageNum: Int?,
        @PageableDefault(sort = ["submitRealTime", "uuid"], direction = Sort.Direction.DESC) pageable: Pageable
    ): ResponseEntity<Result<Page<InstructionResponse>>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            val effectivePageable = resolvePageable(pageable, current, pageNum)
            ResponseEntity.ok(
                Result.success(
                    instructionService.queryInstructionsForManagement(
                        requesterUuid = user.uuid!!,
                        pageable = effectivePageable,
                        status = status,
                        instructionType = instructionType,
                        userGroupId = userGroupId,
                        submitterUuids = submitterUuids,
                        keyword = keyword
                    )
                )
            )
        } catch (e: Exception) {
            handleException(e)
        }
    }

    private fun resolvePageable(pageable: Pageable, current: Int?, pageNum: Int?): Pageable {
        val oneBasedPage = current ?: pageNum ?: return pageable
        val zeroBasedPage = (oneBasedPage - 1).coerceAtLeast(0)
        return PageRequest.of(zeroBasedPage, pageable.pageSize, pageable.sort)
    }

    @Operation(summary = "批改指令", description = "DH/DM/SYS_ADMIN 可更新状态并写入当前批阅评语")
    @PostMapping("/{uuid}/review")
    fun review(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable uuid: UUID,
        @RequestBody request: InstructionReviewRequest
    ): ResponseEntity<Result<InstructionResponse>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            ResponseEntity.ok(Result.success(instructionService.reviewInstruction(uuid, user.uuid!!, request)))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "设置会议指令提交暂停开关", description = "仅 DH / SYS_ADMIN 可设置。paused=true 表示暂停提交")
    @PostMapping("/submission-switch")
    fun setSubmissionSwitch(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestParam("paused", required = false) paused: Boolean?,
        @RequestBody(required = false) request: InstructionSubmissionSwitchRequest?
    ): ResponseEntity<Result<Boolean>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            if (user.role !in setOf(UserRole.DH, UserRole.SYS_ADMIN)) {
                throw SecurityException("仅DH或系统管理员可设置")
            }
            val conferenceUuid = user.conference?.uuid ?: throw IllegalStateException("用户未关联任何会议")
            val targetPaused = paused ?: request?.paused
            require(targetPaused != null) { "缺少 paused 参数" }
            conferenceService.setInstructionSubmissionPaused(conferenceUuid, targetPaused)
            ResponseEntity.ok(Result.success(conferenceService.isInstructionSubmissionPaused(conferenceUuid)))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "查询会议指令提交暂停开关")
    @GetMapping("/submission-switch")
    fun getSubmissionSwitch(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<Result<Boolean>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            val conferenceUuid = user.conference?.uuid ?: throw IllegalStateException("用户未关联任何会议")
            ResponseEntity.ok(Result.success(conferenceService.isInstructionSubmissionPaused(conferenceUuid)))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    private fun extractBearer(authorization: String): String {
        val prefix = "Bearer "
        require(authorization.startsWith(prefix)) { "Authorization header must start with 'Bearer '" }
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
}
