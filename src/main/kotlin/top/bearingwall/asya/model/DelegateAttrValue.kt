package top.bearingwall.asya.model

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.math.BigDecimal
import java.util.UUID

@Entity
@Table(
    name = "delegate_attr_values",
    uniqueConstraints = [
        UniqueConstraint(
            name = "uk_delegate_attr_value_record_config",
            columnNames = ["record_id", "attr_config_id"]
        )
    ]
)
class DelegateAttrValue(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "record_id", nullable = false)
    var record: DelegateAttrRecord,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attr_config_id", nullable = false)
    var attrConfig: DelegateAttrConfig,

    @Column(name = "value_text", length = 1000)
    var valueText: String? = null,

    @Column(name = "value_number", precision = 20, scale = 6)
    var valueNumber: BigDecimal? = null
)
