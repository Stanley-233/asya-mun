package top.bearingwall.asya.repository

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor
import top.bearingwall.asya.model.DelegateAttrRecord
import java.util.UUID

interface DelegateAttrRecordRepository : JpaRepository<DelegateAttrRecord, UUID>, JpaSpecificationExecutor<DelegateAttrRecord> {
    fun findAllByDelegateUuidAndConferenceUuid(delegateUuid: UUID, conferenceUuid: UUID, pageable: Pageable): Page<DelegateAttrRecord>

    fun findByIdAndDelegateUuidAndConferenceUuid(id: UUID, delegateUuid: UUID, conferenceUuid: UUID): DelegateAttrRecord?
}
