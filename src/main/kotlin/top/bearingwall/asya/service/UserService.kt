package top.bearingwall.asya.service

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.dto.UserRegistrationRequest
import top.bearingwall.asya.dto.UserResponse
import top.bearingwall.asya.model.User
import top.bearingwall.asya.repository.UserRepository
import java.security.MessageDigest
import java.util.Base64

@Service
class UserService(
    private val userRepository: UserRepository
) {

    @Transactional
    fun registerUser(request: UserRegistrationRequest): UserResponse {
        // Simple hashing for demonstration. In production, use BCrypt or similar.
        val hashedPassword = hashPassword(request.password)

        val user = User(
            name = request.name,
            password = hashedPassword,
            role = request.role
        )

        val savedUser = userRepository.save(user)

        return UserResponse(
            uuid = savedUser.uuid.toString(),
            name = savedUser.name,
            role = savedUser.role
        )
    }

    private fun hashPassword(password: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(password.toByteArray(Charsets.UTF_8))
        return Base64.getEncoder().encodeToString(hash)
    }
}

