package top.bearingwall.asya.service

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.audit.Auditable
import top.bearingwall.asya.dto.InstructionCreateRequest
import top.bearingwall.asya.dto.InstructionResponse
import top.bearingwall.asya.dto.InstructionReviewRequest
import top.bearingwall.asya.model.AuditActionType
import top.bearingwall.asya.model.Instruction
import top.bearingwall.asya.model.InstructionStatus
import top.bearingwall.asya.model.InstructionType
import top.bearingwall.asya.model.User
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.repository.InstructionRepository
import top.bearingwall.asya.repository.UserRepository
import java.time.LocalDateTime
import java.util.UUID

@Service
class InstructionService(
    private val instructionRepository: InstructionRepository,
    private val userRepository: UserRepository,
    private val timeService: TimeService,
    private val systemConfigService: SystemConfigService
) {

    @Transactional
    @Auditable(type = AuditActionType.INSTRUCTION_CREATE, content = "提交指令")
    fun createInstruction(request: InstructionCreateRequest, submitterUuid: UUID): InstructionResponse {
        val submitter = getUser(submitterUuid)
        require(submitter.role == UserRole.DELEGATE) { "Only DELEGATE can submit instruction" }
        require(!systemConfigService.isInstructionSubmissionPaused()) { "Instruction submission is paused" }

        val conference = submitter.conference ?: throw IllegalStateException("Submitter not associated with any conference")
        val submitRealTime = LocalDateTime.now()
        val submitGameTime = timeService.getCurrentGameTime(conference.uuid!!) ?: submitRealTime

        val saved = instructionRepository.save(
            Instruction(
                conference = conference,
                submitter = submitter,
                title = request.title,
                instructionType = request.instructionType,
                content = request.content,
                submitRealTime = submitRealTime,
                submitGameTime = submitGameTime
            )
        )

        return saved.toResponse()
    }

    @Transactional(readOnly = true)
    fun getMyInstructions(
        submitterUuid: UUID,
        pageable: Pageable,
        status: InstructionStatus? = null
    ): Page<InstructionResponse> {
        getUser(submitterUuid)
        return instructionRepository.findAllBySubmitterUuid(submitterUuid, status, pageable).map { it.toResponse() }
    }

    @Transactional(readOnly = true)
    fun getInstruction(uuid: UUID, requesterUuid: UUID): InstructionResponse {
        val requester = getUser(requesterUuid)
        val instruction = getInstructionEntity(uuid)
        ensureSameConference(requester, instruction)

        val isPrivileged = requester.role in setOf(UserRole.DH, UserRole.DM, UserRole.SYS_ADMIN)
        val isOwner = instruction.submitter.uuid == requester.uuid
        if (!isPrivileged && !isOwner) {
            throw SecurityException("Access denied")
        }

        return instruction.toResponse()
    }

    @Transactional(readOnly = true)
    fun queryInstructionsForManagement(
        requesterUuid: UUID,
        pageable: Pageable,
        status: InstructionStatus?,
        instructionType: InstructionType?,
        userGroupId: Long?,
        submitterUuids: List<UUID>?
    ): Page<InstructionResponse> {
        val requester = getUser(requesterUuid)
        requireManagementRole(requester)
        val conferenceUuid = requester.conference?.uuid ?: throw IllegalStateException("User not associated with any conference")
        val normalizedSubmitterUuids = submitterUuids?.toSet()?.takeIf { it.isNotEmpty() }

        return instructionRepository.findForConferenceManagement(
            conferenceUuid = conferenceUuid,
            status = status,
            instructionType = instructionType,
            userGroupId = userGroupId,
            submitterUuids = normalizedSubmitterUuids,
            pageable = pageable
        ).map { it.toResponse() }
    }

    @Transactional
    @Auditable(type = AuditActionType.INSTRUCTION_REVIEW, content = "批改指令")
    fun reviewInstruction(uuid: UUID, reviewerUuid: UUID, request: InstructionReviewRequest): InstructionResponse {
        val reviewer = getUser(reviewerUuid)
        requireManagementRole(reviewer)
        require(request.status != InstructionStatus.SUBMITTED) { "Review target status cannot be SUBMITTED" }

        val instruction = getInstructionEntity(uuid)
        ensureSameConference(reviewer, instruction)

        val reviewRealTime = LocalDateTime.now()
        val reviewGameTime = timeService.getCurrentGameTime(instruction.conference.uuid!!) ?: reviewRealTime

        instruction.status = request.status
        instruction.reviewComment = request.reviewComment
        instruction.reviewedBy = reviewer
        instruction.reviewedRealTime = reviewRealTime
        instruction.reviewedGameTime = reviewGameTime

        return instructionRepository.save(instruction).toResponse()
    }

    private fun getUser(uuid: UUID): User {
        return userRepository.findById(uuid).orElseThrow {
            IllegalArgumentException("User not found: $uuid")
        }
    }

    private fun getInstructionEntity(uuid: UUID): Instruction {
        return instructionRepository.findById(uuid).orElseThrow {
            IllegalArgumentException("Instruction not found: $uuid")
        }
    }

    private fun requireManagementRole(user: User) {
        if (user.role !in setOf(UserRole.DH, UserRole.DM, UserRole.SYS_ADMIN)) {
            throw SecurityException("Permission denied")
        }
    }

    private fun ensureSameConference(user: User, instruction: Instruction) {
        val userConferenceUuid = user.conference?.uuid
        val instructionConferenceUuid = instruction.conference.uuid
        if (userConferenceUuid == null || userConferenceUuid != instructionConferenceUuid) {
            throw SecurityException("Access denied")
        }
    }

    private fun Instruction.toResponse() = InstructionResponse(
        uuid = this.uuid.toString(),
        conferenceId = this.conference.uuid.toString(),
        submitterId = this.submitter.uuid.toString(),
        submitterName = this.submitter.name,
        title = this.title,
        instructionType = this.instructionType,
        content = this.content,
        status = this.status,
        reviewComment = this.reviewComment,
        submitRealTime = this.submitRealTime,
        submitGameTime = this.submitGameTime,
        reviewedById = this.reviewedBy?.uuid?.toString(),
        reviewedByName = this.reviewedBy?.name,
        reviewedRealTime = this.reviewedRealTime,
        reviewedGameTime = this.reviewedGameTime
    )
}
