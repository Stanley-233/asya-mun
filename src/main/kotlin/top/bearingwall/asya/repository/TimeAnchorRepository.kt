package top.bearingwall.asya.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import top.bearingwall.asya.model.TimeAnchor

@Repository
interface TimeAnchorRepository : JpaRepository<TimeAnchor, Long> {
    fun findByIsCurrentTrue(): TimeAnchor?

    // Find latest by ID or updateTime if needed, but isCurrent allows quick lookup of active one.
    // To get "latest" physically, we might sort by id desc.
    fun findFirstByOrderByIdDesc(): TimeAnchor?

    // For listing all, findAll() is sufficient.


    fun findFirstBySessionUuidOrderByIdDesc(sessionUuid: java.util.UUID): TimeAnchor?

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update TimeAnchor t set t.isCurrent = false where t.session.uuid = :sessionUuid")
    fun updateIsCurrentToFalseBySessionUuid(sessionUuid: java.util.UUID)
}
