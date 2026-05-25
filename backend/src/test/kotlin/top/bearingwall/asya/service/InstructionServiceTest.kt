package top.bearingwall.asya.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import top.bearingwall.asya.dto.InstructionCreateRequest
import top.bearingwall.asya.model.Instruction
import top.bearingwall.asya.model.InstructionStatus
import top.bearingwall.asya.model.InstructionType
import top.bearingwall.asya.model.UserGroup
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.repository.InstructionRepository
import top.bearingwall.asya.repository.UserGroupRepository
import top.bearingwall.asya.support.PostgresIntegrationTest
import java.time.LocalDateTime
import java.util.UUID

class InstructionServiceTest : PostgresIntegrationTest() {

    @Autowired
    lateinit var userGroupRepository: UserGroupRepository

    @Autowired
    lateinit var instructionRepository: InstructionRepository

    @Test
    fun `management query filters instructions by status type group and submitter against real postgres`() {
        val conference = saveConference(name = "Asia MUN")

        val manager = saveUser("dm", UserRole.DM, conference)
        val groupedDelegate = saveUser("delegate-a", UserRole.DELEGATE, conference)
        val otherDelegate = saveUser("delegate-b", UserRole.DELEGATE, conference)

        val group = userGroupRepository.save(
            UserGroup(
                groupName = "Blue Team",
                users = mutableSetOf(groupedDelegate)
            )
        )

        val matched = instructionRepository.save(
            Instruction(
                conference = conference,
                submitter = groupedDelegate,
                title = "Matched",
                instructionType = InstructionType.DIPLOMACY,
                content = "Keep KEYWORD this one",
                submitRealTime = LocalDateTime.of(2026, 5, 10, 10, 0),
                submitGameTime = LocalDateTime.of(1939, 9, 1, 8, 0),
                status = InstructionStatus.SUBMITTED
            )
        )
        instructionRepository.save(
            Instruction(
                conference = conference,
                submitter = groupedDelegate,
                title = "Wrong Status",
                instructionType = InstructionType.DIPLOMACY,
                content = "filtered by status",
                submitRealTime = LocalDateTime.of(2026, 5, 10, 9, 0),
                submitGameTime = LocalDateTime.of(1939, 9, 1, 7, 0),
                status = InstructionStatus.FEEDBACKED
            )
        )
        instructionRepository.save(
            Instruction(
                conference = conference,
                submitter = otherDelegate,
                title = "Wrong Group",
                instructionType = InstructionType.DIPLOMACY,
                content = "filtered by group",
                submitRealTime = LocalDateTime.of(2026, 5, 10, 8, 0),
                submitGameTime = LocalDateTime.of(1939, 9, 1, 6, 0),
                status = InstructionStatus.SUBMITTED
            )
        )

        val response = get(
            "/api/instructions/manage?status=SUBMITTED&instructionType=DIPLOMACY&userGroupId=${group.id}&submitterUuids=${groupedDelegate.uuid}&keyword=keyword&current=1",
            bearerHeadersFor(manager)
        )

        assertEquals(HttpStatus.OK.value(), response.statusCode())
        val body = readJson(response.body())
        assertEquals(200, body["code"].asInt())
        val records = body["data"]["content"]
        assertEquals(1, records.size())
        assertEquals(matched.uuid.toString(), records[0]["uuid"].asText())
        assertEquals("Matched", records[0]["title"].asText())
    }

    @Test
    fun `management query ignores blank keyword against real postgres`() {
        val conference = saveConference(name = "Asia MUN")
        val manager = saveUser("dm", UserRole.DM, conference)
        val delegate = saveUser("delegate-blank", UserRole.DELEGATE, conference)

        instructionRepository.save(
            Instruction(
                conference = conference,
                submitter = delegate,
                title = "Blank Keyword",
                instructionType = InstructionType.INTERNAL,
                content = "still returned",
                submitRealTime = LocalDateTime.of(2026, 5, 10, 10, 0),
                submitGameTime = LocalDateTime.of(1939, 9, 1, 8, 0),
                status = InstructionStatus.SUBMITTED
            )
        )

        val response = get(
            "/api/instructions/manage?keyword=%20%20%20&current=1",
            bearerHeadersFor(manager)
        )

        assertEquals(HttpStatus.OK.value(), response.statusCode())
        val body = readJson(response.body())
        assertEquals(200, body["code"].asInt())
        assertEquals(1, body["data"]["content"].size())
    }

    @Test
    fun `my instruction query keeps enum status filtering and keyword search against real postgres`() {
        val conference = saveConference(name = "Asia MUN")
        val delegate = saveUser("delegate-c", UserRole.DELEGATE, conference)

        instructionRepository.save(
            Instruction(
                conference = conference,
                submitter = delegate,
                title = "Reviewed Keyword",
                instructionType = InstructionType.MILITARY,
                content = "keep",
                submitRealTime = LocalDateTime.of(2026, 5, 10, 9, 30),
                submitGameTime = LocalDateTime.of(1939, 9, 1, 9, 30),
                status = InstructionStatus.FEEDBACKED
            )
        )
        instructionRepository.save(
            Instruction(
                conference = conference,
                submitter = delegate,
                title = "Pending",
                instructionType = InstructionType.INTERNAL,
                content = "drop",
                submitRealTime = LocalDateTime.of(2026, 5, 10, 8, 30),
                submitGameTime = LocalDateTime.of(1939, 9, 1, 8, 30),
                status = InstructionStatus.SUBMITTED
            )
        )

        val response = get(
            "/api/instructions/my?status=FEEDBACKED&keyword=reviewed&current=1",
            bearerHeadersFor(delegate)
        )

        assertEquals(HttpStatus.OK.value(), response.statusCode())
        val body = readJson(response.body())
        assertEquals(200, body["code"].asInt())
        val content = body["data"]["content"]
        assertEquals(1, content.size())
        assertEquals("Reviewed Keyword", content[0]["title"].asText())
        assertEquals(InstructionStatus.FEEDBACKED.name, content[0]["status"].asText())
    }

    @Test
    fun `create instruction writes to real database`() {
        val conference = saveConference(name = "Asia MUN")
        val delegate = saveUser("delegate-d", UserRole.DELEGATE, conference)
        putConfig("INSTRUCTION_SUBMISSION_PAUSED", "false", "integration test switch")

        val response = postJson(
            "/api/instructions",
            InstructionCreateRequest(
                title = "Create From HTTP",
                instructionType = InstructionType.OTHER,
                content = "persist me"
            ),
            bearerHeadersFor(delegate)
        )

        assertEquals(HttpStatus.OK.value(), response.statusCode())
        val body = readJson(response.body())
        assertEquals(200, body["code"].asInt())
        val createdUuid = body["data"]["uuid"].asText()

        val stored = instructionRepository.findById(UUID.fromString(createdUuid)).orElseThrow()
        assertEquals("Create From HTTP", stored.title)
        assertEquals(InstructionStatus.SUBMITTED, stored.status)
        assertEquals(delegate.uuid, stored.submitter.uuid)
        assertTrue(stored.submitRealTime.isBefore(LocalDateTime.now().plusSeconds(1)))
    }

}
