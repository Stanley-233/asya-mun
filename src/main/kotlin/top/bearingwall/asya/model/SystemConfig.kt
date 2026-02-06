package top.bearingwall.asya.model

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "system_configs")
class SystemConfig(
    @Id
    @Column(name = "config_key", length = 50, nullable = false)
    var key: String,

    @Column(name = "config_value", nullable = false)
    var value: String,

    @Column
    var description: String? = null
)
