package top.bearingwall.asya.controller

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.web.PageableDefault
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import top.bearingwall.asya.dto.BizCode
import top.bearingwall.asya.dto.DelegateAttrConfigCreateRequest
import top.bearingwall.asya.dto.DelegateAttrConfigResponse
import top.bearingwall.asya.dto.DelegateAttrConfigUpdateRequest
import top.bearingwall.asya.dto.DelegateAttrManageQueryRequest
import top.bearingwall.asya.dto.DelegateAttrRecordPageResponse
import top.bearingwall.asya.dto.DelegateAttrRecordResponse
import top.bearingwall.asya.dto.DelegateAttrRecordUpsertRequest
import top.bearingwall.asya.dto.Result
import top.bearingwall.asya.service.DelegateAttrService
import top.bearingwall.asya.service.UserService
import java.util.UUID

@RestController
@RequestMapping("/api/delegate-attrs")
@Tag(name = "代表属性管理")
class DelegateAttrController(
    private val delegateAttrService: DelegateAttrService,
    private val userService: UserService
) {

    @Operation(summary = "创建属性配置", description = "仅 SYS_ADMIN / DH / DM 可访问")
    @PostMapping("/configs")
    fun createConfig(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestBody request: DelegateAttrConfigCreateRequest
    ): ResponseEntity<Result<DelegateAttrConfigResponse>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            val response = delegateAttrService.createConfig(requester.uuid!!, request)
            ResponseEntity.status(HttpStatus.CREATED).body(Result.success(response))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "更新属性配置", description = "仅 SYS_ADMIN / DH / DM 可访问")
    @PutMapping("/configs/{configId}")
    fun updateConfig(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable configId: UUID,
        @RequestBody request: DelegateAttrConfigUpdateRequest
    ): ResponseEntity<Result<DelegateAttrConfigResponse>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            val response = delegateAttrService.updateConfig(requester.uuid!!, configId, request)
            ResponseEntity.ok(Result.success(response))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "获取当前会议属性配置", description = "需要登录")
    @GetMapping("/configs")
    fun listConfigs(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<Result<List<DelegateAttrConfigResponse>>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            ResponseEntity.ok(Result.success(delegateAttrService.listConfigs(requester.uuid!!)))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "代表查询自己的属性记录", description = "仅 DELEGATE 可访问")
    @GetMapping("/my-records")
    fun listMyRecords(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PageableDefault(sort = ["updatedAt"], direction = Sort.Direction.DESC) pageable: Pageable
    ): ResponseEntity<Result<DelegateAttrRecordPageResponse>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            ResponseEntity.ok(Result.success(delegateAttrService.listMyRecords(requester.uuid!!, pageable)))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "为代表新增属性记录", description = "仅 SYS_ADMIN / DH / DM 可访问")
    @PostMapping("/delegates/{delegateId}/records")
    fun createRecord(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable delegateId: UUID,
        @RequestBody request: DelegateAttrRecordUpsertRequest
    ): ResponseEntity<Result<DelegateAttrRecordResponse>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            val response = delegateAttrService.createRecordForDelegate(requester.uuid!!, delegateId, request)
            ResponseEntity.status(HttpStatus.CREATED).body(Result.success(response))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "覆盖更新代表属性记录", description = "仅 SYS_ADMIN / DH / DM 可访问")
    @PutMapping("/delegates/{delegateId}/records/{recordId}")
    fun updateRecord(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable delegateId: UUID,
        @PathVariable recordId: UUID,
        @RequestBody request: DelegateAttrRecordUpsertRequest
    ): ResponseEntity<Result<DelegateAttrRecordResponse>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            val response = delegateAttrService.updateRecordForDelegate(requester.uuid!!, delegateId, recordId, request)
            ResponseEntity.ok(Result.success(response))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "删除代表属性记录", description = "仅 SYS_ADMIN / DH / DM 可访问")
    @DeleteMapping("/delegates/{delegateId}/records/{recordId}")
    fun deleteRecord(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable delegateId: UUID,
        @PathVariable recordId: UUID
    ): ResponseEntity<Result<Unit>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            delegateAttrService.deleteRecordForDelegate(requester.uuid!!, delegateId, recordId)
            ResponseEntity.ok(Result.success(Unit))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "学团分页查询代表属性记录", description = "支持代表多选和属性等值过滤")
    @PostMapping("/manage/query")
    fun queryForManagement(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestBody request: DelegateAttrManageQueryRequest,
        @PageableDefault(sort = ["updatedAt"], direction = Sort.Direction.DESC) pageable: Pageable
    ): ResponseEntity<Result<DelegateAttrRecordPageResponse>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            val response = delegateAttrService.queryForManagement(requester.uuid!!, request, pageable)
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
        return when (e) {
            is SecurityException -> ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Result.failure(BizCode.PERMISSION_DENIED, e.message ?: "权限不足"))
            is IllegalArgumentException, is IllegalStateException -> ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "参数错误"))
            else -> ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "操作失败"))
        }
    }
}
