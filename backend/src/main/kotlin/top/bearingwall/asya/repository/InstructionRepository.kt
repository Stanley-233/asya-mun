package top.bearingwall.asya.repository

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor
import top.bearingwall.asya.model.Instruction
import java.util.UUID

interface InstructionRepository : JpaRepository<Instruction, UUID>, JpaSpecificationExecutor<Instruction> {
    fun findAllBySubmitterUuid(submitterUuid: UUID, pageable: Pageable): Page<Instruction>
}
