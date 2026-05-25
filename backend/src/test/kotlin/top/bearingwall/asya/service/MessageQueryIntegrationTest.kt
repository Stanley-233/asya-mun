package top.bearingwall.asya.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import top.bearingwall.asya.dto.MessageType
import top.bearingwall.asya.model.Message
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.repository.MessageRepository
import top.bearingwall.asya.support.PostgresIntegrationTest
import java.time.LocalDateTime

class MessageQueryIntegrationTest : PostgresIntegrationTest() {

    @Autowired
    lateinit var messageRepository: MessageRepository

    @Test
    fun `public message query filters by conference secret flag and keyword against real postgres`() {
        val conference = saveConference(name = "Asia MUN")
        val otherConference = saveConference(name = "Other MUN")
        val delegate = saveUser("delegate-public", UserRole.DELEGATE, conference)
        val sender = saveUser("dm-public", UserRole.DM, conference)
        val otherSender = saveUser("dm-other", UserRole.DM, otherConference)

        messageRepository.save(
            Message(
                conference = conference,
                sender = sender,
                title = "Daily Update",
                brief = "matched",
                content = "Alpha KEYWORD public content",
                msgType = MessageType.EVENT,
                publishRealTime = LocalDateTime.of(2026, 5, 10, 10, 0),
                publishGameTime = LocalDateTime.of(1939, 9, 1, 8, 0),
                isSecret = false
            )
        )
        messageRepository.save(
            Message(
                conference = conference,
                sender = sender,
                title = "No Match",
                brief = "other",
                content = "ordinary public content",
                msgType = MessageType.EVENT,
                publishRealTime = LocalDateTime.of(2026, 5, 10, 9, 0),
                publishGameTime = LocalDateTime.of(1939, 9, 1, 7, 0),
                isSecret = false
            )
        )
        messageRepository.save(
            Message(
                conference = conference,
                sender = sender,
                title = "Hidden Keyword",
                brief = "secret",
                content = "KEYWORD secret content",
                msgType = MessageType.SECRET_LETTER,
                publishRealTime = LocalDateTime.of(2026, 5, 10, 8, 0),
                publishGameTime = LocalDateTime.of(1939, 9, 1, 6, 0),
                isSecret = true
            )
        )
        messageRepository.save(
            Message(
                conference = otherConference,
                sender = otherSender,
                title = "Other Conference",
                brief = "other conf",
                content = "KEYWORD other conference content",
                msgType = MessageType.EVENT,
                publishRealTime = LocalDateTime.of(2026, 5, 10, 7, 0),
                publishGameTime = LocalDateTime.of(1939, 9, 1, 5, 0),
                isSecret = false
            )
        )

        val response = get("/api/messages?keyword=keyword", bearerHeadersFor(delegate))

        assertEquals(HttpStatus.OK.value(), response.statusCode())
        val body = readJson(response.body())
        assertEquals(200, body["code"].asInt())
        val content = body["data"]["content"]
        assertEquals(1, content.size())
        assertEquals("Daily Update", content[0]["title"].asText())
    }

    @Test
    fun `secret conference query filters sender receiver and content keyword against real postgres`() {
        val conference = saveConference(name = "Asia MUN")
        val manager = saveUser("dm-secret", UserRole.DM, conference)
        val sender = saveUser("sender-secret", UserRole.DH, conference)
        val receiver = saveUser("receiver-secret", UserRole.DELEGATE, conference)
        val otherReceiver = saveUser("other-receiver-secret", UserRole.DELEGATE, conference)

        val matched = Message(
            conference = conference,
            sender = sender,
            title = "Matched Secret",
            brief = "matched",
            content = "Special KEYWORD content",
            msgType = MessageType.SECRET_LETTER,
            publishRealTime = LocalDateTime.of(2026, 5, 10, 10, 0),
            publishGameTime = LocalDateTime.of(1939, 9, 1, 8, 0),
            isSecret = true
        )
        matched.addReceiver(receiver, LocalDateTime.now().minusMinutes(5))
        messageRepository.save(matched)

        val wrongKeyword = Message(
            conference = conference,
            sender = sender,
            title = "Wrong Match",
            brief = "wrong keyword",
            content = "content without hit",
            msgType = MessageType.SECRET_LETTER,
            publishRealTime = LocalDateTime.of(2026, 5, 10, 9, 0),
            publishGameTime = LocalDateTime.of(1939, 9, 1, 7, 0),
            isSecret = true
        )
        wrongKeyword.addReceiver(receiver, LocalDateTime.now().minusMinutes(5))
        messageRepository.save(wrongKeyword)

        val wrongReceiver = Message(
            conference = conference,
            sender = sender,
            title = "Wrong Receiver",
            brief = "wrong receiver",
            content = "KEYWORD but wrong receiver",
            msgType = MessageType.SECRET_LETTER,
            publishRealTime = LocalDateTime.of(2026, 5, 10, 8, 0),
            publishGameTime = LocalDateTime.of(1939, 9, 1, 6, 0),
            isSecret = true
        )
        wrongReceiver.addReceiver(otherReceiver, LocalDateTime.now().minusMinutes(5))
        messageRepository.save(wrongReceiver)

        val response = get(
            "/api/messages/secret/conference?senderId=${sender.uuid}&receiverId=${receiver.uuid}&keyword=keyword",
            bearerHeadersFor(manager)
        )

        assertEquals(HttpStatus.OK.value(), response.statusCode())
        val body = readJson(response.body())
        assertEquals(200, body["code"].asInt())
        val content = body["data"]["content"]
        assertEquals(1, content.size())
        assertEquals("Matched Secret", content[0]["title"].asText())
    }

    @Test
    fun `secret message query for user filters readable messages and keyword against real postgres`() {
        val conference = saveConference(name = "Asia MUN")
        val sender = saveUser("dm-receiver", UserRole.DM, conference)
        val receiver = saveUser("delegate-receiver", UserRole.DELEGATE, conference)
        val otherReceiver = saveUser("delegate-other", UserRole.DELEGATE, conference)

        val matched = Message(
            conference = conference,
            sender = sender,
            title = "Readable Secret",
            brief = "matched",
            content = "Receiver KEYWORD content",
            msgType = MessageType.SECRET_LETTER,
            publishRealTime = LocalDateTime.of(2026, 5, 10, 10, 0),
            publishGameTime = LocalDateTime.of(1939, 9, 1, 8, 0),
            isSecret = true
        )
        matched.addReceiver(receiver, LocalDateTime.now().minusMinutes(1))
        messageRepository.save(matched)

        val unreadable = Message(
            conference = conference,
            sender = sender,
            title = "Unreadable Secret",
            brief = "future",
            content = "KEYWORD future content",
            msgType = MessageType.SECRET_LETTER,
            publishRealTime = LocalDateTime.of(2026, 5, 10, 9, 0),
            publishGameTime = LocalDateTime.of(1939, 9, 1, 7, 0),
            isSecret = true
        )
        unreadable.addReceiver(receiver, LocalDateTime.now().plusMinutes(10))
        messageRepository.save(unreadable)

        val wrongKeyword = Message(
            conference = conference,
            sender = sender,
            title = "Other Secret",
            brief = "wrong keyword",
            content = "ordinary secret content",
            msgType = MessageType.SECRET_LETTER,
            publishRealTime = LocalDateTime.of(2026, 5, 10, 8, 0),
            publishGameTime = LocalDateTime.of(1939, 9, 1, 6, 0),
            isSecret = true
        )
        wrongKeyword.addReceiver(receiver, LocalDateTime.now().minusMinutes(1))
        messageRepository.save(wrongKeyword)

        val otherRecipient = Message(
            conference = conference,
            sender = sender,
            title = "Other Recipient",
            brief = "other recipient",
            content = "KEYWORD but not for receiver",
            msgType = MessageType.SECRET_LETTER,
            publishRealTime = LocalDateTime.of(2026, 5, 10, 7, 0),
            publishGameTime = LocalDateTime.of(1939, 9, 1, 5, 0),
            isSecret = true
        )
        otherRecipient.addReceiver(otherReceiver, LocalDateTime.now().minusMinutes(1))
        messageRepository.save(otherRecipient)

        val response = get("/api/messages/secret?keyword=keyword", bearerHeadersFor(receiver))

        assertEquals(HttpStatus.OK.value(), response.statusCode())
        val body = readJson(response.body())
        assertEquals(200, body["code"].asInt())
        val content = body["data"]["content"]
        assertEquals(1, content.size())
        assertEquals("Readable Secret", content[0]["title"].asText())
    }
}
