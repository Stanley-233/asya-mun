package top.bearingwall.asya.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import top.bearingwall.asya.model.TimeAnchor

@Repository
interface TimeAnchorRepository : JpaRepository<TimeAnchor, Long> {
    fun findFirstBySessionUuidOrderByIdDesc(sessionUuid: java.util.UUID): TimeAnchor?

    fun findFirstBySessionUuidAndIsCurrentTrue(sessionUuid: java.util.UUID): TimeAnchor?

    fun findAllBySessionConferenceUuid(conferenceUuid: java.util.UUID): List<TimeAnchor>

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update TimeAnchor t set t.isCurrent = false where t.session.uuid = :sessionUuid")
    fun updateIsCurrentToFalseBySessionUuid(sessionUuid: java.util.UUID)
}
