package top.bearingwall.asya.controller

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import top.bearingwall.asya.dto.BizCode
import top.bearingwall.asya.dto.Result
import top.bearingwall.asya.dto.UserRegistrationRequest
import top.bearingwall.asya.dto.UserResponse
import top.bearingwall.asya.dto.UserInfoResponse
import top.bearingwall.asya.dto.UserUpdateRequest
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.service.UserService
import java.util.UUID

@RestController
@RequestMapping("/api/users")
@Tag(name = "用户管理", description = "用户注册等相关接口")
class UserController(
    private val userService: UserService
) {
    @Operation(
        summary = "用户注册",
        description = "创建新用户。密码会使用 BCrypt 进行加密后存储。"
    )
    @PostMapping("/register")
    fun register(
        @RequestBody request: UserRegistrationRequest
    ): ResponseEntity<Result<UserResponse>> {
        return try {
            val response = userService.registerUser(request)
            ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.AUTHORIZATION, "Bearer ${'$'}{response.token}")
                .body(Result.success(response))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.USER_EXISTS, e.message ?: BizCode.USER_EXISTS.message))
        }
    }

    @PostMapping("/login")
    fun login(
        @RequestBody request: UserRegistrationRequest
    ): ResponseEntity<Result<UserResponse>> {
        return try {
            val response = userService.loginUser(request)
            ResponseEntity.status(HttpStatus.OK)
                .header(HttpHeaders.AUTHORIZATION, "Bearer ${'$'}{response.token}")
                .body(Result.success(response))
        } catch (_: IllegalStateException) {
            ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.USER_NOT_FOUND, BizCode.USER_NOT_FOUND.message))
        } catch (_: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.PASSWORD_ERROR, BizCode.PASSWORD_ERROR.message))
        }
    }

    @Operation(summary = "获取所有用户", description = "仅系统管理员可访问")
    @GetMapping
    fun listAll(@RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String): ResponseEntity<Result<List<UserInfoResponse>>> {
        return try {
            val token = extractBearer(authorization)
            // 简单校验角色：从 token 中解析角色
            val parsed = top.bearingwall.asya.util.JwtUtil.parseToken(token)
            val role = parsed.claims["role"]?.toString()
            if (role != UserRole.SYS_ADMIN.name) {
                return ResponseEntity.status(HttpStatus.OK)
                    .body(Result.failure(BizCode.TOKEN_INVALID, "需要管理员权限"))
            }
            val users = userService.getAllUsers()
            ResponseEntity.ok(Result.success(users))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "Token解析失败"))
        }
    }

    @Operation(summary = "获取当前登录用户信息")
    @GetMapping("/user")
    fun getCurrentUser(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<Result<UserInfoResponse>> {
        return try {
            val token = extractBearer(authorization)
            val info = userService.getCurrentUserInfo(token)
            ResponseEntity.ok(Result.success(info))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "Token解析失败"))
        }
    }

    @Operation(summary = "更新用户信息", description = "管理员可修改所有用户；普通用户仅能修改自己的信息")
    @PutMapping("/user/{uuid}")
    fun updateUser(
        @PathVariable uuid: UUID,
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestBody request: UserUpdateRequest
    ): ResponseEntity<Result<UserInfoResponse>> {
        return try {
            val token = extractBearer(authorization)
            val updated = userService.updateUser(uuid, token, request)
            ResponseEntity.ok(Result.success(updated))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "参数错误"))
        } catch (e: IllegalStateException) {
            ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.USER_NOT_FOUND, e.message ?: "用户不存在"))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "Token解析失败"))
        }
    }

    private fun extractBearer(authorization: String): String {
        val prefix = "Bearer "
        require(authorization.startsWith(prefix)) { "Authorization header must start with 'Bearer '" }
        return authorization.substring(prefix.length)
    }
}
