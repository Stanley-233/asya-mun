package top.bearingwall.asya.repository

import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import top.bearingwall.asya.model.Round
import java.time.LocalDateTime
import java.util.UUID

@Repository
interface RoundRepository : JpaRepository<Round, UUID> {
    fun findByUuidAndConferenceUuid(uuid: UUID, conferenceUuid: UUID): Round?

    fun findAllByConferenceUuidOrderByUpdatedAtDesc(conferenceUuid: UUID): List<Round>

    fun findFirstByConferenceUuidAndIsCurrentTrue(conferenceUuid: UUID): Round?

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Round r where r.conference.uuid = :conferenceUuid and r.isCurrent = true")
    fun findCurrentForUpdate(@Param("conferenceUuid") conferenceUuid: UUID): Round?

    @Modifying
    @Query("update Round r set r.isCurrent = false where r.conference.uuid = :conferenceUuid")
    fun updateIsCurrentToFalseByConferenceUuid(@Param("conferenceUuid") conferenceUuid: UUID)

    @Query(
        """
        select distinct r.conference.uuid
        from Round r
        where r.isCurrent = true
          and r.status = top.bearingwall.asya.model.RoundStatus.RUNNING
          and r.endAt is not null
          and r.endAt <= :now
        """
    )
    fun findConferenceIdsWithExpiredCurrentRound(@Param("now") now: LocalDateTime): List<UUID>
}
