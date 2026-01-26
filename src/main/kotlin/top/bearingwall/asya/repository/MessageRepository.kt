package top.bearingwall.asya.repository

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import top.bearingwall.asya.model.Message
import java.util.UUID

interface MessageRepository : JpaRepository<Message, UUID> {
    fun findBySessionUuid(sessionUuid: UUID, pageable: Pageable): Page<Message>
    fun findBySessionConferenceUuid(conferenceUuid: UUID, pageable: Pageable): Page<Message>
}
