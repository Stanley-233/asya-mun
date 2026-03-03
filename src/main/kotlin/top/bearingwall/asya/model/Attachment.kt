package top.bearingwall.asya.model

import jakarta.persistence.*
import java.util.UUID

@Entity
@Table(
    name = "attachments",
    indexes = [
        Index(name = "idx_attachment_message_id", columnList = "message_id"),
        Index(name = "idx_attachment_target", columnList = "target_type,target_id")
    ]
)
class Attachment(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var uuid: UUID? = null,

    @Column(name = "file_name", length = 255, nullable = false)
    var fileName: String,

    // 后缀名
    @Column(name = "file_type", length = 20, nullable = false)
    var fileType: String,

    @Column(name = "file_size", nullable = false)
    var fileSize: Long,

    @Lob
    @Column(name = "file_blob", nullable = false)
    var fileBlob: ByteArray,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "message_id")
    var message: Message? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", length = 30)
    var targetType: AttachmentTargetType? = null,

    @Column(name = "target_id")
    var targetId: UUID? = null
)
