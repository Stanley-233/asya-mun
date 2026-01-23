package top.bearingwall.asya.service

import org.slf4j.LoggerFactory
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.dto.UserRegistrationRequest
import top.bearingwall.asya.dto.UserResponse
import top.bearingwall.asya.model.User
import top.bearingwall.asya.repository.UserRepository

@Service
class UserService(
    private val userRepository: UserRepository
) {

    private val log = LoggerFactory.getLogger(UserService::class.java)
    private val passwordEncoder = BCryptPasswordEncoder()

    @Transactional
    fun registerUser(request: UserRegistrationRequest): UserResponse {
        log.info("Registering user, name={}, role={}", request.name, request.role)

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

        return UserResponse(
            uuid = savedUser.uuid.toString(),
            name = savedUser.name,
            role = savedUser.role
        )
    }
}
