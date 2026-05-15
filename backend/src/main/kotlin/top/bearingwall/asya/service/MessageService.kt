package top.bearingwall.asya.service

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.domain.Specification
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.audit.Auditable
import top.bearingwall.asya.dto.MessageCreateRequest
import top.bearingwall.asya.dto.MessageReceiverVisibilityResponse
import top.bearingwall.asya.dto.MessageResponse
import top.bearingwall.asya.dto.MessageUpdateRequest
import top.bearingwall.asya.model.AuditActionType
import top.bearingwall.asya.model.Message
import top.bearingwall.asya.repository.AttachmentRepository
import top.bearingwall.asya.repository.MessageRepository
import top.bearingwall.asya.repository.UserRepository
import java.time.LocalDateTime
import java.util.UUID

@Service
class MessageService(
    private val messageRepository: MessageRepository,
    private val userRepository: UserRepository,
    private val attachmentRepository: AttachmentRepository
) {

    @Transactional
    @Auditable(type = AuditActionType.MESSAGE_CREATE, content = "创建消息")
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
            publishRealTime = request.publishRealTime ?: LocalDateTime.now(),
            publishGameTime = request.publishGameTime,
            isSecret = request.isSecret
        )

        if (request.isSecret && !request.receiverIds.isNullOrEmpty()) {
            if (request.receiverIds.any { it.delayMinutes < 0 }) {
                throw IllegalArgumentException("delayMinutes must be >= 0")
            }

            val receiverIds = request.receiverIds.map { UUID.fromString(it.receiverId) }
            val receivers = userRepository.findAllById(receiverIds)
            if (receivers.size != receiverIds.toSet().size) {
                val foundIds = receivers.mapNotNull { it.uuid }.toSet()
                val missing = receiverIds.toSet().filterNot { it in foundIds }
                throw IllegalArgumentException("Receiver not found: $missing")
            }

            val receiverMap = receivers.associateBy { it.uuid!! }
            request.receiverIds.forEach { item ->
                val receiverId = UUID.fromString(item.receiverId)
                val receiver = receiverMap[receiverId]
                    ?: throw IllegalArgumentException("Receiver not found: $receiverId")
                val readableAt = message.publishRealTime.plusMinutes(item.delayMinutes.toLong())
                message.addReceiver(receiver, readableAt)
            }
        }

        val saved = messageRepository.save(message)
        applyAttachments(saved, request.attachmentUuids)
        return messageRepository.save(saved).toResponse()
    }

    @Transactional
    @Auditable(type = AuditActionType.MESSAGE_UPDATE, content = "更新消息")
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
        request.receiverIds?.let { receiverItems ->
            val targetReadableAtByReceiverId = receiverItems.associate { UUID.fromString(it.receiverId) to it.readableAt }
            val receiverIds = targetReadableAtByReceiverId.keys
            val receivers = userRepository.findAllById(receiverIds)
            if (receivers.size != receiverIds.size) {
                val foundIds = receivers.mapNotNull { it.uuid }.toSet()
                val missing = receiverIds.filterNot { it in foundIds }
                throw IllegalArgumentException("Receiver not found: $missing")
            }
            val receiverMap = receivers.associateBy { it.uuid!! }

            val existingByReceiverId = message.receiverMappings
                .mapNotNull { mapping -> mapping.receiver?.uuid?.let { it to mapping } }
                .toMap(mutableMapOf())

            targetReadableAtByReceiverId.forEach { (receiverId, readableAt) ->
                val existing = existingByReceiverId.remove(receiverId)
                if (existing != null) {
                    existing.readableAt = readableAt
                } else {
                    val receiver = receiverMap[receiverId]
                        ?: throw IllegalArgumentException("Receiver not found: $receiverId")
                    message.addReceiver(receiver, readableAt)
                }
            }

            if (existingByReceiverId.isNotEmpty()) {
                val staleReceiverIds = existingByReceiverId.keys
                message.receiverMappings.removeIf { mapping -> mapping.receiver?.uuid in staleReceiverIds }
            }
        }
        applyAttachments(message, request.attachmentUuids)

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
        var spec = byConference(conferenceUuid).and(isSecret())
        senderId?.let { spec = spec.and(hasSender(it)) }
        receiverId?.let { spec = spec.and(hasReceiver(it)) }
        keyword?.trim()?.takeIf { it.isNotEmpty() }?.let { spec = spec.and(titleContains(it)) }

        return messageRepository.findAll(spec, pageable).map {
            it.toResponse(omitContent = true)
        }
    }

    @Transactional(readOnly = true)
    fun getSecretMessagesForUser(userUuid: UUID, pageable: Pageable): Page<MessageResponse> {
        return messageRepository.findSecretMessagesForUser(userUuid, LocalDateTime.now(), pageable).map {
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
                val receiverMapping = message.receiverMappings.firstOrNull { it.receiver?.uuid == requesterUuid }
                val canReadByTime = receiverMapping?.readableAt?.let { !it.isAfter(LocalDateTime.now()) } ?: false
                val isSender = message.sender?.uuid == requesterUuid
                if ((!canReadByTime) && !isSender) {
                    throw SecurityException("Access denied for secret message")
                }
            }
        }

        return message.toResponse(omitContent = false)
    }

    @Transactional(readOnly = true)
    fun getMessageReceivers(uuid: UUID): List<MessageReceiverVisibilityResponse> {
        val message = messageRepository.findById(uuid).orElseThrow {
            IllegalArgumentException("Message not found: $uuid")
        }
        return message.receiverMappings.mapNotNull { mapping ->
            val receiver = mapping.receiver ?: return@mapNotNull null
            MessageReceiverVisibilityResponse(
                uuid = receiver.uuid.toString(),
                name = receiver.name,
                displayName = receiver.displayName,
                role = receiver.role,
                readableAt = mapping.readableAt
            )
        }
    }

    private fun Message.toResponse(omitContent: Boolean = false) = MessageResponse(
        uuid = this.uuid.toString(),
        conferenceId = this.conference?.uuid.toString(),
        senderId = this.sender?.uuid.toString(),
        senderName = this.sender?.name,
        senderDisplayName = this.sender?.displayName,
        title = this.title,
        brief = this.brief,
        content = if (omitContent) null else this.content,
        msgType = this.msgType,
        publishRealTime = this.publishRealTime,
        publishGameTime = this.publishGameTime,
        isSecret = this.isSecret,
        hasAttachment = if (omitContent) null else this.attachments.isNotEmpty(),
        attachmentUuids = if (omitContent) null else this.attachments.mapNotNull { it.uuid?.toString() }
    )

    private fun byConference(conferenceUuid: UUID): Specification<Message> {
        return Specification { root, _, cb ->
            cb.equal(root.get<top.bearingwall.asya.model.Conference>("conference").get<UUID>("uuid"), conferenceUuid)
        }
    }

    private fun isSecret(): Specification<Message> {
        return Specification { root, _, cb ->
            cb.isTrue(root.get("isSecret"))
        }
    }

    private fun hasSender(senderUuid: UUID): Specification<Message> {
        return Specification { root, _, cb ->
            cb.equal(root.get<top.bearingwall.asya.model.User>("sender").get<UUID>("uuid"), senderUuid)
        }
    }

    private fun hasReceiver(receiverUuid: UUID): Specification<Message> {
        return Specification { root, query, cb ->
            query.distinct(true)
            val receiverJoin = root.join<Message, top.bearingwall.asya.model.MessageReceiver>("receiverMappings")
            cb.equal(receiverJoin.get<top.bearingwall.asya.model.User>("receiver").get<UUID>("uuid"), receiverUuid)
        }
    }

    private fun titleContains(keyword: String): Specification<Message> {
        return Specification { root, _, cb ->
            cb.like(cb.lower(root.get("title")), "%${keyword.lowercase()}%")
        }
    }

    private fun applyAttachments(message: Message, attachmentUuids: List<String>?) {
        if (attachmentUuids == null) {
            return
        }

        val targetUuids = attachmentUuids.map { UUID.fromString(it) }.toSet()
        val attachmentsToSave = mutableListOf<top.bearingwall.asya.model.Attachment>()

        message.attachments.toList().forEach { existing ->
            val existingUuid = existing.uuid
            if (existingUuid != null && existingUuid !in targetUuids) {
                message.removeAttachment(existing)
                existing.targetType = null
                existing.targetId = null
                attachmentsToSave.add(existing)
            }
        }

        if (targetUuids.isNotEmpty()) {
            val fetched = attachmentRepository.findAllById(targetUuids)
            if (fetched.size != targetUuids.size) {
                val found = fetched.mapNotNull { it.uuid }.toSet()
                val missing = targetUuids.filterNot { it in found }
                throw IllegalArgumentException("Attachment not found: $missing")
            }

            fetched.forEach { attachment ->
                val existingMessageId = attachment.message?.uuid
                if (existingMessageId != null && existingMessageId != message.uuid) {
                    throw IllegalStateException("Attachment already bound to another message: ${attachment.uuid}")
                }
                if (message.attachments.none { it.uuid == attachment.uuid }) {
                    message.addAttachment(attachment)
                    attachmentsToSave.add(attachment)
                }
            }
        }

        if (attachmentsToSave.isNotEmpty()) {
            attachmentRepository.saveAll(attachmentsToSave)
        }
    }

    @Transactional
    @Auditable(type = AuditActionType.MESSAGE_DELETE, content = "删除消息")
    fun deleteMessage(uuid: UUID) {
        if (!messageRepository.existsById(uuid)) {
            throw IllegalArgumentException("Message not found: $uuid")
        }
        messageRepository.deleteById(uuid)
    }
}
