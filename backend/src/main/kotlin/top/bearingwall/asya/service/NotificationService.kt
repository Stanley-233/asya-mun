package top.bearingwall.asya.service

import org.slf4j.LoggerFactory
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.dto.NotificationEventResponse
import top.bearingwall.asya.dto.NotificationKind
import top.bearingwall.asya.dto.NotificationSyncRequest
import top.bearingwall.asya.model.Instruction
import top.bearingwall.asya.model.InstructionStatus
import top.bearingwall.asya.model.Message
import top.bearingwall.asya.model.MessageReceiver
import top.bearingwall.asya.model.User
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.repository.InstructionRepository
import top.bearingwall.asya.repository.MessageReceiverRepository
import top.bearingwall.asya.repository.MessageRepository
import top.bearingwall.asya.repository.UserRepository
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.UUID

@Service
class NotificationService(
    private val simpMessagingTemplate: SimpMessagingTemplate,
    private val userRepository: UserRepository,
    private val messageRepository: MessageRepository,
    private val messageReceiverRepository: MessageReceiverRepository,
    private val instructionRepository: InstructionRepository,
) {
    private val log = LoggerFactory.getLogger(NotificationService::class.java)

    @Transactional(readOnly = true)
    fun syncNotifications(delegateUuid: UUID, request: NotificationSyncRequest) {
        val delegate = userRepository.findById(delegateUuid).orElse(null) ?: return
        if (delegate.role != UserRole.DELEGATE) {
            return
        }

        val conferenceUuid = delegate.conference?.uuid ?: return
        val now = LocalDateTime.now(ZoneOffset.UTC)

        val publicMessages = request.publicMessageAfter?.let {
            messageRepository.findAllPublicMessagesPublishedAfter(conferenceUuid, it)
        } ?: messageRepository.findAllPublicMessages(conferenceUuid)
        publicMessages.forEach { sendToUser(delegateUuid, toPublicMessageEvent(it)) }

        val secretEvents = request.secretMessageAfter?.let {
            messageReceiverRepository.findReadableEventsForUserBetween(delegateUuid, it, now)
        } ?: messageReceiverRepository.findReadableEventsForUserBefore(delegateUuid, now)
        secretEvents.forEach { sendToUser(delegateUuid, toSecretMessageEvent(it)) }

        val feedbackInstructions = request.instructionFeedbackAfter?.let {
            instructionRepository.findFeedbackedInstructionsReviewedAfter(delegateUuid, it)
        } ?: instructionRepository.findFeedbackedInstructions(delegateUuid)
        feedbackInstructions.forEach { sendToUser(delegateUuid, toInstructionFeedbackEvent(it)) }

        log.info(
            "Notification sync dispatched, userUuid={}, publicCount={}, secretCount={}, instructionCount={}",
            delegateUuid,
            publicMessages.size,
            secretEvents.size,
            feedbackInstructions.size,
        )
    }

    @Transactional(readOnly = true)
    fun notifyPublicMessage(message: Message) {
        val conferenceUuid = message.conference?.uuid ?: return
        val delegates = userRepository.findAllByConferenceUuidAndRole(conferenceUuid, UserRole.DELEGATE)
        val event = toPublicMessageEvent(message)
        delegates.forEach { delegate ->
            val delegateUuid = delegate.uuid ?: return@forEach
            sendToUser(delegateUuid, event)
        }
    }

    fun notifySecretMessage(messageReceiver: MessageReceiver) {
        val receiver = messageReceiver.receiver ?: return
        if (receiver.role != UserRole.DELEGATE) {
            return
        }
        val receiverUuid = receiver.uuid ?: return
        sendToUser(receiverUuid, toSecretMessageEvent(messageReceiver))
    }

    fun notifyInstructionFeedback(instruction: Instruction) {
        if (instruction.status != InstructionStatus.FEEDBACKED) {
            return
        }
        val submitter = instruction.submitter
        if (submitter.role != UserRole.DELEGATE) {
            return
        }
        val submitterUuid = submitter.uuid ?: return
        sendToUser(submitterUuid, toInstructionFeedbackEvent(instruction))
    }

    @Transactional(readOnly = true)
    fun notifyReadableSecretMessagesBetween(after: LocalDateTime, before: LocalDateTime) {
        if (!after.isBefore(before)) {
            return
        }
        messageReceiverRepository.findReadableEventsBetween(after, before).forEach(::notifySecretMessage)
    }

    private fun sendToUser(userUuid: UUID, event: NotificationEventResponse) {
        log.info("Dispatch notification, userUuid={}, kind={}, eventId={}", userUuid, event.kind, event.eventId)
        simpMessagingTemplate.convertAndSendToUser(userUuid.toString(), "/queue/notifications", event)
    }

    private fun toPublicMessageEvent(message: Message): NotificationEventResponse {
        val messageUuid = message.uuid?.toString() ?: throw IllegalStateException("Message uuid missing")
        val occurredAt = message.publishRealTime
        return NotificationEventResponse(
            eventId = "public:$messageUuid:$occurredAt",
            kind = NotificationKind.PUBLIC_MESSAGE,
            occurredAt = occurredAt,
            messageUuid = messageUuid,
            title = message.title?.trim().orEmpty().ifBlank { "新公开消息" },
            brief = message.brief?.trim().orEmpty().ifBlank { summarizeMessageContent(message.content) },
            senderName = displayName(message.sender),
        )
    }

    private fun toSecretMessageEvent(messageReceiver: MessageReceiver): NotificationEventResponse {
        val message = messageReceiver.message ?: throw IllegalStateException("Message missing")
        val receiverUuid = messageReceiver.receiver?.uuid?.toString()
            ?: throw IllegalStateException("Receiver uuid missing")
        val messageUuid = message.uuid?.toString() ?: throw IllegalStateException("Message uuid missing")
        val occurredAt = messageReceiver.readableAt
        return NotificationEventResponse(
            eventId = "secret:$messageUuid:$receiverUuid:$occurredAt",
            kind = NotificationKind.SECRET_MESSAGE,
            occurredAt = occurredAt,
            messageUuid = messageUuid,
            title = message.title?.trim().orEmpty().ifBlank { "新的非对称消息" },
            brief = message.brief?.trim().orEmpty().ifBlank { summarizeMessageContent(message.content) },
            senderName = displayName(message.sender),
        )
    }

    private fun toInstructionFeedbackEvent(instruction: Instruction): NotificationEventResponse {
        val instructionUuid = instruction.uuid?.toString() ?: throw IllegalStateException("Instruction uuid missing")
        val occurredAt = instruction.reviewedRealTime ?: throw IllegalStateException("Instruction reviewedRealTime missing")
        return NotificationEventResponse(
            eventId = "instruction:$instructionUuid:$occurredAt",
            kind = NotificationKind.INSTRUCTION_FEEDBACK,
            occurredAt = occurredAt,
            instructionUuid = instructionUuid,
            title = instruction.title.ifBlank { "指令已反馈" },
            brief = instruction.reviewComment?.trim().orEmpty().ifBlank { "您的指令已收到反馈，点击查看详情。" },
            senderName = displayName(instruction.reviewedBy),
        )
    }

    private fun displayName(user: User?): String? {
        return user?.displayName?.trim()?.takeIf { it.isNotEmpty() } ?: user?.name
    }

    private fun summarizeMessageContent(content: String?): String {
        val normalized = content?.trim().orEmpty()
        if (normalized.isEmpty()) {
            return "点击查看详情。"
        }
        return if (normalized.length > 64) "${normalized.take(64)}..." else normalized
    }
}
