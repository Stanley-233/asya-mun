package top.bearingwall.asya.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import top.bearingwall.asya.model.TimeAnchor

@Repository
interface TimeAnchorRepository : JpaRepository<TimeAnchor, Long> {
    fun findFirstByConferenceUuidOrderByIdDesc(conferenceUuid: java.util.UUID): TimeAnchor?

    fun findFirstByConferenceUuidAndIsCurrentTrue(conferenceUuid: java.util.UUID): TimeAnchor?

    fun findAllByConferenceUuid(conferenceUuid: java.util.UUID): List<TimeAnchor>

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update TimeAnchor t set t.isCurrent = false where t.conference.uuid = :conferenceUuid")
    fun updateIsCurrentToFalseByConferenceUuid(conferenceUuid: java.util.UUID)
}
