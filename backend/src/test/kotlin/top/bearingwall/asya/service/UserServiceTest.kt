package top.bearingwall.asya.service

import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Captor
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.Mockito.eq
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import org.springframework.data.jpa.domain.Specification
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

    @Captor
    lateinit var specificationCaptor: ArgumentCaptor<Specification<User>>

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

    @Test
    fun `getUsers returns paged user info`() {
        val conferenceUuid = UUID.randomUUID()
        val conf = Conference(uuid = conferenceUuid, name = "Paged Conference", description = "Desc")
        val user = User(
            uuid = UUID.randomUUID(),
            name = "paged-user",
            displayName = "Paged User",
            password = "pwd",
            role = UserRole.DM,
            conference = conf
        )
        val pageable = PageRequest.of(0, 10)

        `when`(
            userRepository.findAll(
                specificationCaptor.capture(),
                eq(pageable)
            )
        ).thenReturn(PageImpl(listOf(user), pageable, 1))

        val result = userService.getUsers(
            pageable = pageable,
            name = "paged",
            displayName = "User",
            conferenceUuid = conferenceUuid,
            role = UserRole.DM
        )

        assertEquals(1, result.totalElements)
        assertEquals("paged-user", result.content[0].name)
        assertEquals("Paged Conference", result.content[0].conferenceName)
        assertTrue(specificationCaptor.value != null)
    }
}
