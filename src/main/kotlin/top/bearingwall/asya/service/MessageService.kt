package top.bearingwall.asya.service

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.dto.MessageCreateRequest
import top.bearingwall.asya.dto.MessageResponse
import top.bearingwall.asya.dto.MessageUpdateRequest
import top.bearingwall.asya.model.Message
import top.bearingwall.asya.repository.ConferenceSessionRepository
import top.bearingwall.asya.repository.MessageRepository
import top.bearingwall.asya.repository.UserRepository
import java.util.UUID

@Service
class MessageService(
    private val messageRepository: MessageRepository,
    private val conferenceSessionRepository: ConferenceSessionRepository,
    private val userRepository: UserRepository
) {

    @Transactional
    fun createMessage(request: MessageCreateRequest, senderUuid: UUID): MessageResponse {
        val session = conferenceSessionRepository.findById(UUID.fromString(request.sessionId)).orElseThrow {
            IllegalArgumentException("Session not found: ${request.sessionId}")
        }
        val sender = userRepository.findById(senderUuid).orElseThrow {
            IllegalArgumentException("User not found: $senderUuid")
        }

        val brief = if (!request.brief.isNullOrBlank()) {
            request.brief
        } else {
            request.content.take(30)
        }

        val message = Message(
            session = session,
            sender = sender,
            title = request.title,
            brief = brief,
            content = request.content,
            msgType = request.msgType,
            publishRealTime = request.publishRealTime ?: java.time.LocalDateTime.now(),
            publishGameTime = request.publishGameTime,
            isSecret = request.isSecret
        )

        return messageRepository.save(message).toResponse()
    }

    @Transactional
    fun updateMessage(uuid: UUID, request: MessageUpdateRequest): MessageResponse {
        val message = messageRepository.findById(uuid).orElseThrow {
            IllegalArgumentException("Message not found: $uuid")
        }

        request.title?.let { message.title = it }
        request.content?.let { message.content = it }
        request.brief?.let { message.brief = it }
        request.msgType?.let { message.msgType = it }
        request.publishRealTime?.let { message.publishRealTime = it }
        request.publishGameTime?.let { message.publishGameTime = it }
        request.isSecret?.let { message.isSecret = it }

        return messageRepository.save(message).toResponse()
    }

    @Transactional(readOnly = true)
    fun getMessagesForConference(conferenceId: UUID, pageable: Pageable): Page<MessageResponse> {
        return messageRepository.findBySessionConferenceUuid(conferenceId, pageable).map {
            it.toResponse(omitContent = true)
        }
    }

    @Transactional(readOnly = true)
    fun getMessage(uuid: UUID): MessageResponse {
        val message = messageRepository.findById(uuid).orElseThrow {
            IllegalArgumentException("Message not found: $uuid")
        }

        if (message.isSecret) {
            throw UnsupportedOperationException("Non-symmetric messages are not implemented yet")
        }

        return message.toResponse(omitContent = false)
    }

    private fun Message.toResponse(omitContent: Boolean = false) = MessageResponse(
        uuid = this.uuid.toString(),
        sessionId = this.session?.uuid.toString(),
        senderId = this.sender?.uuid.toString(),
        senderName = this.sender?.name,
        title = this.title,
        brief = this.brief,
        content = if (omitContent) null else this.content,
        msgType = this.msgType,
        publishRealTime = this.publishRealTime,
        publishGameTime = this.publishGameTime,
        isSecret = this.isSecret
    )
}
