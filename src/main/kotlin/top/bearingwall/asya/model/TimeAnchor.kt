package top.bearingwall.asya.model

import jakarta.persistence.*
import top.bearingwall.asya.util.LocalDateTimeStringConverter
import java.math.BigDecimal
import java.time.LocalDateTime

@Entity
@Table(name = "time_anchors")
class TimeAnchor(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conference_id", nullable = false)
    var conference: Conference? = null,

    @Column(name = "update_time")
    var updateTime: LocalDateTime? = null,

    @Column(name = "anchor_real_time")
    var anchorRealTime: LocalDateTime? = null,

    @Column(name = "anchor_game_time")
    @Convert(converter = LocalDateTimeStringConverter::class)
    var anchorGameTime: LocalDateTime? = null,

    @Column(name = "time_ratio", precision = 10, scale = 2)
    var timeRatio: BigDecimal? = null,

    @Column(name = "is_current")
    var isCurrent: Boolean = false
)
