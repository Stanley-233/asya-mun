package top.bearingwall.asya.model

import jakarta.persistence.Column
import jakarta.persistence.Embeddable
import java.io.Serializable
import java.util.UUID

@Embeddable
data class MessageReceiverId(
    @Column(name = "message_id")
    var messageId: UUID? = null,

    @Column(name = "user_id")
    var userId: UUID? = null
) : Serializable

