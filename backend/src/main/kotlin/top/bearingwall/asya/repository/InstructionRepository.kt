package top.bearingwall.asya.repository

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import top.bearingwall.asya.model.Instruction
import top.bearingwall.asya.model.InstructionStatus
import top.bearingwall.asya.model.InstructionType
import java.util.UUID

interface InstructionRepository : JpaRepository<Instruction, UUID> {

    @Query("""
        SELECT i FROM Instruction i
        WHERE i.submitter.uuid = :submitterUuid
        AND (:status IS NULL OR i.status = :status)
        ORDER BY i.submitRealTime DESC, i.uuid DESC
    """)
    fun findAllBySubmitterUuid(submitterUuid: UUID, status: InstructionStatus?, pageable: Pageable): Page<Instruction>

    @Query("""
        SELECT DISTINCT i FROM Instruction i
        LEFT JOIN UserGroup ug ON :userGroupId IS NOT NULL
        LEFT JOIN ug.users ugu ON :userGroupId IS NOT NULL
        WHERE i.conference.uuid = :conferenceUuid
        AND (:status IS NULL OR i.status = :status)
        AND (:instructionType IS NULL OR i.instructionType = :instructionType)
        AND (:userGroupId IS NULL OR (ug.id = :userGroupId AND ugu.uuid = i.submitter.uuid))
        AND (:submitterUuids IS NULL OR i.submitter.uuid IN :submitterUuids)
        ORDER BY i.submitRealTime DESC, i.uuid DESC
    """)
    fun findForConferenceManagement(
        conferenceUuid: UUID,
        status: InstructionStatus?,
        instructionType: InstructionType?,
        userGroupId: Long?,
        submitterUuids: Set<UUID>?,
        pageable: Pageable
    ): Page<Instruction>
}
