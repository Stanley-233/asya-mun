package top.bearingwall.asya.controller

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import top.bearingwall.asya.dto.BizCode
import top.bearingwall.asya.dto.Result
import top.bearingwall.asya.dto.UserRegistrationRequest
import top.bearingwall.asya.dto.UserResponse
import top.bearingwall.asya.service.UserService

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
                .body(Result.failure(BizCode.USER_EXISTS, BizCode.USER_EXISTS.message))
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
}
