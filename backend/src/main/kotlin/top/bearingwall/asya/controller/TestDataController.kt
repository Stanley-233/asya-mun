package top.bearingwall.asya.controller

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import top.bearingwall.asya.dto.BizCode
import top.bearingwall.asya.dto.Result
import top.bearingwall.asya.dto.TestDataBootstrapResponse
import top.bearingwall.asya.service.TestDataService
import top.bearingwall.asya.service.UserService

@RestController
@RequestMapping("/api/test-data")
@Tag(name = "测试数据")
class TestDataController(
    private val testDataService: TestDataService,
    private val userService: UserService
) {
    @Operation(summary = "生成测试会议与测试数据", description = "仅 SYS_ADMIN 可调用，自动生成 1 个会议、5 个用户、15 条公开消息、15 条非对称消息和 15 条 A 代表指令")
    @PostMapping("/bootstrap")
    fun bootstrap(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<Result<TestDataBootstrapResponse>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            val response = testDataService.bootstrapScenario(requester)
            ResponseEntity.status(HttpStatus.CREATED).body(Result.success(response))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "参数错误"))
        } catch (e: IllegalStateException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "状态错误"))
        } catch (e: SecurityException) {
            ResponseEntity.status(HttpStatus.FORBIDDEN).body(Result.failure(BizCode.PERMISSION_DENIED, e.message ?: "权限不足"))
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
