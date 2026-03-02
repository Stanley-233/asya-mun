package top.bearingwall.asya.service

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.dto.MessageCreateRequest
import top.bearingwall.asya.dto.MessageResponse
import top.bearingwall.asya.dto.MessageUpdateRequest
import top.bearingwall.asya.dto.UserInfoResponse
import top.bearingwall.asya.model.Message
import top.bearingwall.asya.repository.MessageRepository
import top.bearingwall.asya.repository.UserRepository
import java.util.UUID

@Service
class MessageService(
    private val messageRepository: MessageRepository,
    private val userRepository: UserRepository
) {

    @Transactional
    fun createMessage(request: MessageCreateRequest, senderUuid: UUID): MessageResponse {
        val sender = userRepository.findById(senderUuid).orElseThrow {
            IllegalArgumentException("User not found: $senderUuid")
        }
        val conference = sender.conference ?: throw IllegalStateException("Sender not associated with any conference")

        val brief = if (!request.brief.isNullOrBlank()) {
            request.brief
        } else {
            request.content.take(30)
        }

        val message = Message(
            conference = conference,
            sender = sender,
            title = request.title,
            brief = brief,
            content = request.content,
            msgType = request.msgType,
            publishRealTime = request.publishRealTime ?: java.time.LocalDateTime.now(),
            publishGameTime = request.publishGameTime,
            isSecret = request.isSecret
        )

        if (request.isSecret && !request.receiverIds.isNullOrEmpty()) {
            val receivers = userRepository.findAllById(request.receiverIds.map { UUID.fromString(it) })
            message.receivers.addAll(receivers)
        }

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
        return messageRepository.findPublicMessagesByConference(conferenceId, pageable).map {
            it.toResponse(omitContent = true)
        }
    }

    @Transactional(readOnly = true)
    fun getSecretMessagesForConference(
        conferenceUuid: UUID,
        pageable: Pageable,
        senderId: UUID? = null,
        receiverId: UUID? = null,
        keyword: String? = null
    ): Page<MessageResponse> {
        return messageRepository.findSecretMessagesForConferenceWithFilter(
            conferenceUuid,
            senderId,
            receiverId,
            keyword,
            pageable
        ).map {
            it.toResponse(omitContent = true)
        }
    }

    @Transactional(readOnly = true)
    fun getSecretMessagesForUser(userUuid: UUID, pageable: Pageable): Page<MessageResponse> {
        return messageRepository.findSecretMessagesForUser(userUuid, pageable).map {
            it.toResponse(omitContent = true)
        }
    }

    @Transactional(readOnly = true)
    fun getMessage(uuid: UUID, requesterUuid: UUID): MessageResponse {
        val message = messageRepository.findById(uuid).orElseThrow {
            IllegalArgumentException("Message not found: $uuid")
        }

        if (message.isSecret) {
            val requester = userRepository.findById(requesterUuid).orElseThrow {
                IllegalArgumentException("User not found: $requesterUuid")
            }
            val isPrivileged = requester.role in listOf(top.bearingwall.asya.model.UserRole.DH, top.bearingwall.asya.model.UserRole.DM, top.bearingwall.asya.model.UserRole.SYS_ADMIN)

            if (!isPrivileged) {
                val isReceiver = message.receivers.any { it.uuid == requesterUuid }
                val isSender = message.sender?.uuid == requesterUuid
                if (!isReceiver && !isSender) {
                    throw SecurityException("Access denied for secret message")
                }
            }
        }

        return message.toResponse(omitContent = false)
    }

    @Transactional(readOnly = true)
    fun getMessageReceivers(uuid: UUID): List<UserInfoResponse> {
        val message = messageRepository.findById(uuid).orElseThrow {
            IllegalArgumentException("Message not found: $uuid")
        }
        return message.receivers.map {
            UserInfoResponse(
                uuid = it.uuid.toString(),
                name = it.name,
                displayName = it.displayName,
                role = it.role
            )
        }
    }

    private fun Message.toResponse(omitContent: Boolean = false) = MessageResponse(
        uuid = this.uuid.toString(),
        conferenceId = this.conference?.uuid.toString(),
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

    @Transactional
    fun deleteMessage(uuid: UUID) {
        if (!messageRepository.existsById(uuid)) {
            throw IllegalArgumentException("Message not found: $uuid")
        }
        messageRepository.deleteById(uuid)
    }
}
