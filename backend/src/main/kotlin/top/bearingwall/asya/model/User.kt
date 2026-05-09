package top.bearingwall.asya.model

import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.util.UUID

@Entity
@Table(name = "users")
class User(
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var uuid: UUID? = null,

    @Column(nullable = false)
    var name: String,

    @Column(name = "display_name")
    var displayName: String? = null,

    @Column(name = "password", nullable = false)
    var password: String,

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "userrole")
    var role: UserRole,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conference_id")
    var conference: Conference? = null,

    @OneToMany(mappedBy = "receiver", fetch = FetchType.LAZY)
    var messageReceiverMappings: MutableSet<MessageReceiver> = mutableSetOf()
)
