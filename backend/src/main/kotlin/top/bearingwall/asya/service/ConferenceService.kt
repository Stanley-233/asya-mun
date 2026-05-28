package top.bearingwall.asya.service

import jakarta.persistence.criteria.JoinType
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.domain.Specification
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.audit.Auditable
import top.bearingwall.asya.dto.ConferenceRequest
import top.bearingwall.asya.dto.ConferenceResponse
import top.bearingwall.asya.dto.UserInfoResponse
import top.bearingwall.asya.model.AuditActionType
import top.bearingwall.asya.model.Conference
import top.bearingwall.asya.model.ConferenceStatus
import top.bearingwall.asya.model.User
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.repository.ConferenceRepository
import top.bearingwall.asya.repository.UserRepository
import java.util.UUID

@Service
class ConferenceService(
    private val conferenceRepository: ConferenceRepository,
    private val userRepository: UserRepository
) {
    @Transactional
    @Auditable(type = AuditActionType.CONFERENCE_CREATE, content = "创建会议")
    fun createConference(requester: User, req: ConferenceRequest): ConferenceResponse {
        require(requester.role == UserRole.SYS_ADMIN) { "Only SYS_ADMIN can create conference" }
        val conf = Conference(
            name = req.name,
            description = req.description,
            status = req.status ?: ConferenceStatus.PREPARING
        )
        val saved = conferenceRepository.save(conf)
        return saved.toResponse()
    }

    @Transactional
    @Auditable(type = AuditActionType.CONFERENCE_UPDATE, content = "更新会议")
    fun updateConference(requester: User, req: ConferenceRequest): ConferenceResponse {
        require(requester.role == UserRole.DH || requester.role == UserRole.DM || requester.role == UserRole.SYS_ADMIN) {
            "Only DH, DM, or SYS_ADMIN can update conference"
        }
        // TODO：检查请求者是否有权限修改该会议
        val user = userRepository.findById(requester.uuid!!).orElseThrow { IllegalStateException("User not found") }
        val conf = user.conference ?: throw IllegalStateException("Requester not associated with any conference")
        req.name.let { conf.name = it }
        req.description.let { conf.description = it }
        req.status?.let { conf.status = it }
        val saved = conferenceRepository.save(conf)
        return saved.toResponse()
    }

    @Transactional(readOnly = true)
    fun getMyConference(requester: User): ConferenceResponse {
        val user = userRepository.findById(requester.uuid!!).orElseThrow { IllegalStateException("User not found") }
        val conf = user.conference ?: throw IllegalStateException("Requester not associated with any conference")
        return conf.toResponse()
    }

    @Transactional(readOnly = true)
    fun getConferenceUsers(requester: User): List<UserInfoResponse> {
        val user = userRepository.findById(requester.uuid!!).orElseThrow { IllegalStateException("User not found") }
        val conf = user.conference ?: throw IllegalStateException("Requester not associated with any conference")
        return conf.users.map { u ->
            UserInfoResponse(
                uuid = u.uuid?.toString() ?: "",
                name = u.name,
                displayName = u.displayName,
                role = u.role,
                conferenceUuid = u.conference?.uuid?.toString(),
                conferenceName = u.conference?.name
            )
        }
    }

    @Transactional(readOnly = true)
    fun getConferenceDelegates(
        requester: User,
        pageable: Pageable,
        name: String?,
        displayName: String?
    ): Page<UserInfoResponse> {
        val user = userRepository.findById(requester.uuid!!).orElseThrow { IllegalStateException("User not found") }
        val conf = user.conference ?: throw IllegalStateException("Requester not associated with any conference")
        val conferenceUuid = conf.uuid!!

        val specification = Specification<User> { root, _, cb ->
            val predicates = mutableListOf<jakarta.persistence.criteria.Predicate>()

            val conference = root.join<User, Any>("conference", JoinType.LEFT)
            predicates += cb.equal(conference.get<UUID>("uuid"), conferenceUuid)
            predicates += cb.equal(root.get<UserRole>("role"), UserRole.DELEGATE)

            name?.trim()?.takeIf { it.isNotEmpty() }?.let { keyword ->
                predicates += cb.like(cb.lower(root.get("name")), "%${keyword.lowercase()}%")
            }

            displayName?.trim()?.takeIf { it.isNotEmpty() }?.let { keyword ->
                predicates += cb.like(cb.lower(root.get("displayName")), "%${keyword.lowercase()}%")
            }

            cb.and(*predicates.toTypedArray())
        }

        return userRepository.findAll(specification, pageable).map { u ->
            UserInfoResponse(
                uuid = u.uuid?.toString() ?: "",
                name = u.name,
                displayName = u.displayName,
                role = u.role,
                conferenceUuid = u.conference?.uuid?.toString(),
                conferenceName = u.conference?.name
            )
        }
    }

    @Transactional(readOnly = true)
    fun listAll(requester: User): List<ConferenceResponse> {
        require(requester.role == UserRole.SYS_ADMIN) { "Only SYS_ADMIN can list all conferences" }
        return conferenceRepository.findAll().map { it.toResponse() }
    }

    @Transactional(readOnly = true)
    fun listPage(requester: User, pageable: Pageable): Page<ConferenceResponse> {
        require(requester.role == UserRole.SYS_ADMIN) { "Only SYS_ADMIN can list conferences" }
        return conferenceRepository.findAll(pageable).map { it.toResponse() }
    }

    @Transactional
    @Auditable(type = AuditActionType.CONFERENCE_UPDATE, content = "管理员更新会议")
    fun updateConferenceByUuid(requester: User, conferenceUuid: UUID, req: ConferenceRequest): ConferenceResponse {
        require(requester.role == UserRole.SYS_ADMIN) { "Only SYS_ADMIN can update conference by uuid" }
        val conf = conferenceRepository.findById(conferenceUuid).orElseThrow {
            IllegalStateException("Conference not found: $conferenceUuid")
        }
        req.name.let { conf.name = it }
        req.description.let { conf.description = it }
        req.status?.let { conf.status = it }
        val saved = conferenceRepository.save(conf)
        return saved.toResponse()
    }

    @Transactional
    @Auditable(type = AuditActionType.CONFERENCE_ASSIGN_USER, content = "分配用户到会议")
    fun assignUserToConference(requester: User, conferenceUuid: UUID, userUuid: UUID): UserInfoResponse {
        require(requester.role == UserRole.SYS_ADMIN) { "Only SYS_ADMIN can assign users to conference" }
        val conference = conferenceRepository.findById(conferenceUuid).orElseThrow {
            IllegalStateException("Conference not found")
        }
        val user = userRepository.findById(userUuid).orElseThrow {
            IllegalStateException("User not found")
        }
        user.conference = conference
        val saved = userRepository.save(user)
        return UserInfoResponse(
            uuid = saved.uuid?.toString() ?: "",
            name = saved.name,
            displayName = saved.displayName,
            role = saved.role,
            conferenceUuid = saved.conference?.uuid?.toString(),
            conferenceName = saved.conference?.name
        )
    }

    @Transactional(readOnly = true)
    fun isInstructionSubmissionPaused(conferenceUuid: UUID): Boolean {
        val conference = conferenceRepository.findById(conferenceUuid)
            .orElseThrow { IllegalArgumentException("Conference not found") }
        return conference.instructionSubmissionPaused
    }

    @Transactional
    @Auditable(type = AuditActionType.INSTRUCTION_SUBMISSION_SWITCH, content = "设置会议指令提交暂停开关")
    fun setInstructionSubmissionPaused(conferenceUuid: UUID, paused: Boolean): ConferenceResponse {
        val conference = conferenceRepository.findById(conferenceUuid)
            .orElseThrow { IllegalArgumentException("Conference not found") }
        conference.instructionSubmissionPaused = paused
        val saved = conferenceRepository.save(conference)
        return saved.toResponse()
    }

    private fun Conference.toResponse(): ConferenceResponse = ConferenceResponse(
        uuid = this.uuid?.toString() ?: "",
        name = this.name,
        description = this.description,
        status = this.status,
        instructionSubmissionPaused = this.instructionSubmissionPaused
    )
}
