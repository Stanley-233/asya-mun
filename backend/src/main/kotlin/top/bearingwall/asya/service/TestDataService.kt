package top.bearingwall.asya.service

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.audit.Auditable
import top.bearingwall.asya.dto.MessageType
import top.bearingwall.asya.dto.TestDataBootstrapResponse
import top.bearingwall.asya.dto.TestDataUserResponse
import top.bearingwall.asya.model.AuditActionType
import top.bearingwall.asya.model.Conference
import top.bearingwall.asya.model.ConferenceStatus
import top.bearingwall.asya.model.Instruction
import top.bearingwall.asya.model.InstructionType
import top.bearingwall.asya.model.Message
import top.bearingwall.asya.model.TimeAnchor
import top.bearingwall.asya.model.User
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.repository.ConferenceRepository
import top.bearingwall.asya.repository.InstructionRepository
import top.bearingwall.asya.repository.MessageRepository
import top.bearingwall.asya.repository.TimeAnchorRepository
import top.bearingwall.asya.repository.UserRepository
import top.bearingwall.asya.util.JwtUtil
import java.math.BigDecimal
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

@Service
class TestDataService(
    private val conferenceRepository: ConferenceRepository,
    private val userRepository: UserRepository,
    private val messageRepository: MessageRepository,
    private val instructionRepository: InstructionRepository,
    private val timeAnchorRepository: TimeAnchorRepository
) {
    private val passwordEncoder = BCryptPasswordEncoder()
    private val nameFormatter = DateTimeFormatter.ofPattern("yyyyMMddHHmmss")

    @Transactional
    @Auditable(type = AuditActionType.TEST_DATA_BOOTSTRAP, content = "初始化测试数据")
    fun bootstrapScenario(requester: User): TestDataBootstrapResponse {
        require(requester.role == UserRole.SYS_ADMIN) { "Only SYS_ADMIN can bootstrap test data" }

        val now = LocalDateTime.now()
        val seed = now.format(nameFormatter)
        val defaultPassword = "123456"

        val conference = conferenceRepository.save(
            Conference(
                name = "测试会议-$seed",
                description = "自动生成的联调测试会议",
                status = ConferenceStatus.RUNNING
            )
        )

        val dh = createUser("seed_dh_$seed", "DH", UserRole.DH, defaultPassword, conference)
        val dm = createUser("seed_dm_$seed", "DM", UserRole.DM, defaultPassword, conference)
        val delegateA = createUser("seed_delegate_a_$seed", "代表A", UserRole.DELEGATE, defaultPassword, conference)
        val delegateB = createUser("seed_delegate_b_$seed", "代表B", UserRole.DELEGATE, defaultPassword, conference)
        val delegateC = createUser("seed_delegate_c_$seed", "代表C", UserRole.DELEGATE, defaultPassword, conference)

        timeAnchorRepository.save(
            TimeAnchor(
                conference = conference,
                updateTime = now,
                anchorRealTime = now,
                anchorGameTime = now,
                timeRatio = BigDecimal("1.00"),
                isCurrent = true
            )
        )

        val publicMessages = (1..15).map { index ->
            val sender = if (index % 2 == 0) dh else dm
            Message(
                conference = conference,
                sender = sender,
                title = "公开测试消息-$index",
                brief = "公开测试消息摘要-$index",
                content = "这是自动生成的公开测试消息内容，第 $index 条。",
                msgType = publicMessageType(index),
                publishRealTime = now.plusMinutes(index.toLong()),
                publishGameTime = now.plusMinutes(index.toLong()),
                isSecret = false
            )
        }
        messageRepository.saveAll(publicMessages)

        val secretMessages = mutableListOf<Message>()
        (1..11).forEach { index ->
            secretMessages += secretMessage(
                conference = conference,
                sender = dh,
                receiver = delegateA,
                index = index,
                realTime = now.plusMinutes((15 + index).toLong())
            )
        }
        (1..4).forEach { index ->
            secretMessages += secretMessage(
                conference = conference,
                sender = dm,
                receiver = delegateB,
                index = 11 + index,
                realTime = now.plusMinutes((26 + index).toLong())
            )
        }
        messageRepository.saveAll(secretMessages)

        val instructions = (1..15).map { index ->
            val submitTime = now.plusMinutes((40 + index).toLong())
            Instruction(
                conference = conference,
                submitter = delegateA,
                title = "A代表测试指令-$index",
                instructionType = instructionType(index),
                content = "这是代表A自动生成的第 $index 条测试指令。",
                submitRealTime = submitTime,
                submitGameTime = submitTime
            )
        }
        instructionRepository.saveAll(instructions)

        val users = listOf(dh, dm, delegateA, delegateB, delegateC).map { user ->
            TestDataUserResponse(
                uuid = user.uuid?.toString() ?: "",
                name = user.name,
                displayName = user.displayName,
                role = user.role,
                password = defaultPassword,
                token = JwtUtil.generateAccessToken(
                    subject = user.uuid?.toString() ?: error("User id missing"),
                    claims = mapOf("name" to user.name, "role" to user.role.name),
                    authVersion = user.authVersion
                )
            )
        }

        return TestDataBootstrapResponse(
            conferenceUuid = conference.uuid?.toString() ?: "",
            conferenceName = conference.name,
            users = users,
            publicMessageCount = publicMessages.size,
            secretMessageCount = secretMessages.size,
            secretMessagesForA = 11,
            secretMessagesForB = 4,
            instructionCountFromA = instructions.size,
            timeRatio = "1.00"
        )
    }

    private fun createUser(
        name: String,
        displayName: String,
        role: UserRole,
        rawPassword: String,
        conference: Conference
    ): User {
        val hashedPassword = requireNotNull(passwordEncoder.encode(rawPassword)) {
            "BCryptPasswordEncoder returned null hash"
        }
        return userRepository.save(
            User(
                name = name,
                displayName = displayName,
                password = hashedPassword,
                role = role,
                conference = conference
            )
        )
    }

    private fun publicMessageType(index: Int): MessageType = when (index % 5) {
        0 -> MessageType.EVENT
        1 -> MessageType.NEWS
        2 -> MessageType.CRISIS
        3 -> MessageType.WAR_REPORT
        else -> MessageType.EVENT
    }

    private fun instructionType(index: Int): InstructionType = when (index % 4) {
        0 -> InstructionType.MILITARY
        1 -> InstructionType.DIPLOMACY
        2 -> InstructionType.INTERNAL
        else -> InstructionType.OTHER
    }

    private fun secretMessage(
        conference: Conference,
        sender: User,
        receiver: User,
        index: Int,
        realTime: LocalDateTime
    ): Message {
        return Message(
            conference = conference,
            sender = sender,
            title = "非对称测试消息-$index",
            brief = "定向投递给${receiver.displayName}",
            content = "这是自动生成的第 $index 条非对称测试消息，接收方为${receiver.displayName}。",
            msgType = MessageType.SECRET_LETTER,
            publishRealTime = realTime,
            publishGameTime = realTime,
            isSecret = true
        ).apply {
            addReceiver(receiver, realTime)
        }
    }
}
