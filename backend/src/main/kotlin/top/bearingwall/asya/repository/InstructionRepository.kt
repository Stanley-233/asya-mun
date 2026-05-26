package top.bearingwall.asya.repository

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor
import org.springframework.data.jpa.repository.Query
import top.bearingwall.asya.model.Instruction
import top.bearingwall.asya.model.InstructionStatus
import java.time.LocalDateTime
import java.util.UUID

interface InstructionRepository : JpaRepository<Instruction, UUID>, JpaSpecificationExecutor<Instruction> {
    fun findAllBySubmitterUuid(submitterUuid: UUID, pageable: Pageable): Page<Instruction>

    @Query(
        """
        select i
        from Instruction i
        left join fetch i.reviewedBy rb
        where i.submitter.uuid = :submitterUuid
          and i.status = top.bearingwall.asya.model.InstructionStatus.FEEDBACKED
        order by i.reviewedRealTime asc, i.uuid asc
        """
    )
    fun findFeedbackedInstructions(submitterUuid: UUID): List<Instruction>

    @Query(
        """
        select i
        from Instruction i
        left join fetch i.reviewedBy rb
        where i.submitter.uuid = :submitterUuid
          and i.status = top.bearingwall.asya.model.InstructionStatus.FEEDBACKED
          and i.reviewedRealTime > :after
        order by i.reviewedRealTime asc, i.uuid asc
        """
    )
    fun findFeedbackedInstructionsReviewedAfter(submitterUuid: UUID, after: LocalDateTime): List<Instruction>
}
