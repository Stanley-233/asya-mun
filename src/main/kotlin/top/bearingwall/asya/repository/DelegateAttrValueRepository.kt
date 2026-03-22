package top.bearingwall.asya.repository

import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import top.bearingwall.asya.model.DelegateAttrValue
import java.util.UUID

interface DelegateAttrValueRepository : JpaRepository<DelegateAttrValue, UUID> {
    @EntityGraph(attributePaths = ["attrConfig", "record"])
    fun findAllByRecord_IdIn(recordIds: Collection<UUID>): List<DelegateAttrValue>
}
