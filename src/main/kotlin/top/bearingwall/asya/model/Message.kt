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
    @JoinColumn(name = "session_id")
    var session: ConferenceSession? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id")
    var sender: User? = null,

    @Column(length = 200)
    var title: String? = null,

    @Column(length = 500)
    var brief: String? = null,

    @Lob
    @Column(name = "msg_content", columnDefinition = "LONGTEXT")
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
    var isSecret: Boolean = false
)
