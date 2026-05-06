package top.bearingwall.asya.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import top.bearingwall.asya.model.Conference
import top.bearingwall.asya.model.User
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.repository.ConferenceRepository
import top.bearingwall.asya.repository.UserRepository
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class UserServiceTest {

    @Mock
    lateinit var userRepository: UserRepository

    @Mock
    lateinit var systemConfigService: SystemConfigService

    @Mock
    lateinit var conferenceRepository: ConferenceRepository

    @InjectMocks
    lateinit var userService: UserService

    @Test
    fun `getAllUsers returns conference name`() {
        // Arrange
        val conferenceUuid = UUID.randomUUID()
        val conf = Conference(uuid = conferenceUuid, name = "My Conference", description = "Desc")
        val user = User(
            uuid = UUID.randomUUID(),
            name = "user1",
            password = "pwd",
            role = UserRole.DELEGATE,
            conference = conf
        )

        `when`(userRepository.findAll()).thenReturn(listOf(user))

        // Act
        val result = userService.getAllUsers()

        // Assert
        assertEquals(1, result.size)
        assertEquals(conferenceUuid.toString(), result[0].conferenceUuid)
        assertEquals("My Conference", result[0].conferenceName)
    }
}
