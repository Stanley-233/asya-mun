package top.bearingwall.asya.repository

import org.springframework.data.jpa.repository.JpaRepository
import top.bearingwall.asya.model.DelegateAttrConfig
import java.util.UUID

interface DelegateAttrConfigRepository : JpaRepository<DelegateAttrConfig, UUID> {
    fun findAllByConferenceUuidOrderBySortOrderAscIdAsc(conferenceUuid: UUID): List<DelegateAttrConfig>

    fun findAllByConferenceUuidAndEnabledTrueOrderBySortOrderAscIdAsc(conferenceUuid: UUID): List<DelegateAttrConfig>

    fun existsByConferenceUuidAndAttrKey(conferenceUuid: UUID, attrKey: String): Boolean
}
