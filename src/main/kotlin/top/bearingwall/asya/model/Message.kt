package top.bearingwall.asya.model

import jakarta.persistence.*
import top.bearingwall.asya.dto.MessageType
import top.bearingwall.asya.util.LocalDateTimeStringConverter
import java.time.LocalDateTime
import java.util.UUID

@Entity
@Table(name = "messages")
class Message(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var uuid: UUID? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conference_id")
    var conference: Conference? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id")
    var sender: User? = null,

    @Column(length = 200)
    var title: String? = null,

    @Column(length = 500)
    var brief: String? = null,

    @Lob
    @Column(name = "msg_content", columnDefinition = "TEXT")
    var content: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "msg_type", length = 20)
    var msgType: MessageType? = null,

    @Column(name = "publish_real_time", nullable = false)
    var publishRealTime: LocalDateTime,

    @Column(name = "publish_game_time", nullable = false)
    @Convert(converter = LocalDateTimeStringConverter::class)
    var publishGameTime: LocalDateTime,

    @Column(name = "is_secret")
    var isSecret: Boolean = false,

    @OneToMany(mappedBy = "message", fetch = FetchType.LAZY, cascade = [CascadeType.ALL], orphanRemoval = true)
    var receiverMappings: MutableSet<MessageReceiver> = mutableSetOf(),

    @OneToMany(mappedBy = "message", fetch = FetchType.LAZY)
    var attachments: MutableSet<Attachment> = mutableSetOf()
) {
    fun addReceiver(receiver: User, readableAt: LocalDateTime) {
        val existing = receiverMappings.firstOrNull { it.receiver?.uuid == receiver.uuid }
        if (existing != null) {
            existing.readableAt = readableAt
            return
        }
        receiverMappings.add(
            MessageReceiver(
                message = this,
                receiver = receiver,
                readableAt = readableAt
            )
        )
    }

    fun addAttachment(attachment: Attachment) {
        attachment.targetId = this.uuid
        attachment.targetType = AttachmentTargetType.MESSAGE
        attachments.add(attachment)
        attachment.message = this
    }

    fun removeAttachment(attachment: Attachment) {
        attachments.remove(attachment)
        attachment.message = null
    }

    fun hasAttachment(): Boolean {
        return attachments.isNotEmpty()
    }
}
