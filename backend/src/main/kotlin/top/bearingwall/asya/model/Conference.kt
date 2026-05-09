package top.bearingwall.asya.model

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.util.UUID

@Entity
@Table(name = "conferences")
class Conference(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var uuid: UUID? = null,

    @Column(nullable = false)
    var name: String,

    @Column
    var description: String,

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "conferencestatus")
    var status: ConferenceStatus = ConferenceStatus.PREPARING,

    @OneToMany(mappedBy = "conference", fetch = FetchType.LAZY)
    var users: MutableSet<User> = mutableSetOf()
)
