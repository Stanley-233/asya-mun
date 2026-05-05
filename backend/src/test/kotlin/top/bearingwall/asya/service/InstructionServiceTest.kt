package top.bearingwall.asya.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.Mockito.any
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import top.bearingwall.asya.dto.InstructionCreateRequest
import top.bearingwall.asya.dto.InstructionReviewRequest
import top.bearingwall.asya.model.Conference
import top.bearingwall.asya.model.Instruction
import top.bearingwall.asya.model.InstructionStatus
import top.bearingwall.asya.model.InstructionType
import top.bearingwall.asya.model.User
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.repository.InstructionRepository
import top.bearingwall.asya.repository.UserRepository
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class InstructionServiceTest {

    @Mock
    lateinit var instructionRepository: InstructionRepository

    @Mock
    lateinit var userRepository: UserRepository

    @Mock
    lateinit var timeService: TimeService

    @Mock
    lateinit var systemConfigService: SystemConfigService

    @InjectMocks
    lateinit var instructionService: InstructionService

    @Test
    fun `createInstruction stores submit times and default status`() {
        val conference = Conference(uuid = UUID.randomUUID(), name = "conf", description = "desc")
        val submitter = User(
            uuid = UUID.randomUUID(),
            name = "delegate1",
            password = "pwd",
            role = UserRole.DELEGATE,
            conference = conference
        )
        val submitGameTime = LocalDateTime.of(1939, 9, 1, 8, 0, 0)
        val request = InstructionCreateRequest(
            title = "Mobilize",
            instructionType = InstructionType.MILITARY,
            content = "Move forces"
        )

        `when`(userRepository.findById(submitter.uuid!!)).thenReturn(Optional.of(submitter))
        `when`(systemConfigService.isInstructionSubmissionPaused()).thenReturn(false)
        `when`(timeService.getCurrentGameTime(conference.uuid!!)).thenReturn(submitGameTime)
        `when`(instructionRepository.save(any(Instruction::class.java))).thenAnswer { invocation ->
            val instruction = invocation.getArgument<Instruction>(0)
            instruction.uuid = UUID.randomUUID()
            instruction
        }

        val response = instructionService.createInstruction(request, submitter.uuid!!)

        val captor = ArgumentCaptor.forClass(Instruction::class.java)
        verify(instructionRepository).save(captor.capture())
        val saved = captor.value

        assertEquals(InstructionStatus.SUBMITTED, saved.status)
        assertEquals(submitGameTime, saved.submitGameTime)
        assertEquals("Mobilize", response.title)
        assertEquals(InstructionStatus.SUBMITTED, response.status)
    }

    @Test
    fun `createInstruction fails when submission switch is paused`() {
        val conference = Conference(uuid = UUID.randomUUID(), name = "conf", description = "desc")
        val submitter = User(
            uuid = UUID.randomUUID(),
            name = "delegate1",
            password = "pwd",
            role = UserRole.DELEGATE,
            conference = conference
        )
        val request = InstructionCreateRequest(
            title = "Mobilize",
            instructionType = InstructionType.MILITARY,
            content = "Move forces"
        )

        `when`(userRepository.findById(submitter.uuid!!)).thenReturn(Optional.of(submitter))
        `when`(systemConfigService.isInstructionSubmissionPaused()).thenReturn(true)

        val ex = assertThrows(IllegalArgumentException::class.java) {
            instructionService.createInstruction(request, submitter.uuid!!)
        }

        assertTrue(ex.message!!.contains("paused"))
    }

    @Test
    fun `getInstruction denies delegate access to others instruction`() {
        val conference = Conference(uuid = UUID.randomUUID(), name = "conf", description = "desc")
        val owner = User(
            uuid = UUID.randomUUID(),
            name = "owner",
            password = "pwd",
            role = UserRole.DELEGATE,
            conference = conference
        )
        val otherDelegate = User(
            uuid = UUID.randomUUID(),
            name = "other",
            password = "pwd",
            role = UserRole.DELEGATE,
            conference = conference
        )
        val instruction = Instruction(
            uuid = UUID.randomUUID(),
            conference = conference,
            submitter = owner,
            title = "Order",
            instructionType = InstructionType.OTHER,
            content = "Text",
            submitRealTime = LocalDateTime.now(),
            submitGameTime = LocalDateTime.now()
        )

        `when`(userRepository.findById(otherDelegate.uuid!!)).thenReturn(Optional.of(otherDelegate))
        `when`(instructionRepository.findById(instruction.uuid!!)).thenReturn(Optional.of(instruction))

        val ex = assertThrows(SecurityException::class.java) {
            instructionService.getInstruction(instruction.uuid!!, otherDelegate.uuid!!)
        }

        assertTrue(ex.message!!.contains("Access denied"))
    }

    @Test
    fun `queryInstructionsForManagement delegates filters to repository`() {
        val conference = Conference(uuid = UUID.randomUUID(), name = "conf", description = "desc")
        val manager = User(
            uuid = UUID.randomUUID(),
            name = "dm1",
            password = "pwd",
            role = UserRole.DM,
            conference = conference
        )
        val submitter = User(
            uuid = UUID.randomUUID(),
            name = "delegate1",
            password = "pwd",
            role = UserRole.DELEGATE,
            conference = conference
        )
        val instruction = Instruction(
            uuid = UUID.randomUUID(),
            conference = conference,
            submitter = submitter,
            title = "Diplomacy",
            instructionType = InstructionType.DIPLOMACY,
            content = "Text",
            submitRealTime = LocalDateTime.now(),
            submitGameTime = LocalDateTime.now()
        )
        val pageable = PageRequest.of(0, 20)
        val submitterUuids = setOf(submitter.uuid!!)

        `when`(userRepository.findById(manager.uuid!!)).thenReturn(Optional.of(manager))
        `when`(instructionRepository.findForConferenceManagement(
            conference.uuid!!,
            InstructionStatus.SUBMITTED,
            InstructionType.DIPLOMACY,
            5L,
            submitterUuids,
            pageable
        )).thenReturn(PageImpl(listOf(instruction), pageable, 1))

        val page = instructionService.queryInstructionsForManagement(
            requesterUuid = manager.uuid!!,
            pageable = pageable,
            status = InstructionStatus.SUBMITTED,
            instructionType = InstructionType.DIPLOMACY,
            userGroupId = 5L,
            submitterUuids = listOf(submitter.uuid!!)
        )

        assertEquals(1, page.totalElements)
        assertEquals(instruction.uuid.toString(), page.content.first().uuid)
        verify(instructionRepository).findForConferenceManagement(
            conference.uuid!!,
            InstructionStatus.SUBMITTED,
            InstructionType.DIPLOMACY,
            5L,
            submitterUuids,
            pageable
        )
    }

    @Test
    fun `reviewInstruction updates status comment and reviewer info`() {
        val conference = Conference(uuid = UUID.randomUUID(), name = "conf", description = "desc")
        val reviewer = User(
            uuid = UUID.randomUUID(),
            name = "dh1",
            password = "pwd",
            role = UserRole.DH,
            conference = conference
        )
        val submitter = User(
            uuid = UUID.randomUUID(),
            name = "delegate1",
            password = "pwd",
            role = UserRole.DELEGATE,
            conference = conference
        )
        val reviewGameTime = LocalDateTime.of(1939, 9, 1, 10, 0, 0)
        val instruction = Instruction(
            uuid = UUID.randomUUID(),
            conference = conference,
            submitter = submitter,
            title = "Internal",
            instructionType = InstructionType.INTERNAL,
            content = "Text",
            submitRealTime = LocalDateTime.now(),
            submitGameTime = LocalDateTime.now()
        )

        `when`(userRepository.findById(reviewer.uuid!!)).thenReturn(Optional.of(reviewer))
        `when`(instructionRepository.findById(instruction.uuid!!)).thenReturn(Optional.of(instruction))
        `when`(timeService.getCurrentGameTime(conference.uuid!!)).thenReturn(reviewGameTime)
        `when`(instructionRepository.save(any(Instruction::class.java))).thenAnswer { it.getArgument(0) }

        val response = instructionService.reviewInstruction(
            instruction.uuid!!,
            reviewer.uuid!!,
            InstructionReviewRequest(
                status = InstructionStatus.FEEDBACKED,
                reviewComment = "Approved"
            )
        )

        assertEquals(InstructionStatus.FEEDBACKED, response.status)
        assertEquals("Approved", response.reviewComment)
        assertEquals(reviewer.uuid.toString(), response.reviewedById)
        assertEquals(reviewGameTime, response.reviewedGameTime)
    }

    @Test
    fun `reviewInstruction rejects submitted as target state`() {
        val conference = Conference(uuid = UUID.randomUUID(), name = "conf", description = "desc")
        val reviewer = User(
            uuid = UUID.randomUUID(),
            name = "admin",
            password = "pwd",
            role = UserRole.SYS_ADMIN,
            conference = conference
        )

        `when`(userRepository.findById(reviewer.uuid!!)).thenReturn(Optional.of(reviewer))

        assertThrows(IllegalArgumentException::class.java) {
            instructionService.reviewInstruction(
                UUID.randomUUID(),
                reviewer.uuid!!,
                InstructionReviewRequest(
                    status = InstructionStatus.SUBMITTED,
                    reviewComment = "No"
                )
            )
        }
    }

    @Test
    fun `getMyInstructions passes status filter to repository`() {
        val conference = Conference(uuid = UUID.randomUUID(), name = "conf", description = "desc")
        val submitter = User(
            uuid = UUID.randomUUID(),
            name = "delegate1",
            password = "pwd",
            role = UserRole.DELEGATE,
            conference = conference
        )
        val instruction = Instruction(
            uuid = UUID.randomUUID(),
            conference = conference,
            submitter = submitter,
            title = "Order",
            instructionType = InstructionType.MILITARY,
            content = "Text",
            submitRealTime = LocalDateTime.now(),
            submitGameTime = LocalDateTime.now(),
            status = InstructionStatus.FEEDBACKED
        )
        val pageable = PageRequest.of(0, 20)

        `when`(userRepository.findById(submitter.uuid!!)).thenReturn(Optional.of(submitter))
        `when`(instructionRepository.findAllBySubmitterUuid(submitter.uuid!!, InstructionStatus.FEEDBACKED, pageable))
            .thenReturn(PageImpl(listOf(instruction), pageable, 1))

        val page = instructionService.getMyInstructions(
            submitterUuid = submitter.uuid!!,
            pageable = pageable,
            status = InstructionStatus.FEEDBACKED
        )

        assertEquals(1, page.totalElements)
        assertEquals(InstructionStatus.FEEDBACKED, page.content.first().status)
        verify(instructionRepository).findAllBySubmitterUuid(submitter.uuid!!, InstructionStatus.FEEDBACKED, pageable)
    }
}
