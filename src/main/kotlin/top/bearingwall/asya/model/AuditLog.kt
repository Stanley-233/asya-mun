package top.bearingwall.asya.model

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime
import java.util.UUID

@Entity
@Table(name = "audit_logs")
class AuditLog(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @Column(name = "event_time", nullable = false)
    var eventTime: LocalDateTime = LocalDateTime.now(),

    @Column(name = "actor_uuid")
    var actorUuid: UUID? = null,

    @Column(name = "actor_name", length = 120)
    var actorName: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false, length = 64)
    var actionType: AuditActionType,

    @Column(name = "event_content", nullable = false, length = 1000)
    var eventContent: String,

    @Column(name = "success", nullable = false)
    var success: Boolean = true
)

