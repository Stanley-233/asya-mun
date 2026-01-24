package top.bearingwall.asya.service

import org.slf4j.LoggerFactory
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.dto.UserRegistrationRequest
import top.bearingwall.asya.dto.UserResponse
import top.bearingwall.asya.dto.UserInfoResponse
import top.bearingwall.asya.dto.UserUpdateRequest
import top.bearingwall.asya.model.User
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.repository.UserRepository
import top.bearingwall.asya.util.JwtUtil
import java.util.UUID

@Service
class UserService(
    private val userRepository: UserRepository
) {

    private val log = LoggerFactory.getLogger(UserService::class.java)
    private val passwordEncoder = BCryptPasswordEncoder()

    @Transactional
    fun registerUser(request: UserRegistrationRequest): UserResponse {
        log.info("Registering user, name={}, role={}", request.name, request.role)

        val existing = userRepository.findByName(request.name)
        require(existing == null) { "User already exists: ${'$'}{request.name}" }

        val hashedPassword: String = requireNotNull(passwordEncoder.encode(request.password)) {
            "BCryptPasswordEncoder returned null hash"
        }

        val user = User(
            name = request.name,
            password = hashedPassword,
            role = request.role
        )

        val savedUser = userRepository.save(user)

        log.info("User registered successfully, uuid={}, name={}", savedUser.uuid, savedUser.name)

        val userId = savedUser.uuid ?: throw IllegalStateException("User id missing after save")
        val token = JwtUtil.generateToken(
            subject = userId.toString(),
            claims = mapOf("name" to savedUser.name, "role" to savedUser.role.name)
        )

        return UserResponse(
            uuid = userId.toString(),
            name = savedUser.name,
            role = savedUser.role,
            token = token
        )
    }

    fun loginUser(request: UserRegistrationRequest): UserResponse {
        log.info("Logging in user, name={}", request.name)

        val user = userRepository.findByName(request.name)
            ?: throw IllegalStateException("User not found with name: ${'$'}{request.name}")

        if (!passwordEncoder.matches(request.password, user.password)) {
            throw IllegalArgumentException("Password not match for user: ${'$'}{request.name}")
        }

        val userId = user.uuid ?: throw IllegalStateException("User id missing")
        val token = JwtUtil.generateToken(
            subject = userId.toString(),
            claims = mapOf("name" to user.name, "role" to user.role.name)
        )

        log.info("User logged in successfully, uuid={}, name={}", user.uuid, user.name)

        return UserResponse(
            uuid = userId.toString(),
            name = user.name,
            role = user.role,
            token = token
        )
    }

    // 获取所有用户（仅 SYS_ADMIN）
    fun getAllUsers(): List<UserInfoResponse> {
        return userRepository.findAll()
            .map { u ->
                UserInfoResponse(
                    uuid = u.uuid?.toString() ?: "",
                    name = u.name,
                    role = u.role
                )
            }
    }

    // 通过 token 获取当前登录用户信息
    fun getCurrentUserInfo(token: String): UserInfoResponse {
        val parsed = JwtUtil.parseToken(token)
        val userId = UUID.fromString(parsed.subject)
        val user = userRepository.findById(userId).orElseThrow {
            IllegalStateException("User not found by token subject")
        }
        return UserInfoResponse(
            uuid = user.uuid?.toString() ?: "",
            name = user.name,
            role = user.role
        )
    }

    @Transactional
    fun updateUser(targetUuid: UUID, token: String, request: UserUpdateRequest): UserInfoResponse {
        val parsed = JwtUtil.parseToken(token)
        val requesterId = UUID.fromString(parsed.subject)
        val requester = userRepository.findById(requesterId).orElseThrow {
            IllegalStateException("Requester not found")
        }
        val target = userRepository.findById(targetUuid).orElseThrow {
            IllegalStateException("Target user not found")
        }
        // 权限校验：SYS_ADMIN 可以修改任何人；否则只能改自己
        val canEditAny = requester.role == UserRole.SYS_ADMIN
        val isSelf = requester.uuid == target.uuid
        require(canEditAny || isSelf) { "Permission denied" }

        // 应用更新字段
        request.name?.let { newName ->
            // 如果改名，确保唯一
            val existed = userRepository.findByName(newName)
            require(existed == null || existed.uuid == target.uuid) { "User name already exists" }
            target.name = newName
        }
        request.password?.let { newPassword ->
            val hashed: String = requireNotNull(passwordEncoder.encode(newPassword)) {
                "BCryptPasswordEncoder returned null hash"
            }
            target.password = hashed
        }
        request.role?.let { newRole ->
            // 非管理员不能改角色除非是改自己的且不是提升特权，这里简单限制：只有管理员能改角色
            require(canEditAny) { "Only admin can change role" }
            target.role = newRole
        }

        val saved = userRepository.save(target)
        return UserInfoResponse(
            uuid = saved.uuid?.toString() ?: "",
            name = saved.name,
            role = saved.role
        )
    }
}
