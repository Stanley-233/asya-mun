package top.bearingwall.asya.model

import jakarta.persistence.*
import top.bearingwall.asya.util.LocalDateTimeStringConverter
import java.time.LocalDateTime
import java.util.UUID

@Entity
@Table(name = "instructions")
class Instruction(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var uuid: UUID? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conference_id", nullable = false)
    var conference: Conference,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submitter_id", nullable = false)
    var submitter: User,

    @Column(nullable = false, length = 200)
    var title: String,

    @Enumerated(EnumType.STRING)
    @Column(name = "instruction_type", nullable = false, length = 32)
    var instructionType: InstructionType,

    @Lob
    @Column(name = "instruction_content", nullable = false, columnDefinition = "TEXT")
    var content: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    var status: InstructionStatus = InstructionStatus.SUBMITTED,

    @Lob
    @Column(name = "review_comment", columnDefinition = "TEXT")
    var reviewComment: String? = null,

    @Column(name = "submit_real_time", nullable = false)
    var submitRealTime: LocalDateTime,

    @Column(name = "submit_game_time", nullable = false)
    @Convert(converter = LocalDateTimeStringConverter::class)
    var submitGameTime: LocalDateTime,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    var reviewedBy: User? = null,

    @Column(name = "reviewed_real_time")
    var reviewedRealTime: LocalDateTime? = null,

    @Column(name = "reviewed_game_time")
    @Convert(converter = LocalDateTimeStringConverter::class)
    var reviewedGameTime: LocalDateTime? = null
)

