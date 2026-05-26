package top.bearingwall.asya.controller

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import io.jsonwebtoken.JwtException
import jakarta.servlet.http.HttpServletRequest
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.web.PageableDefault
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseCookie
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.CookieValue
import org.springframework.web.bind.annotation.*
import top.bearingwall.asya.dto.BizCode
import top.bearingwall.asya.dto.Result
import top.bearingwall.asya.dto.UserRegistrationRequest
import top.bearingwall.asya.dto.UserResponse
import top.bearingwall.asya.dto.UserInfoResponse
import top.bearingwall.asya.dto.UserUpdateRequest
import top.bearingwall.asya.dto.BatchRegisterRequest
import top.bearingwall.asya.dto.BatchRegisterResponse
import top.bearingwall.asya.dto.TokenRefreshResponse
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.service.SystemConfigService
import top.bearingwall.asya.service.UserService
import java.util.UUID
import java.time.Duration

@RestController
@RequestMapping("/api/users")
@Tag(name = "用户管理", description = "用户注册等相关接口")
class UserController(
    private val userService: UserService,
    private val systemConfigService: SystemConfigService
) {
    companion object {
        private const val REFRESH_COOKIE_NAME = "asya_refresh_token"
        private val REFRESH_COOKIE_MAX_AGE: Duration = Duration.ofDays(30)
    }

    @Operation(
        summary = "用户注册",
        description = "创建新用户。密码会使用 BCrypt 进行加密后存储。"
    )
    @PostMapping("/register")
    fun register(
        requestContext: HttpServletRequest,
        @RequestBody request: UserRegistrationRequest
    ): ResponseEntity<Result<UserResponse>> {
        return try {
            val response = userService.registerUser(request)
            ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.AUTHORIZATION, "Bearer ${response.response.token}")
                .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(response.refreshToken, requestContext).toString())
                .body(Result.success(response.response))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.USER_EXISTS, e.message ?: BizCode.USER_EXISTS.message))
        } catch (e: IllegalStateException) {
            ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.PARAM_ERROR, e.message ?: BizCode.PARAM_ERROR.message))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(
        summary = "用户登录",
        description = "使用用户名和密码登录，成功后返回用户信息与 Bearer Token。"
    )
    @PostMapping("/login")
    fun login(
        requestContext: HttpServletRequest,
        @RequestBody request: UserRegistrationRequest
    ): ResponseEntity<Result<UserResponse>> {
        return try {
            val response = userService.loginUser(request)
            ResponseEntity.status(HttpStatus.OK)
                .header(HttpHeaders.AUTHORIZATION, "Bearer ${response.response.token}")
                .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(response.refreshToken, requestContext).toString())
                .body(Result.success(response.response))
        } catch (_: IllegalStateException) {
            ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.USER_NOT_FOUND, "系统中还没有该用户，请先完成注册"))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.PASSWORD_ERROR, e.message ?: BizCode.PASSWORD_ERROR.message))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "刷新 access token", description = "使用 HttpOnly refresh token cookie 换取新的 access token，并轮换 refresh token")
    @PostMapping("/refresh")
    fun refresh(
        requestContext: HttpServletRequest,
        @CookieValue(name = REFRESH_COOKIE_NAME, required = false) refreshToken: String?
    ): ResponseEntity<Result<TokenRefreshResponse>> {
        return try {
            if (refreshToken.isNullOrBlank()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Result.failure(BizCode.TOKEN_INVALID, "Refresh token 不存在"))
            }

            val response = userService.refreshAccessToken(refreshToken)
            ResponseEntity.ok()
                .header(HttpHeaders.AUTHORIZATION, "Bearer ${response.response.token}")
                .header(HttpHeaders.SET_COOKIE, buildRefreshCookie(response.refreshToken, requestContext).toString())
                .body(Result.success(response.response))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .header(HttpHeaders.SET_COOKIE, clearRefreshCookie(requestContext).toString())
                .body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "Refresh token 无效"))
        }
    }

    @Operation(summary = "退出登录", description = "清除 refresh token cookie")
    @PostMapping("/logout")
    fun logout(
        requestContext: HttpServletRequest
    ): ResponseEntity<Result<Unit>> {
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, clearRefreshCookie(requestContext).toString())
            .body(Result.success(Unit))
    }

    @Operation(summary = "批量注册用户", description = "仅 SYS_ADMIN 可访问，批量注册代表并关联到会议")
    @PostMapping("/batch")
    fun batchRegister(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestBody request: BatchRegisterRequest
    ): ResponseEntity<Result<BatchRegisterResponse>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            val requesterUuid = requester.uuid ?: throw IllegalStateException("Requester id missing")
            val response = userService.batchRegister(requesterUuid, request)
            ResponseEntity.ok(Result.success(response))
        } catch (e: SecurityException) {
            ResponseEntity.status(HttpStatus.FORBIDDEN).body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "Access Denied"))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "参数错误"))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "Error"))
        }
    }

    @Operation(summary = "分页查询用户", description = "仅系统管理员可访问，可按昵称、显示名称、关联会议、角色筛选")
    @GetMapping
    fun listAll(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestParam(required = false) name: String?,
        @RequestParam(required = false) displayName: String?,
        @RequestParam(required = false) conferenceUuid: UUID?,
        @RequestParam(required = false) role: UserRole?,
        @RequestParam(required = false) current: Int?,
        @RequestParam(required = false) pageNum: Int?,
        @PageableDefault(sort = ["name"], direction = Sort.Direction.ASC) pageable: Pageable
    ): ResponseEntity<Result<Page<UserInfoResponse>>> {
        return try {
            val user = userService.getUserFromToken(extractBearer(authorization))
            if (user.role != UserRole.SYS_ADMIN) {
                return ResponseEntity.status(HttpStatus.OK)
                    .body(Result.failure(BizCode.TOKEN_INVALID, "需要管理员权限"))
            }

            val effectivePageable = resolvePageable(pageable, current, pageNum)
            val users = userService.getUsers(
                pageable = effectivePageable,
                name = name,
                displayName = displayName,
                conferenceUuid = conferenceUuid,
                role = role
            )
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
        } catch (e: Exception) {
            if (e is JwtException) {
                return ResponseEntity.status(HttpStatus.OK)
                    .body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "Token失效"))
            }
            val status = if (e is IllegalArgumentException && e.message == "Permission denied") {
                HttpStatus.FORBIDDEN
            } else {
                HttpStatus.OK
            }
            ResponseEntity.status(status)
                .body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "Update failed"))
        }
    }

    @Operation(summary = "管理员重置用户密码", description = "仅系统管理员可执行")
    @PostMapping("/{uuid}/password-reset")
    fun resetPassword(
        @PathVariable uuid: UUID,
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestBody body: Map<String, String>
    ): ResponseEntity<Result<Unit>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            if (requester.role != UserRole.SYS_ADMIN) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Result.failure(BizCode.PERMISSION_DENIED, "需要管理员权限"))
            }

            val newPassword = body["password"]
            if (newPassword.isNullOrBlank()) {
                throw IllegalArgumentException("密码不能为空")
            }

            userService.resetPassword(uuid, newPassword)

            ResponseEntity.ok(Result.success(Unit))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "删除用户", description = "仅系统管理员可执行")
    @DeleteMapping("/{uuid}")
    fun deleteUser(
        @PathVariable uuid: UUID,
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<Result<Unit>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            if (requester.role != UserRole.SYS_ADMIN) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Result.failure(BizCode.PERMISSION_DENIED, "需要管理员权限"))
            }

            userService.deleteUser(uuid)
            ResponseEntity.ok(Result.success(Unit))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "设置是否允许注册", description = "仅系统管理员可执行。true: 允许, false: 禁止")
    @PostMapping("/registration-switch")
    fun setRegistrationSwitch(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestParam allowed: Boolean
    ): ResponseEntity<Result<Boolean>> {
        return try {
            val requester = userService.getUserFromToken(extractBearer(authorization))
            if (requester.role != UserRole.SYS_ADMIN) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Result.failure(BizCode.PERMISSION_DENIED, "需要管理员权限"))
            }

            systemConfigService.setRegistrationAllowed(allowed)
            ResponseEntity.ok(Result.success(allowed))
        } catch (e: Exception) {
            handleException(e)
        }
    }

    @Operation(summary = "查询当前是否允许注册")
    @GetMapping("/registration-switch")
    fun getRegistrationSwitch(): ResponseEntity<Result<Boolean>> {
        return try {
            val allowed = userService.isRegistrationAvailable()
            ResponseEntity.ok(Result.success(allowed))
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

    private fun resolvePageable(pageable: Pageable, current: Int?, pageNum: Int?): Pageable {
        val oneBasedPage = current ?: pageNum ?: return pageable
        val zeroBasedPage = (oneBasedPage - 1).coerceAtLeast(0)
        return PageRequest.of(zeroBasedPage, pageable.pageSize, pageable.sort)
    }

    private fun buildRefreshCookie(refreshToken: String, request: HttpServletRequest): ResponseCookie {
        return ResponseCookie.from(REFRESH_COOKIE_NAME, refreshToken)
            .httpOnly(true)
            .secure(isSecureRequest(request))
            .sameSite("Lax")
            .path("/api/users")
            .maxAge(REFRESH_COOKIE_MAX_AGE)
            .build()
    }

    private fun clearRefreshCookie(request: HttpServletRequest): ResponseCookie {
        return ResponseCookie.from(REFRESH_COOKIE_NAME, "")
            .httpOnly(true)
            .secure(isSecureRequest(request))
            .sameSite("Lax")
            .path("/api/users")
            .maxAge(Duration.ZERO)
            .build()
    }

    private fun isSecureRequest(request: HttpServletRequest): Boolean {
        return request.isSecure || request.getHeader("X-Forwarded-Proto")?.equals("https", ignoreCase = true) == true
    }

    private fun <T> handleException(e: Exception): ResponseEntity<Result<T>> {
        if (e is JwtException) {
            return ResponseEntity.status(HttpStatus.OK)
                .body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "Token失效"))
        }
        return ResponseEntity.status(HttpStatus.OK)
            .body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "操作失败"))
    }
}
