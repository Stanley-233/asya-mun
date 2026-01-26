package top.bearingwall.asya.service

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.dto.ConferenceRequest
import top.bearingwall.asya.dto.ConferenceResponse
import top.bearingwall.asya.dto.UserInfoResponse
import top.bearingwall.asya.model.Conference
import top.bearingwall.asya.model.ConferenceStatus
import top.bearingwall.asya.model.User
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.repository.ConferenceRepository
import top.bearingwall.asya.repository.UserRepository
import top.bearingwall.asya.dto.ConferenceSessionRequest
import top.bearingwall.asya.dto.ConferenceSessionResponse
import top.bearingwall.asya.model.ConferenceSession
import top.bearingwall.asya.repository.ConferenceSessionRepository
import java.util.UUID

@Service
class ConferenceService(
    private val conferenceRepository: ConferenceRepository,
    private val userRepository: UserRepository,
    private val conferenceSessionRepository: ConferenceSessionRepository
) {
    @Transactional
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
                role = u.role
            )
        }
    }

    @Transactional(readOnly = true)
    fun listAll(requester: User): List<ConferenceResponse> {
        require(requester.role == UserRole.SYS_ADMIN) { "Only SYS_ADMIN can list all conferences" }
        return conferenceRepository.findAll().map { it.toResponse() }
    }

    @Transactional
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
            role = saved.role
        )
    }

    @Transactional
    fun createSession(requester: User, req: ConferenceSessionRequest): ConferenceSessionResponse {
        require(requester.role == UserRole.DH || requester.role == UserRole.DM || requester.role == UserRole.SYS_ADMIN) {
            "Only DH, DM, or SYS_ADMIN can create session"
        }
        val user = userRepository.findById(requester.uuid!!).orElseThrow { IllegalStateException("User not found") }
        val conf = user.conference ?: throw IllegalStateException("Requester not associated with any conference")
        val session = ConferenceSession(
            conference = conf,
            name = req.name,
            description = req.description,
            status = req.status
        )
        val saved = conferenceSessionRepository.save(session)
        return saved.toResponse()
    }

    @Transactional
    fun updateSession(requester: User, sessionUuid: UUID, req: ConferenceSessionRequest): ConferenceSessionResponse {
        require(requester.role == UserRole.DH || requester.role == UserRole.DM || requester.role == UserRole.SYS_ADMIN) {
            "Only DH, DM, or SYS_ADMIN can update session"
        }
        val user = userRepository.findById(requester.uuid!!).orElseThrow { IllegalStateException("User not found") }
        val conf = user.conference ?: throw IllegalStateException("Requester not associated with any conference")
        val session = conferenceSessionRepository.findById(sessionUuid).orElseThrow {
            IllegalStateException("Session not found")
        }
        if (session.conference.uuid != conf.uuid) {
             throw IllegalStateException("Session does not belong to the requester's conference")
        }
        session.name = req.name
        session.description = req.description
        session.status = req.status
        val saved = conferenceSessionRepository.save(session)
        return saved.toResponse()
    }

    @Transactional(readOnly = true)
    fun listSessions(requester: User): List<ConferenceSessionResponse> {
        val user = userRepository.findById(requester.uuid!!).orElseThrow { IllegalStateException("User not found") }
        val conf = user.conference ?: throw IllegalStateException("Requester not associated with any conference")
        return conf.sessions.map { it.toResponse() }
    }

    @Transactional(readOnly = true)
    fun getSession(requester: User, sessionUuid: UUID): ConferenceSessionResponse {
         val user = userRepository.findById(requester.uuid!!).orElseThrow { IllegalStateException("User not found") }
         val conf = user.conference ?: throw IllegalStateException("Requester not associated with any conference")
         val session = conferenceSessionRepository.findById(sessionUuid).orElseThrow {
            IllegalStateException("Session not found")
        }
        if (session.conference.uuid != conf.uuid) {
             throw IllegalStateException("Session does not belong to the requester's conference")
        }
        return session.toResponse()
    }

    @Transactional(readOnly = true)
    fun getCurrentSession(requester: User): ConferenceSessionResponse? {
        val user = userRepository.findById(requester.uuid!!).orElseThrow { IllegalStateException("User not found") }
        val conf = user.conference ?: throw IllegalStateException("Requester not associated with any conference")
        return conf.currentSession?.toResponse()
    }

    @Transactional
    fun setCurrentSession(requester: User, sessionUuid: UUID): ConferenceResponse {
        require(requester.role == UserRole.DH || requester.role == UserRole.DM || requester.role == UserRole.SYS_ADMIN) {
            "Only DH, DM, or SYS_ADMIN can set current session"
        }
        val user = userRepository.findById(requester.uuid!!).orElseThrow { IllegalStateException("User not found") }
        val conf = user.conference ?: throw IllegalStateException("Requester not associated with any conference")
        val session = conferenceSessionRepository.findById(sessionUuid).orElseThrow {
            IllegalStateException("Session not found")
        }
        if (session.conference.uuid != conf.uuid) {
             throw IllegalStateException("Session does not belong to the requester's conference")
        }
        conf.currentSession = session
        val saved = conferenceRepository.save(conf)
        return saved.toResponse()
    }

    private fun Conference.toResponse(): ConferenceResponse = ConferenceResponse(
        uuid = this.uuid?.toString() ?: "",
        name = this.name,
        description = this.description,
        status = this.status,
        currentSession = this.currentSession?.toResponse()
    )

    private fun ConferenceSession.toResponse(): ConferenceSessionResponse = ConferenceSessionResponse(
        uuid = this.uuid?.toString() ?: "",
        conferenceId = this.conference.uuid?.toString() ?: "",
        name = this.name,
        description = this.description,
        status = this.status
    )
}
