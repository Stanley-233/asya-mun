package top.bearingwall.asya.model

import jakarta.persistence.*
import top.bearingwall.asya.dto.SessionStatus
import java.util.UUID

@Entity
@Table(name = "conference_sessions")
class ConferenceSession(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var uuid: UUID? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conference_id", nullable = false)
    var conference: Conference,

    @Column(nullable = false)
    var name: String,

    @Column
    var description: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: SessionStatus = SessionStatus.PREPARE
)
