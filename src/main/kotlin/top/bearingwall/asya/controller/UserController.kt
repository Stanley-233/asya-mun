package top.bearingwall.asya.controller

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import io.swagger.v3.oas.annotations.tags.Tag
import top.bearingwall.asya.dto.UserRegistrationRequest
import top.bearingwall.asya.dto.UserResponse
import top.bearingwall.asya.service.UserService

@RestController
@RequestMapping("/api/users")
@Tag(name = "用户管理")
class UserController(
    private val userService: UserService
) {

    @PostMapping("/register")
    fun register(@RequestBody request: UserRegistrationRequest): ResponseEntity<UserResponse> {
        val response = userService.registerUser(request)
        return ResponseEntity.status(HttpStatus.CREATED).body(response)
    }
}
