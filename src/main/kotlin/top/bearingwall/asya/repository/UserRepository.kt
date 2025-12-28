package top.bearingwall.asya.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import top.bearingwall.asya.model.User
import java.util.UUID

@Repository
interface UserRepository : JpaRepository<User, UUID> {
    fun findByName(name: String): User?
}

