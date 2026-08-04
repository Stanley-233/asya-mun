package top.bearingwall.asya.model

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.UUID

@Entity
@Table(
    name = "rounds",
    indexes = [
        Index(name = "idx_round_conference_current", columnList = "conference_id,is_current"),
        Index(name = "idx_round_end_at", columnList = "end_at")
    ]
)
class Round(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var uuid: UUID? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conference_id", nullable = false)
    var conference: Conference? = null,

    @Column(nullable = false)
    var name: String,

    @Column(name = "duration_seconds", nullable = false)
    var durationSeconds: Long,

    @Column(name = "remaining_seconds", nullable = false)
    var remainingSeconds: Long,

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "roundstatus")
    var status: RoundStatus,

    @Column(name = "is_current", nullable = false)
    var isCurrent: Boolean = false,

    @Column(name = "end_at")
    var endAt: LocalDateTime? = null,

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(ZoneOffset.UTC),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "next_round_id")
    var nextRound: Round? = null
)
