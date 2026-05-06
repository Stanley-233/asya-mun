package top.bearingwall.asya.service

import jakarta.persistence.criteria.JoinType
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
import top.bearingwall.asya.model.User
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.model.AuditActionType
import top.bearingwall.asya.repository.UserRepository
import top.bearingwall.asya.repository.ConferenceRepository
import top.bearingwall.asya.util.JwtUtil
import java.util.UUID

@Service
class UserService(
    private val userRepository: UserRepository,
    private val systemConfigService: SystemConfigService,
    private val conferenceRepository: ConferenceRepository
) {

    private val log = LoggerFactory.getLogger(UserService::class.java)
    private val passwordEncoder = BCryptPasswordEncoder()

    @Transactional
    @Auditable(type = AuditActionType.USER_REGISTER, content = "用户注册")
    fun registerUser(request: UserRegistrationRequest): UserResponse {
        log.info("Registering user, name={}, role={}", request.name, request.role)

        // 检查全局注册开关 (如果是为了注册管理员，且系统还没有管理员，通常应该允许，但这里简单处理，如果想禁止一切注册就禁止)
        // 实际上：如果系统还没有任何管理员，应该允许注册第一个管理员，否则死锁。
        // 代码后面有 "if (request.role == UserRole.SYS_ADMIN && userRepository.existsByRole(UserRole.SYS_ADMIN))"
        // 这意味着如果不允许重名，第一个管理员可以注册。
        // 但如果开关是 "关闭" 的，是否还允许第一个管理员注册？
        // 逻辑上：如果开关关了，没人能注册。除非是系统初始化。
        // 但如果系统已经初始化了，开关关了，就不应该允许任何人注册。
        // 为了安全，如果开关关闭，直接禁止所有注册。
        // *特例*：如果没有管理员账号，系统可能不可用，所以如果 `existsByRole(SYS_ADMIN)` 为 false，则忽略开关强制允许（初始化阶段）。

        if (!systemConfigService.isRegistrationAllowed() && userRepository.existsByRole(UserRole.SYS_ADMIN)) {
            throw IllegalStateException("系统当前禁止新用户注册")
        }

        val existing = userRepository.findByName(request.name)
        require(existing == null) { $$"User already exists: ${request.name}" }

        if (request.role == UserRole.SYS_ADMIN && userRepository.existsByRole(UserRole.SYS_ADMIN)) {
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

        val userId = savedUser.uuid ?: throw IllegalStateException("User id missing after save")
        val token = JwtUtil.generateToken(
            subject = userId.toString(),
            claims = mapOf("name" to savedUser.name, "role" to savedUser.role.name)
        )

        return UserResponse(
            uuid = userId.toString(),
            name = savedUser.name,
            displayName = savedUser.displayName,
            role = savedUser.role,
            token = token
        )
    }

    @Auditable(type = AuditActionType.USER_LOGIN, content = "用户登录")
    fun loginUser(request: UserRegistrationRequest): UserResponse {
        log.info("Logging in user, name={}", request.name)

        val user = userRepository.findByName(request.name)
            ?: throw IllegalStateException($$"User not found with name: ${request.name}")

        if (!passwordEncoder.matches(request.password, user.password)) {
            throw IllegalArgumentException($$"Password not match for user: ${request.name}")
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
            displayName = user.displayName,
            role = user.role,
            token = token
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
        val parsed = JwtUtil.parseToken(token)
        val userId = UUID.fromString(parsed.subject)
        val user = userRepository.findById(userId).orElseThrow {
            IllegalStateException("User not found by token subject")
        }
        return toUserInfoResponse(user)
    }

    @Transactional
    @Auditable(type = AuditActionType.USER_UPDATE, content = "更新用户信息")
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
        request.displayName?.let { newDisplayName ->
            target.displayName = newDisplayName
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
        return toUserInfoResponse(saved)
    }

    @Transactional(readOnly = true)
    fun getUserFromToken(token: String): User {
        val parsed = JwtUtil.parseToken(token)
        val userId = UUID.fromString(parsed.subject)
        return userRepository.findById(userId).orElseThrow {
            IllegalStateException("User not found by token subject")
        }
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
}
