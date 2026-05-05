package top.bearingwall.asya.controller

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import top.bearingwall.asya.dto.InstructionSubmissionSwitchRequest
import top.bearingwall.asya.model.User
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.service.InstructionService
import top.bearingwall.asya.service.SystemConfigService
import top.bearingwall.asya.service.UserService
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class InstructionControllerTest {

    @Mock
    lateinit var instructionService: InstructionService

    @Mock
    lateinit var userService: UserService

    @Mock
    lateinit var systemConfigService: SystemConfigService

    @InjectMocks
    lateinit var instructionController: InstructionController

    @Test
    fun `setSubmissionSwitch allows DH to pause submission from query parameter`() {
        val dh = User(
            uuid = UUID.randomUUID(),
            name = "dh",
            password = "pwd",
            role = UserRole.DH
        )

        `when`(userService.getUserFromToken("token")).thenReturn(dh)
        `when`(systemConfigService.isInstructionSubmissionPaused()).thenReturn(true)

        val response = instructionController.setSubmissionSwitch(
            authorization = "Bearer token",
            paused = true,
            request = null
        )

        verify(systemConfigService).setInstructionSubmissionPaused(true)
        assertEquals(200, response.body?.code)
        assertTrue(response.body?.data == true)
    }

    @Test
    fun `setSubmissionSwitch allows sys admin to resume submission from request body`() {
        val admin = User(
            uuid = UUID.randomUUID(),
            name = "admin",
            password = "pwd",
            role = UserRole.SYS_ADMIN
        )

        `when`(userService.getUserFromToken("token")).thenReturn(admin)
        `when`(systemConfigService.isInstructionSubmissionPaused()).thenReturn(false)

        val response = instructionController.setSubmissionSwitch(
            authorization = "Bearer token",
            paused = null,
            request = InstructionSubmissionSwitchRequest(paused = false)
        )

        verify(systemConfigService).setInstructionSubmissionPaused(false)
        assertEquals(200, response.body?.code)
        assertEquals(false, response.body?.data)
    }
}
