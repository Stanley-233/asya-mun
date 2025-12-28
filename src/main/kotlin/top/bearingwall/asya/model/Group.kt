package top.bearingwall.asya.model

import jakarta.persistence.*

@Entity
@Table(name = "groups")
class Group(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Int? = null,

    @Column(nullable = false)
    var name: String,

    @ManyToMany(mappedBy = "groups")
    var users: MutableSet<User> = mutableSetOf()
)

