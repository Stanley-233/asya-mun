package top.bearingwall.asya.service

import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.domain.Specification
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
    private val conferenceService: ConferenceService,
    private val notificationService: NotificationService,
) {

    @Transactional
    @Auditable(type = AuditActionType.INSTRUCTION_CREATE, content = "提交指令")
    fun createInstruction(request: InstructionCreateRequest, submitterUuid: UUID): InstructionResponse {
        val submitter = getUser(submitterUuid)
        require(submitter.role == UserRole.DELEGATE) { "Only DELEGATE can submit instruction" }

        val conference = submitter.conference ?: throw IllegalStateException("Submitter not associated with any conference")
        require(!conferenceService.isInstructionSubmissionPaused(conference.uuid!!)) { "Instruction submission is paused" }

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
        status: InstructionStatus? = null,
        keyword: String? = null
    ): Page<InstructionResponse> {
        getUser(submitterUuid)
        var spec = bySubmitter(submitterUuid)
        status?.let { spec = spec.and(hasStatus(it)) }
        val normalizedKeyword = keyword?.trim()?.takeIf { it.isNotEmpty() }
        return if (normalizedKeyword == null) {
            instructionRepository.findAll(spec, pageable).map { it.toResponse() }
        } else {
            filterInstructionPageByKeyword(spec, pageable, normalizedKeyword)
        }
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
        submitterUuids: List<UUID>?,
        keyword: String?
    ): Page<InstructionResponse> {
        val requester = getUser(requesterUuid)
        requireManagementRole(requester)
        val conferenceUuid = requester.conference?.uuid ?: throw IllegalStateException("User not associated with any conference")
        val normalizedSubmitterUuids = submitterUuids?.toSet()?.takeIf { it.isNotEmpty() }

        var spec = byConference(conferenceUuid)
        status?.let { spec = spec.and(hasStatus(it)) }
        instructionType?.let { spec = spec.and(hasInstructionType(it)) }
        userGroupId?.let { spec = spec.and(inUserGroup(it)) }
        normalizedSubmitterUuids?.let { spec = spec.and(submitterIn(it)) }
        val normalizedKeyword = keyword?.trim()?.takeIf { it.isNotEmpty() }

        return if (normalizedKeyword == null) {
            instructionRepository.findAll(spec, pageable).map { it.toResponse() }
        } else {
            filterInstructionPageByKeyword(spec, pageable, normalizedKeyword)
        }
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

        val persisted = instructionRepository.save(instruction)
        if (persisted.status == InstructionStatus.FEEDBACKED) {
            notificationService.notifyInstructionFeedback(persisted)
        }
        return persisted.toResponse()
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

    private fun bySubmitter(submitterUuid: UUID): Specification<Instruction> {
        return Specification { root, _, cb ->
            cb.equal(root.get<User>("submitter").get<UUID>("uuid"), submitterUuid)
        }
    }

    private fun byConference(conferenceUuid: UUID): Specification<Instruction> {
        return Specification { root, _, cb ->
            cb.equal(root.get<top.bearingwall.asya.model.Conference>("conference").get<UUID>("uuid"), conferenceUuid)
        }
    }

    private fun hasStatus(status: InstructionStatus): Specification<Instruction> {
        return Specification { root, _, cb ->
            cb.equal(root.get<InstructionStatus>("status"), status)
        }
    }

    private fun hasInstructionType(instructionType: InstructionType): Specification<Instruction> {
        return Specification { root, _, cb ->
            cb.equal(root.get<InstructionType>("instructionType"), instructionType)
        }
    }

    private fun submitterIn(submitterUuids: Set<UUID>): Specification<Instruction> {
        return Specification { root, _, _ ->
            root.get<User>("submitter").get<UUID>("uuid").`in`(submitterUuids)
        }
    }

    private fun inUserGroup(userGroupId: Long): Specification<Instruction> {
        return Specification { root, query, cb ->
            query.distinct(true)
            val subquery = query.subquery(Long::class.java)
            val userGroupRoot = subquery.from(top.bearingwall.asya.model.UserGroup::class.java)
            val usersJoin = userGroupRoot.join<top.bearingwall.asya.model.UserGroup, User>("users")
            subquery.select(cb.literal(1L)).where(
                cb.equal(userGroupRoot.get<Long>("id"), userGroupId),
                cb.equal(usersJoin.get<UUID>("uuid"), root.get<User>("submitter").get<UUID>("uuid"))
            )
            cb.exists(subquery)
        }
    }

    private fun filterInstructionPageByKeyword(
        spec: Specification<Instruction>,
        pageable: Pageable,
        keyword: String
    ): Page<InstructionResponse> {
        val filtered = instructionRepository.findAll(spec, pageable.sort)
            .filter { it.matchesKeyword(keyword) }
        return toPage(filtered.map { it.toResponse() }, pageable)
    }

    private fun Instruction.matchesKeyword(keyword: String): Boolean {
        val normalizedKeyword = keyword.lowercase()
        return title.lowercase().contains(normalizedKeyword) || content.lowercase().contains(normalizedKeyword)
    }

    private fun <T : Any> toPage(items: List<T>, pageable: Pageable): Page<T> {
        val offset = pageable.offset.toInt().coerceAtMost(items.size)
        val endIndex = (offset + pageable.pageSize).coerceAtMost(items.size)
        return PageImpl(items.subList(offset, endIndex).toList(), pageable, items.size.toLong())
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
