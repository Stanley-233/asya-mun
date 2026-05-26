package top.bearingwall.asya.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository
import top.bearingwall.asya.model.MessageReceiver
import top.bearingwall.asya.model.MessageReceiverId
import java.time.LocalDateTime
import java.util.UUID

@Repository
interface MessageReceiverRepository : JpaRepository<MessageReceiver, MessageReceiverId> {

    @Query(
        """
        select mr
        from MessageReceiver mr
        join fetch mr.message m
        join fetch mr.receiver r
        left join fetch m.sender s
        where m.isSecret = true
          and r.uuid = :userUuid
          and mr.readableAt <= :before
        order by mr.readableAt asc, m.publishRealTime asc
        """
    )
    fun findReadableEventsForUserBefore(
        userUuid: UUID,
        before: LocalDateTime,
    ): List<MessageReceiver>

    @Query(
        """
        select mr
        from MessageReceiver mr
        join fetch mr.message m
        join fetch mr.receiver r
        left join fetch m.sender s
        where m.isSecret = true
          and r.uuid = :userUuid
          and mr.readableAt > :after
          and mr.readableAt <= :before
        order by mr.readableAt asc, m.publishRealTime asc
        """
    )
    fun findReadableEventsForUserBetween(
        userUuid: UUID,
        after: LocalDateTime,
        before: LocalDateTime,
    ): List<MessageReceiver>

    @Query(
        """
        select mr
        from MessageReceiver mr
        join fetch mr.message m
        join fetch mr.receiver r
        left join fetch m.sender s
        where m.isSecret = true
          and mr.readableAt <= :before
          and mr.readableAt > :after
        order by mr.readableAt asc, m.publishRealTime asc
        """
    )
    fun findReadableEventsBetween(
        after: LocalDateTime,
        before: LocalDateTime,
    ): List<MessageReceiver>
}
