package top.bearingwall.asya.service

import jakarta.persistence.criteria.JoinType
import io.jsonwebtoken.JwtException
import org.slf4j.LoggerFactory
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.domain.Specification
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.audit.Auditable
import top.bearingwall.asya.dto.UserRegistrationRequest
import top.bearingwall.asya.dto.UserResponse
import top.bearingwall.asya.dto.UserInfoResponse
import top.bearingwall.asya.dto.UserUpdateRequest
import top.bearingwall.asya.dto.BatchRegisterRequest
import top.bearingwall.asya.dto.BatchRegisterResponse
import top.bearingwall.asya.dto.TokenRefreshResponse
import top.bearingwall.asya.model.User
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.model.AuditActionType
import top.bearingwall.asya.repository.UserRepository
import top.bearingwall.asya.repository.ConferenceRepository
import top.bearingwall.asya.util.JwtUtil
import top.bearingwall.asya.util.TokenType
import java.util.UUID

@Service
class UserService(
    private val userRepository: UserRepository,
    private val systemConfigService: SystemConfigService,
    private val conferenceRepository: ConferenceRepository
) {

    private val log = LoggerFactory.getLogger(UserService::class.java)
    private val passwordEncoder = BCryptPasswordEncoder()

    @Transactional(readOnly = true)
    fun hasSysAdmin(): Boolean = userRepository.existsByRole(UserRole.SYS_ADMIN)

    @Transactional(readOnly = true)
    fun isRegistrationAvailable(): Boolean = !hasSysAdmin() || systemConfigService.isRegistrationAllowed()

    @Transactional
    @Auditable(type = AuditActionType.USER_REGISTER, content = "用户注册")
    fun registerUser(request: UserRegistrationRequest): AuthenticatedUserResponse {
        log.info("Registering user, name={}, role={}", request.name, request.role)

        if (!isRegistrationAvailable()) {
            throw IllegalStateException("系统当前禁止新用户注册")
        }

        val existing = userRepository.findByName(request.name)
        require(existing == null) { "User already exists: ${request.name}" }

        if (request.role == UserRole.SYS_ADMIN && hasSysAdmin()) {
            throw IllegalArgumentException("已经存在系统管理员，禁止重复注册")
        }

        val hashedPassword: String = requireNotNull(passwordEncoder.encode(request.password)) {
            "BCryptPasswordEncoder returned null hash"
        }

        val user = User(
            name = request.name,
            displayName = request.displayName,
            password = hashedPassword,
            role = request.role
        )

        val savedUser = userRepository.save(user)

        log.info("User registered successfully, uuid={}, name={}", savedUser.uuid, savedUser.name)

        return issueAuthenticatedUserResponse(savedUser)
    }

    @Auditable(type = AuditActionType.USER_LOGIN, content = "用户登录")
    fun loginUser(request: UserRegistrationRequest): AuthenticatedUserResponse {
        log.info("Logging in user, name={}", request.name)

        val user = userRepository.findByName(request.name)
            ?: throw IllegalStateException("系统中还没有该用户，请先完成注册")

        if (!passwordEncoder.matches(request.password, user.password)) {
            throw IllegalArgumentException("用户密码不正确")
        }

        log.info("User logged in successfully, uuid={}, name={}", user.uuid, user.name)

        return issueAuthenticatedUserResponse(user)
    }

    @Transactional(readOnly = true)
    fun refreshAccessToken(refreshToken: String): TokenRefreshResult {
        val user = getUserFromToken(refreshToken, TokenType.REFRESH)
        val tokens = issueTokens(user)
        return TokenRefreshResult(
            response = TokenRefreshResponse(token = tokens.accessToken),
            refreshToken = tokens.refreshToken
        )
    }

    // 获取所有用户（仅 SYS_ADMIN）
    @Transactional(readOnly = true)
    fun getAllUsers(): List<UserInfoResponse> {
        return userRepository.findAll()
            .map(::toUserInfoResponse)
    }

    @Transactional(readOnly = true)
    fun getUsers(
        pageable: Pageable,
        name: String?,
        displayName: String?,
        conferenceUuid: UUID?,
        role: UserRole?
    ): Page<UserInfoResponse> {
        val specification = Specification<User> { root, _, cb ->
            val predicates = mutableListOf<jakarta.persistence.criteria.Predicate>()

            name?.trim()?.takeIf { it.isNotEmpty() }?.let { keyword ->
                predicates += cb.like(cb.lower(root.get("name")), "%${keyword.lowercase()}%")
            }

            displayName?.trim()?.takeIf { it.isNotEmpty() }?.let { keyword ->
                predicates += cb.like(cb.lower(root.get("displayName")), "%${keyword.lowercase()}%")
            }

            conferenceUuid?.let {
                val conference = root.join<User, Any>("conference", JoinType.LEFT)
                predicates += cb.equal(conference.get<UUID>("uuid"), it)
            }

            role?.let {
                predicates += cb.equal(root.get<UserRole>("role"), it)
            }

            cb.and(*predicates.toTypedArray())
        }

        return userRepository.findAll(specification, pageable)
            .map(::toUserInfoResponse)
    }

    @Transactional
    @Auditable(type = AuditActionType.USER_DELETE, content = "删除用户")
    fun deleteUser(uuid: UUID) {
        if (!userRepository.existsById(uuid)) {
            throw IllegalArgumentException("User not found: $uuid")
        }
        // Potential: Handle associations (messages sent, messages received) if not handled by DB constraints/Cascades
        // For now, relying on JPA/DB configuration.
        userRepository.deleteById(uuid)
    }

    // 通过 token 获取当前登录用户信息
    @Transactional(readOnly = true)
    fun getCurrentUserInfo(token: String): UserInfoResponse {
        val user = getUserFromToken(token)
        return toUserInfoResponse(user)
    }

    @Transactional
    @Auditable(type = AuditActionType.USER_UPDATE, content = "更新用户信息")
    fun updateUser(targetUuid: UUID, token: String, request: UserUpdateRequest): UserInfoResponse {
        val requester = getUserFromToken(token)
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
        request.displayName?.let { newDisplayName ->
            target.displayName = newDisplayName
        }
        request.password?.let { newPassword ->
            val hashed: String = requireNotNull(passwordEncoder.encode(newPassword)) {
                "BCryptPasswordEncoder returned null hash"
            }
            target.password = hashed
            target.authVersion += 1
        }
        request.role?.let { newRole ->
            // 非管理员不能改角色除非是改自己的且不是提升特权，这里简单限制：只有管理员能改角色
            require(canEditAny) { "Only admin can change role" }
            target.role = newRole
        }

        val saved = userRepository.save(target)
        return toUserInfoResponse(saved)
    }

    @Transactional(readOnly = true)
    fun getUserFromToken(token: String, expectedType: TokenType = TokenType.ACCESS): User {
        val parsed = JwtUtil.parseToken(token)
        JwtUtil.requireTokenType(parsed, expectedType)
        val tokenVersion = JwtUtil.getAuthVersion(parsed)
        val userId = UUID.fromString(parsed.subject)
        val user = userRepository.findById(userId).orElseThrow {
            IllegalStateException("User not found by token subject")
        }
        if (user.authVersion != tokenVersion) {
            throw JwtException("Token已失效，请重新登录")
        }
        return user
    }

    @Transactional
    @Auditable(type = AuditActionType.USER_PASSWORD_RESET, content = "重置用户密码")
    fun resetPassword(uuid: UUID, newPassword: String) {
        val user = userRepository.findById(uuid).orElseThrow {
            IllegalArgumentException("User not found: $uuid")
        }
        val hashed: String = requireNotNull(passwordEncoder.encode(newPassword)) {
            "BCryptPasswordEncoder returned null hash"
        }
        user.password = hashed
        user.authVersion += 1
        userRepository.save(user)
    }

    @Transactional
    @Auditable(type = AuditActionType.USER_BATCH_REGISTER, content = "批量注册用户")
    fun batchRegister(requesterUuid: UUID, request: BatchRegisterRequest): BatchRegisterResponse {
        val requester = userRepository.findById(requesterUuid).orElseThrow { IllegalArgumentException("Requester not found") }
        if (requester.role != UserRole.SYS_ADMIN) {
            throw SecurityException("Only SYS_ADMIN can perform batch registration")
        }

        val conferenceUuid = UUID.fromString(request.conferenceId)
        val conference = conferenceRepository.findById(conferenceUuid).orElseThrow {
            IllegalArgumentException("Conference not found: ${request.conferenceId}")
        }

        val createdUsers = mutableListOf<UserInfoResponse>()

        for (item in request.users) {
            if (userRepository.findByName(item.name) != null) {
                throw IllegalArgumentException("User already exists: ${item.name}")
            }

            val hashedPassword: String = requireNotNull(passwordEncoder.encode(item.password)) {
                "BCryptPasswordEncoder returned null hash"
            }
            val user = User(
                name = item.name,
                displayName = item.displayName,
                password = hashedPassword,
                role = UserRole.DELEGATE,
                conference = conference
            )
            val saved = userRepository.save(user)
            createdUsers.add(toUserInfoResponse(saved))
        }

        return BatchRegisterResponse(createdUsers.size, createdUsers)
    }

    private fun toUserInfoResponse(user: User): UserInfoResponse {
        return UserInfoResponse(
            uuid = user.uuid?.toString() ?: "",
            name = user.name,
            displayName = user.displayName,
            role = user.role,
            conferenceUuid = user.conference?.uuid?.toString(),
            conferenceName = user.conference?.name
        )
    }

    private fun issueAuthenticatedUserResponse(user: User): AuthenticatedUserResponse {
        val tokens = issueTokens(user)
        return AuthenticatedUserResponse(
            response = UserResponse(
                uuid = user.uuid?.toString() ?: throw IllegalStateException("User id missing"),
                name = user.name,
                displayName = user.displayName,
                role = user.role,
                token = tokens.accessToken
            ),
            refreshToken = tokens.refreshToken
        )
    }

    private fun issueTokens(user: User): AuthTokenPair {
        val userId = user.uuid?.toString() ?: throw IllegalStateException("User id missing")
        val accessToken = JwtUtil.generateAccessToken(
            subject = userId,
            claims = mapOf("name" to user.name, "role" to user.role.name),
            authVersion = user.authVersion
        )
        val refreshToken = JwtUtil.generateRefreshToken(
            subject = userId,
            authVersion = user.authVersion
        )
        return AuthTokenPair(
            accessToken = accessToken,
            refreshToken = refreshToken
        )
    }
}

data class AuthenticatedUserResponse(
    val response: UserResponse,
    val refreshToken: String
)

data class TokenRefreshResult(
    val response: TokenRefreshResponse,
    val refreshToken: String
)

private data class AuthTokenPair(
    val accessToken: String,
    val refreshToken: String
)
