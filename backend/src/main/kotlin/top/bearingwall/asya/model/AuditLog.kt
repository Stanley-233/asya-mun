package top.bearingwall.asya.model

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.UUID

@Entity
@Table(name = "audit_logs")
class AuditLog(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @Column(name = "event_time", nullable = false)
    var eventTime: LocalDateTime = LocalDateTime.now(ZoneOffset.UTC),

    @Column(name = "actor_uuid")
    var actorUuid: UUID? = null,

    @Column(name = "actor_name", length = 120)
    var actorName: String? = null,

    @Column(name = "actor_ip", length = 45)
    var actorIp: String? = null,

    @Column(name = "request_method", length = 10)
    var requestMethod: String? = null,

    @Column(name = "request_path", length = 255)
    var requestPath: String? = null,

    @Column(name = "request_query", length = 1000)
    var requestQuery: String? = null,

    @Column(name = "user_agent", length = 300)
    var userAgent: String? = null,

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "action_type", nullable = false, length = 64, columnDefinition = "auditactiontype")
    var actionType: AuditActionType,

    @Column(name = "resource_type", length = 80)
    var resourceType: String? = null,

    @Column(name = "resource_id", length = 120)
    var resourceId: String? = null,

    @Column(name = "event_content", nullable = false, columnDefinition = "text")
    var eventContent: String,

    @Column(name = "context_data", columnDefinition = "text")
    var contextData: String? = null,

    @Column(name = "success", nullable = false)
    var success: Boolean = true
)
