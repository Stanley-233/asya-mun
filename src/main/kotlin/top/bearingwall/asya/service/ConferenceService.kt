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
import java.util.UUID

@Service
class ConferenceService(
    private val conferenceRepository: ConferenceRepository,
    private val userRepository: UserRepository
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
        val conf = requester.conference ?: throw IllegalStateException("Requester not associated with any conference")
        req.name.let { conf.name = it }
        req.description.let { conf.description = it }
        req.status?.let { conf.status = it }
        val saved = conferenceRepository.save(conf)
        return saved.toResponse()
    }

    fun getMyConference(requester: User): ConferenceResponse {
        val conf = requester.conference ?: throw IllegalStateException("Requester not associated with any conference")
        return conf.toResponse()
    }

    fun getConferenceUsers(requester: User): List<UserInfoResponse> {
        val conf = requester.conference ?: throw IllegalStateException("Requester not associated with any conference")
        return conf.users.map { u ->
            UserInfoResponse(
                uuid = u.uuid?.toString() ?: "",
                name = u.name,
                role = u.role
            )
        }
    }

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

    private fun Conference.toResponse(): ConferenceResponse = ConferenceResponse(
        uuid = this.uuid?.toString() ?: "",
        name = this.name,
        description = this.description,
        status = this.status
    )
}
