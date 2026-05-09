package top.bearingwall.asya.model

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.LocalDateTime
import java.util.UUID

@Entity
@Table(
    name = "delegate_attr_configs",
    uniqueConstraints = [
        UniqueConstraint(
            name = "uk_delegate_attr_config_conference_key",
            columnNames = ["conference_id", "attr_key"]
        )
    ]
)
class DelegateAttrConfig(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conference_id", nullable = false)
    var conference: Conference,

    @Column(name = "attr_key", nullable = false, length = 80)
    var attrKey: String,

    @Column(name = "attr_label", nullable = false, length = 120)
    var attrLabel: String,

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "attr_type", nullable = false, length = 16, columnDefinition = "delegateattrtype")
    var attrType: DelegateAttrType,

    @Column(name = "enabled", nullable = false)
    var enabled: Boolean = true,

    @Column(name = "visible", nullable = false, columnDefinition = "boolean default true")
    var visible: Boolean = true,

    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,

    @Column(name = "created_at", nullable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "created_by")
    var createdBy: UUID? = null,

    @Column(name = "updated_by")
    var updatedBy: UUID? = null
)
