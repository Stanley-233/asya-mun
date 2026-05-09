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
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import top.bearingwall.asya.dto.AuditLogResponse
import top.bearingwall.asya.dto.BizCode
import top.bearingwall.asya.dto.Result
import top.bearingwall.asya.model.AuditActionType
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.service.AuditLogService
import top.bearingwall.asya.service.UserService

@RestController
@RequestMapping("/api/audit-logs")
@Tag(name = "审计日志")
class AuditLogController(
    private val auditLogService: AuditLogService,
    private val userService: UserService
) {

    @Operation(summary = "分页查询审计日志", description = "仅 SYS_ADMIN 可访问，可按操作者、操作类型、成功状态筛选")
    @GetMapping
    fun listAuditLogs(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestParam(required = false) actorName: String?,
        @RequestParam(required = false) actionType: AuditActionType?,
        @RequestParam(required = false) success: Boolean?,
        @RequestParam(required = false) current: Int?,
        @RequestParam(required = false) pageNum: Int?,
        @PageableDefault(sort = ["eventTime", "id"], direction = Sort.Direction.DESC) pageable: Pageable
    ): ResponseEntity<Result<Page<AuditLogResponse>>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            if (user.role != UserRole.SYS_ADMIN) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Result.failure(BizCode.PERMISSION_DENIED, "需要管理员权限"))
            }

            val effectivePageable = resolvePageable(pageable, current, pageNum)
            ResponseEntity.ok(
                Result.success(
                    auditLogService.getAuditLogs(
                        pageable = effectivePageable,
                        actorName = actorName,
                        actionType = actionType,
                        success = success
                    )
                )
            )
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "查询失败"))
        }
    }

    private fun resolvePageable(pageable: Pageable, current: Int?, pageNum: Int?): Pageable {
        val oneBasedPage = current ?: pageNum ?: return pageable
        val zeroBasedPage = (oneBasedPage - 1).coerceAtLeast(0)
        return PageRequest.of(zeroBasedPage, pageable.pageSize, pageable.sort)
    }

    private fun extractBearer(authorization: String): String {
        val prefix = "Bearer "
        require(authorization.startsWith(prefix)) { "Authorization header must start with 'Bearer '" }
        return authorization.substring(prefix.length)
    }
}
