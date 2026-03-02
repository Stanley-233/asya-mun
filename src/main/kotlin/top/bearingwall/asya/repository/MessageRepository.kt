package top.bearingwall.asya.repository

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import top.bearingwall.asya.model.Message
import java.util.UUID

interface MessageRepository : JpaRepository<Message, UUID> {

    @Query("SELECT m FROM Message m WHERE m.session.conference.uuid = :conferenceUuid AND m.isSecret = false")
    fun findPublicMessagesByConference(conferenceUuid: UUID, pageable: Pageable): Page<Message>

    @Query("SELECT DISTINCT m FROM Message m JOIN m.receivers r WHERE m.isSecret = true AND r.uuid = :userUuid")
    fun findSecretMessagesForUser(userUuid: UUID, pageable: Pageable): Page<Message>

    @Query("""
        SELECT DISTINCT m FROM Message m 
        LEFT JOIN m.receivers r 
        WHERE m.session.conference.uuid = :conferenceUuid 
        AND m.isSecret = true
        AND (:senderUuid IS NULL OR m.sender.uuid = :senderUuid)
        AND (:receiverUuid IS NULL OR r.uuid = :receiverUuid)
        AND (:keyword IS NULL OR m.title LIKE %:keyword%)
    """)
    fun findSecretMessagesForConferenceWithFilter(
        conferenceUuid: UUID,
        senderUuid: UUID?,
        receiverUuid: UUID?,
        keyword: String?,
        pageable: Pageable
    ): Page<Message>
}
