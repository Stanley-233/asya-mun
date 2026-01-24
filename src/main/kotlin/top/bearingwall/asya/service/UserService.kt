package top.bearingwall.asya.service

import org.slf4j.LoggerFactory
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.dto.UserRegistrationRequest
import top.bearingwall.asya.dto.UserResponse
import top.bearingwall.asya.model.User
import top.bearingwall.asya.repository.UserRepository
import top.bearingwall.asya.util.JwtUtil

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
}
