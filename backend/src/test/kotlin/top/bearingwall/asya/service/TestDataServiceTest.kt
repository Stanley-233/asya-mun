package top.bearingwall.asya.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.Mockito.any
import org.mockito.Mockito.anyList
import org.mockito.Mockito.doAnswer
import org.mockito.junit.jupiter.MockitoExtension
import top.bearingwall.asya.model.Conference
import top.bearingwall.asya.model.TimeAnchor
import top.bearingwall.asya.model.User
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.repository.ConferenceRepository
import top.bearingwall.asya.repository.InstructionRepository
import top.bearingwall.asya.repository.MessageRepository
import top.bearingwall.asya.repository.TimeAnchorRepository
import top.bearingwall.asya.repository.UserRepository
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class TestDataServiceTest {

    @Mock
    lateinit var conferenceRepository: ConferenceRepository

    @Mock
    lateinit var userRepository: UserRepository

    @Mock
    lateinit var messageRepository: MessageRepository

    @Mock
    lateinit var instructionRepository: InstructionRepository

    @Mock
    lateinit var timeAnchorRepository: TimeAnchorRepository

    @InjectMocks
    lateinit var testDataService: TestDataService

    @Test
    fun `bootstrapScenario creates requested fixture counts`() {
        doAnswer { invocation ->
            val conference = invocation.getArgument<Conference>(0)
            conference.uuid = UUID.randomUUID()
            conference
        }.`when`(conferenceRepository).save(any(Conference::class.java))

        doAnswer { invocation ->
            val user = invocation.getArgument<User>(0)
            user.uuid = UUID.randomUUID()
            user
        }.`when`(userRepository).save(any(User::class.java))

        doAnswer { invocation ->
            invocation.getArgument<List<Any>>(0)
        }.`when`(messageRepository).saveAll(anyList())

        doAnswer { invocation ->
            invocation.getArgument<List<Any>>(0)
        }.`when`(instructionRepository).saveAll(anyList())

        doAnswer { invocation ->
            val anchor = invocation.getArgument<TimeAnchor>(0)
            anchor.id = 1L
            anchor
        }.`when`(timeAnchorRepository).save(any(TimeAnchor::class.java))

        val requester = User(
            uuid = UUID.randomUUID(),
            name = "admin",
            password = "pwd",
            role = UserRole.SYS_ADMIN
        )

        val response = testDataService.bootstrapScenario(requester)

        assertEquals(5, response.users.size)
        assertEquals(15, response.publicMessageCount)
        assertEquals(15, response.secretMessageCount)
        assertEquals(11, response.secretMessagesForA)
        assertEquals(4, response.secretMessagesForB)
        assertEquals(15, response.instructionCountFromA)
        assertTrue(response.users.any { it.displayName == "代表A" })
    }

    @Test
    fun `bootstrapScenario rejects non admin requester`() {
        val requester = User(
            uuid = UUID.randomUUID(),
            name = "delegate",
            password = "pwd",
            role = UserRole.DELEGATE
        )

        assertThrows<IllegalArgumentException> {
            testDataService.bootstrapScenario(requester)
        }
    }
}
