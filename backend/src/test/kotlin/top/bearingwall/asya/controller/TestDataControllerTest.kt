package top.bearingwall.asya.controller

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import top.bearingwall.asya.dto.TestDataBootstrapResponse
import top.bearingwall.asya.model.User
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.service.TestDataService
import top.bearingwall.asya.service.UserService
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class TestDataControllerTest {

    @Mock
    lateinit var testDataService: TestDataService

    @Mock
    lateinit var userService: UserService

    @InjectMocks
    lateinit var testDataController: TestDataController

    @Test
    fun `bootstrap returns created payload`() {
        val admin = User(
            uuid = UUID.randomUUID(),
            name = "admin",
            password = "pwd",
            role = UserRole.SYS_ADMIN
        )
        val payload = TestDataBootstrapResponse(
            conferenceUuid = UUID.randomUUID().toString(),
            conferenceName = "测试会议",
            users = emptyList(),
            publicMessageCount = 15,
            secretMessageCount = 15,
            secretMessagesForA = 11,
            secretMessagesForB = 4,
            instructionCountFromA = 15,
            timeRatio = "1.00"
        )

        `when`(userService.getUserFromToken("token")).thenReturn(admin)
        `when`(testDataService.bootstrapScenario(admin)).thenReturn(payload)

        val response = testDataController.bootstrap("Bearer token")

        assertEquals(201, response.statusCode.value())
        assertEquals(200, response.body?.code)
        assertEquals(15, response.body?.data?.publicMessageCount)
    }
}
