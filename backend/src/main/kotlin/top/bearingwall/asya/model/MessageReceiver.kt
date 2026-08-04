package top.bearingwall.asya.model

import jakarta.persistence.Column
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.MapsId
import jakarta.persistence.Table
import java.time.LocalDateTime
import java.time.ZoneOffset

@Entity
@Table(name = "message_receivers")
class MessageReceiver(
    @EmbeddedId
    var id: MessageReceiverId = MessageReceiverId(),

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("messageId")
    @JoinColumn(name = "message_id")
    var message: Message? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id")
    var receiver: User? = null,

    @Column(name = "readable_at", nullable = false)
    var readableAt: LocalDateTime = LocalDateTime.now(ZoneOffset.UTC)
)

