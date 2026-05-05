package top.bearingwall.asya.service

import jakarta.persistence.criteria.JoinType
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.domain.Specification
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.audit.Auditable
import top.bearingwall.asya.dto.DelegateAttrConfigCreateRequest
import top.bearingwall.asya.dto.DelegateAttrConfigResponse
import top.bearingwall.asya.dto.DelegateAttrConfigUpdateRequest
import top.bearingwall.asya.dto.DelegateAttrFilterItem
import top.bearingwall.asya.dto.DelegateAttrManageQueryRequest
import top.bearingwall.asya.dto.DelegateAttrRecordPageResponse
import top.bearingwall.asya.dto.DelegateAttrRecordResponse
import top.bearingwall.asya.dto.DelegateAttrRecordUpsertRequest
import top.bearingwall.asya.dto.DelegateAttrTypedValueResponse
import top.bearingwall.asya.model.AuditActionType
import top.bearingwall.asya.model.DelegateAttrConfig
import top.bearingwall.asya.model.DelegateAttrRecord
import top.bearingwall.asya.model.DelegateAttrType
import top.bearingwall.asya.model.DelegateAttrValue
import top.bearingwall.asya.model.User
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.repository.DelegateAttrConfigRepository
import top.bearingwall.asya.repository.DelegateAttrRecordRepository
import top.bearingwall.asya.repository.DelegateAttrValueRepository
import top.bearingwall.asya.repository.UserRepository
import java.time.LocalDateTime
import java.util.UUID

@Service
class DelegateAttrService(
    private val userRepository: UserRepository,
    private val configRepository: DelegateAttrConfigRepository,
    private val recordRepository: DelegateAttrRecordRepository,
    private val valueRepository: DelegateAttrValueRepository
) {
    private val writeRoles = setOf(UserRole.DH, UserRole.DM, UserRole.SYS_ADMIN)

    @Transactional
    @Auditable(type = AuditActionType.DELEGATE_ATTR_CONFIG_CREATE, content = "创建代表属性配置")
    fun createConfig(requesterUuid: UUID, request: DelegateAttrConfigCreateRequest): DelegateAttrConfigResponse {
        val requester = getUser(requesterUuid)
        requireManageRole(requester)

        val conference = requester.conference ?: throw IllegalStateException("User not associated with any conference")
        validateAttrKey(request.attrKey)

        if (configRepository.existsByConferenceUuidAndAttrKey(conference.uuid!!, request.attrKey.trim())) {
            throw IllegalArgumentException("Attribute key already exists in current conference: ${request.attrKey}")
        }

        val now = LocalDateTime.now()
        val saved = configRepository.save(
            DelegateAttrConfig(
                conference = conference,
                attrKey = request.attrKey.trim(),
                attrLabel = request.attrLabel.trim(),
                attrType = request.attrType,
                enabled = request.enabled,
                visible = request.visible,
                sortOrder = request.sortOrder,
                createdAt = now,
                updatedAt = now,
                createdBy = requester.uuid,
                updatedBy = requester.uuid
            )
        )
        return saved.toResponse()
    }

    @Transactional
    @Auditable(type = AuditActionType.DELEGATE_ATTR_CONFIG_UPDATE, content = "更新代表属性配置")
    fun updateConfig(requesterUuid: UUID, configId: UUID, request: DelegateAttrConfigUpdateRequest): DelegateAttrConfigResponse {
        val requester = getUser(requesterUuid)
        requireManageRole(requester)
        val conferenceUuid = requester.conference?.uuid ?: throw IllegalStateException("User not associated with any conference")

        val config = configRepository.findById(configId).orElseThrow {
            IllegalArgumentException("Config not found: $configId")
        }
        ensureSameConference(config.conference.uuid, conferenceUuid)

        request.attrLabel?.let { config.attrLabel = it.trim() }
        request.attrType?.let { config.attrType = it }
        request.sortOrder?.let { config.sortOrder = it }
        request.enabled?.let { config.enabled = it }
        request.visible?.let { config.visible = it }

        config.updatedAt = LocalDateTime.now()
        config.updatedBy = requester.uuid

        return configRepository.save(config).toResponse()
    }

    @Transactional(readOnly = true)
    fun listConfigs(requesterUuid: UUID): List<DelegateAttrConfigResponse> {
        val requester = getUser(requesterUuid)
        val conferenceUuid = requester.conference?.uuid ?: throw IllegalStateException("User not associated with any conference")

        return configRepository.findAllByConferenceUuidOrderBySortOrderAscIdAsc(conferenceUuid).map { it.toResponse() }
    }

    @Transactional(readOnly = true)
    fun listMyRecords(requesterUuid: UUID, pageable: Pageable): DelegateAttrRecordPageResponse {
        val requester = getUser(requesterUuid)
        if (requester.role != UserRole.DELEGATE) {
            throw SecurityException("Only DELEGATE can query own delegate attributes")
        }

        val conferenceUuid = requester.conference?.uuid ?: throw IllegalStateException("User not associated with any conference")
        val configs = configRepository.findAllByConferenceUuidOrderBySortOrderAscIdAsc(conferenceUuid)
        val visibleConfigs = configs.filter { it.visible }
        val recordPage = recordRepository.findAllByDelegateUuidAndConferenceUuid(requester.uuid!!, conferenceUuid, pageable)

        return DelegateAttrRecordPageResponse(
            configs = visibleConfigs.map { it.toResponse() },
            records = mapRecordPage(recordPage, visibleConfigs)
        )
    }

    @Transactional
    @Auditable(type = AuditActionType.DELEGATE_ATTR_RECORD_CREATE, content = "创建代表属性记录")
    fun createRecordForDelegate(
        requesterUuid: UUID,
        delegateId: UUID,
        request: DelegateAttrRecordUpsertRequest
    ): DelegateAttrRecordResponse {
        val requester = getUser(requesterUuid)
        requireManageRole(requester)
        val conference = requester.conference ?: throw IllegalStateException("User not associated with any conference")

        val delegate = getDelegate(delegateId)
        ensureSameConference(delegate.conference?.uuid, conference.uuid)

        val now = LocalDateTime.now()
        val record = DelegateAttrRecord(
            conference = conference,
            delegate = delegate,
            createdAt = now,
            updatedAt = now,
            createdBy = requester.uuid,
            updatedBy = requester.uuid
        )

        upsertRecordValues(record, conference.uuid!!, request)
        val saved = recordRepository.save(record)

        val configs = configRepository.findAllByConferenceUuidOrderBySortOrderAscIdAsc(conference.uuid!!)
        val visibleConfigs = configs.filter { it.visible }
        return mapSingleRecord(saved, visibleConfigs)
    }

    @Transactional
    @Auditable(type = AuditActionType.DELEGATE_ATTR_RECORD_UPDATE, content = "更新代表属性记录")
    fun updateRecordForDelegate(
        requesterUuid: UUID,
        delegateId: UUID,
        recordId: UUID,
        request: DelegateAttrRecordUpsertRequest
    ): DelegateAttrRecordResponse {
        val requester = getUser(requesterUuid)
        requireManageRole(requester)
        val conferenceUuid = requester.conference?.uuid ?: throw IllegalStateException("User not associated with any conference")

        val record = recordRepository.findByIdAndDelegateUuidAndConferenceUuid(recordId, delegateId, conferenceUuid)
            ?: throw IllegalArgumentException("Record not found: $recordId")

        upsertRecordValues(record, conferenceUuid, request)
        record.updatedAt = LocalDateTime.now()
        record.updatedBy = requester.uuid

        val saved = recordRepository.save(record)
        val configs = configRepository.findAllByConferenceUuidOrderBySortOrderAscIdAsc(conferenceUuid)
        val visibleConfigs = configs.filter { it.visible }
        return mapSingleRecord(saved, visibleConfigs)
    }

    @Transactional
    @Auditable(type = AuditActionType.DELEGATE_ATTR_RECORD_DELETE, content = "删除代表属性记录")
    fun deleteRecordForDelegate(requesterUuid: UUID, delegateId: UUID, recordId: UUID) {
        val requester = getUser(requesterUuid)
        requireManageRole(requester)
        val conferenceUuid = requester.conference?.uuid ?: throw IllegalStateException("User not associated with any conference")

        val record = recordRepository.findByIdAndDelegateUuidAndConferenceUuid(recordId, delegateId, conferenceUuid)
            ?: throw IllegalArgumentException("Record not found: $recordId")

        recordRepository.delete(record)
    }

    @Transactional(readOnly = true)
    fun queryForManagement(
        requesterUuid: UUID,
        request: DelegateAttrManageQueryRequest,
        pageable: Pageable
    ): DelegateAttrRecordPageResponse {
        val requester = getUser(requesterUuid)
        requireManageRole(requester)
        val conferenceUuid = requester.conference?.uuid ?: throw IllegalStateException("User not associated with any conference")

        val configs = configRepository.findAllByConferenceUuidOrderBySortOrderAscIdAsc(conferenceUuid)
        val visibleConfigs = configs.filter { it.visible }
        val configByKey = configs.associateBy { it.attrKey }

        val delegateUuids = request.delegateIds?.map { UUID.fromString(it) }?.toSet().orEmpty()
        validateFilters(request.attrFilters.orEmpty(), configByKey)

        var spec = byConference(conferenceUuid)
        if (delegateUuids.isNotEmpty()) {
            spec = spec.and(byDelegateIds(delegateUuids))
        }

        request.attrFilters.orEmpty().forEach { filter ->
            val config = configByKey[filter.attrKey] ?: throw IllegalArgumentException("Unknown attrKey: ${filter.attrKey}")
            spec = spec.and(byAttrFilter(filter, config.attrType))
        }

        val page = recordRepository.findAll(spec, pageable)

        return DelegateAttrRecordPageResponse(
            configs = visibleConfigs.map { it.toResponse() },
            records = mapRecordPage(page, visibleConfigs)
        )
    }

    private fun upsertRecordValues(
        record: DelegateAttrRecord,
        conferenceUuid: UUID,
        request: DelegateAttrRecordUpsertRequest
    ) {
        val enabledConfigs = configRepository.findAllByConferenceUuidAndEnabledTrueOrderBySortOrderAscIdAsc(conferenceUuid)
        val enabledByKey = enabledConfigs.associateBy { it.attrKey }

        val requestByKey = linkedMapOf<String, top.bearingwall.asya.dto.DelegateAttrValueInput>()
        request.values.forEach { item ->
            if (requestByKey.put(item.attrKey, item) != null) {
                throw IllegalArgumentException("Duplicate attrKey in request: ${item.attrKey}")
            }
        }

        requestByKey.forEach { (attrKey, input) ->
            val config = enabledByKey[attrKey] ?: throw IllegalArgumentException("Unknown or disabled attrKey: $attrKey")
            validateInputByType(input.textValue, input.numberValue, config.attrType, attrKey)
        }

        val targetConfigIds = enabledConfigs.mapNotNull { it.id }.toSet()
        val enabledConfigById = enabledConfigs.associateBy { it.id!! }

        val requestedConfigIds = requestByKey.map { (key, _) -> enabledByKey.getValue(key).id!! }.toSet()

        record.attrValues.removeIf { value ->
            val configId = value.attrConfig.id
            configId != null && configId in targetConfigIds && configId !in requestedConfigIds
        }

        val existingByConfigId = record.attrValues.associateBy { it.attrConfig.id!! }.toMutableMap()

        requestByKey.forEach { (attrKey, input) ->
            val config = enabledByKey.getValue(attrKey)
            val configId = config.id!!
            val existing = existingByConfigId[configId]
            if (existing != null) {
                existing.valueText = if (config.attrType == DelegateAttrType.TEXT) input.textValue else null
                existing.valueNumber = if (config.attrType == DelegateAttrType.NUMBER) input.numberValue else null
            } else {
                record.attrValues.add(
                    DelegateAttrValue(
                        record = record,
                        attrConfig = enabledConfigById.getValue(configId),
                        valueText = if (config.attrType == DelegateAttrType.TEXT) input.textValue else null,
                        valueNumber = if (config.attrType == DelegateAttrType.NUMBER) input.numberValue else null
                    )
                )
            }
        }
    }

    private fun mapRecordPage(
        page: Page<DelegateAttrRecord>,
        configs: List<DelegateAttrConfig>
    ): Page<DelegateAttrRecordResponse> {
        if (page.content.isEmpty()) {
            return page.map { emptyRecord ->
                DelegateAttrRecordResponse(
                    recordId = emptyRecord.id.toString(),
                    delegateId = emptyRecord.delegate.uuid.toString(),
                    delegateName = emptyRecord.delegate.name,
                    updatedAt = emptyRecord.updatedAt,
                    values = emptyMap()
                )
            }
        }

        val recordIds = page.content.mapNotNull { it.id }
        val values = valueRepository.findAllByRecord_IdIn(recordIds)
        val valuesByRecordId = values.groupBy { it.record.id!! }

        val delegateIds = page.content.mapNotNull { it.delegate.uuid }.toSet()
        val delegateNames = userRepository.findAllById(delegateIds).associateBy({ it.uuid!! }, { it.name })

        return page.map { record ->
            val baseValues = linkedMapOf<String, DelegateAttrTypedValueResponse?>()
            configs.forEach { cfg -> baseValues[cfg.attrKey] = null }

            valuesByRecordId[record.id!!].orEmpty().forEach { v ->
                val cfg = v.attrConfig
                baseValues[cfg.attrKey] = DelegateAttrTypedValueResponse(
                    attrType = cfg.attrType,
                    textValue = v.valueText,
                    numberValue = v.valueNumber
                )
            }

            DelegateAttrRecordResponse(
                recordId = record.id.toString(),
                delegateId = record.delegate.uuid.toString(),
                delegateName = delegateNames[record.delegate.uuid] ?: record.delegate.name,
                updatedAt = record.updatedAt,
                values = baseValues
            )
        }
    }

    private fun mapSingleRecord(record: DelegateAttrRecord, configs: List<DelegateAttrConfig>): DelegateAttrRecordResponse {
        val recordId = record.id ?: throw IllegalStateException("Record id missing")
        val values = valueRepository.findAllByRecord_IdIn(listOf(recordId))

        val map = linkedMapOf<String, DelegateAttrTypedValueResponse?>()
        configs.forEach { cfg -> map[cfg.attrKey] = null }
        values.forEach { v ->
            map[v.attrConfig.attrKey] = DelegateAttrTypedValueResponse(
                attrType = v.attrConfig.attrType,
                textValue = v.valueText,
                numberValue = v.valueNumber
            )
        }

        return DelegateAttrRecordResponse(
            recordId = recordId.toString(),
            delegateId = record.delegate.uuid.toString(),
            delegateName = record.delegate.name,
            updatedAt = record.updatedAt,
            values = map
        )
    }

    private fun validateFilters(filters: List<DelegateAttrFilterItem>, configByKey: Map<String, DelegateAttrConfig>) {
        filters.forEach { filter ->
            val config = configByKey[filter.attrKey] ?: throw IllegalArgumentException("Unknown attrKey: ${filter.attrKey}")
            validateInputByType(filter.textValue, filter.numberValue, config.attrType, filter.attrKey)
        }
    }

    private fun validateInputByType(textValue: String?, numberValue: java.math.BigDecimal?, type: DelegateAttrType, attrKey: String) {
        when (type) {
            DelegateAttrType.TEXT -> {
                if (textValue == null) {
                    throw IllegalArgumentException("Attr '$attrKey' requires textValue")
                }
                if (numberValue != null) {
                    throw IllegalArgumentException("Attr '$attrKey' is TEXT, numberValue must be null")
                }
            }

            DelegateAttrType.NUMBER -> {
                if (numberValue == null) {
                    throw IllegalArgumentException("Attr '$attrKey' requires numberValue")
                }
                if (textValue != null) {
                    throw IllegalArgumentException("Attr '$attrKey' is NUMBER, textValue must be null")
                }
            }
        }
    }

    private fun byConference(conferenceUuid: UUID): Specification<DelegateAttrRecord> {
        return Specification { root, _, cb ->
            cb.equal(root.get<top.bearingwall.asya.model.Conference>("conference").get<UUID>("uuid"), conferenceUuid)
        }
    }

    private fun byDelegateIds(delegateUuids: Set<UUID>): Specification<DelegateAttrRecord> {
        return Specification { root, _, _ ->
            root.get<User>("delegate").get<UUID>("uuid").`in`(delegateUuids)
        }
    }

    private fun byAttrFilter(filter: DelegateAttrFilterItem, type: DelegateAttrType): Specification<DelegateAttrRecord> {
        return Specification { root, query, cb ->
            query.distinct(true)
            val subquery = query.subquery(Long::class.java)
            val valueRoot = subquery.from(DelegateAttrValue::class.java)
            val configJoin = valueRoot.join<DelegateAttrValue, DelegateAttrConfig>("attrConfig", JoinType.INNER)

            val predicates = mutableListOf<jakarta.persistence.criteria.Predicate>()
            predicates.add(cb.equal(valueRoot.get<DelegateAttrRecord>("record"), root))
            predicates.add(cb.equal(configJoin.get<String>("attrKey"), filter.attrKey))

            when (type) {
                DelegateAttrType.TEXT -> predicates.add(cb.equal(valueRoot.get<String>("valueText"), filter.textValue))
                DelegateAttrType.NUMBER -> predicates.add(cb.equal(valueRoot.get<java.math.BigDecimal>("valueNumber"), filter.numberValue))
            }

            subquery.select(cb.literal(1L)).where(*predicates.toTypedArray())
            cb.exists(subquery)
        }
    }

    private fun validateAttrKey(attrKey: String) {
        val cleaned = attrKey.trim()
        if (cleaned.isEmpty()) {
            throw IllegalArgumentException("attrKey must not be blank")
        }
        val keyRegex = Regex("^[a-zA-Z][a-zA-Z0-9_]{1,79}$")
        if (!keyRegex.matches(cleaned)) {
            throw IllegalArgumentException("attrKey format invalid. expected: ^[a-zA-Z][a-zA-Z0-9_]{1,79}$")
        }
    }

    private fun getUser(uuid: UUID): User {
        return userRepository.findById(uuid).orElseThrow {
            IllegalArgumentException("User not found: $uuid")
        }
    }

    private fun getDelegate(uuid: UUID): User {
        val user = getUser(uuid)
        if (user.role != UserRole.DELEGATE) {
            throw IllegalArgumentException("Target user is not DELEGATE: $uuid")
        }
        return user
    }

    private fun requireManageRole(user: User) {
        if (user.role !in writeRoles) {
            throw SecurityException("Permission denied")
        }
    }

    private fun ensureSameConference(targetConferenceUuid: UUID?, conferenceUuid: UUID?) {
        if (targetConferenceUuid == null || conferenceUuid == null || targetConferenceUuid != conferenceUuid) {
            throw SecurityException("Cross-conference access denied")
        }
    }

    private fun DelegateAttrConfig.toResponse() = DelegateAttrConfigResponse(
        id = this.id.toString(),
        attrKey = this.attrKey,
        attrLabel = this.attrLabel,
        attrType = this.attrType,
        sortOrder = this.sortOrder,
        enabled = this.enabled,
        visible = this.visible
    )
}
