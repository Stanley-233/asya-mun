package top.bearingwall.asya.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import top.bearingwall.asya.model.Conference
import top.bearingwall.asya.model.ConferenceStatus
import top.bearingwall.asya.model.User
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.repository.ConferenceRepository
import top.bearingwall.asya.repository.UserRepository
import java.util.Optional
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class ConferenceServiceTest {

    @Mock
    lateinit var conferenceRepository: ConferenceRepository

    @Mock
    lateinit var userRepository: UserRepository

    @InjectMocks
    lateinit var conferenceService: ConferenceService

    @Test
    fun `assignUserToConference returns conference identity`() {
        val conferenceUuid = UUID.randomUUID()
        val conference = Conference(
            uuid = conferenceUuid,
            name = "Security Council",
            description = "Desc",
            status = ConferenceStatus.RUNNING
        )
        val requester = User(
            uuid = UUID.randomUUID(),
            name = "admin",
            password = "pwd",
            role = UserRole.SYS_ADMIN
        )
        val targetUser = User(
            uuid = UUID.randomUUID(),
            name = "delegate",
            password = "pwd",
            role = UserRole.DELEGATE
        )

        `when`(conferenceRepository.findById(conferenceUuid)).thenReturn(Optional.of(conference))
        `when`(userRepository.findById(targetUser.uuid!!)).thenReturn(Optional.of(targetUser))
        `when`(userRepository.save(targetUser)).thenAnswer { it.getArgument<User>(0) }

        val result = conferenceService.assignUserToConference(requester, conferenceUuid, targetUser.uuid!!)

        assertEquals(conferenceUuid.toString(), result.conferenceUuid)
        assertEquals("Security Council", result.conferenceName)
    }
}
