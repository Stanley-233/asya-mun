package top.bearingwall.asya.service

import org.slf4j.LoggerFactory
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.domain.Specification
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.dto.AuditLogResponse
import top.bearingwall.asya.model.AuditActionType
import top.bearingwall.asya.model.AuditLog
import top.bearingwall.asya.repository.AuditLogRepository
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.UUID

@Service
class AuditLogService(
    private val auditLogRepository: AuditLogRepository
) {
    private val log = LoggerFactory.getLogger(AuditLogService::class.java)

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun save(
        actorUuid: UUID?,
        actorName: String?,
        actorIp: String?,
        requestMethod: String? = null,
        requestPath: String? = null,
        requestQuery: String? = null,
        userAgent: String? = null,
        actionType: AuditActionType,
        resourceType: String? = null,
        resourceId: String? = null,
        eventContent: String,
        contextData: String? = null,
        success: Boolean
    ) {
        runCatching {
            persist(
                actorUuid = actorUuid,
                actorName = actorName,
                actorIp = actorIp,
                requestMethod = requestMethod,
                requestPath = requestPath,
                requestQuery = requestQuery,
                userAgent = userAgent,
                actionType = actionType,
                resourceType = resourceType,
                resourceId = resourceId,
                eventContent = eventContent,
                contextData = contextData,
                success = success
            )
        }
            .recoverCatching { ex ->
                val fallbackType = actionType.fallbackType() ?: throw ex
                val fallbackContent = "[fallbackFrom=$actionType] $eventContent"
                log.warn(
                    "Audit log type {} rejected by database constraint, retrying with fallback type {}",
                    actionType,
                    fallbackType
                )
                persist(
                    actorUuid = actorUuid,
                    actorName = actorName,
                    actorIp = actorIp,
                    requestMethod = requestMethod,
                    requestPath = requestPath,
                    requestQuery = requestQuery,
                    userAgent = userAgent,
                    actionType = fallbackType,
                    resourceType = resourceType,
                    resourceId = resourceId,
                    eventContent = fallbackContent,
                    contextData = contextData,
                    success = success
                )
            }
            .onFailure {
                log.error("Failed to persist audit log, type={}, actorName={}, actorIp={}", actionType, actorName, actorIp, it)
            }
    }

    @Transactional(readOnly = true)
    fun getAuditLogs(
        pageable: Pageable,
        actorName: String?,
        actionType: AuditActionType?,
        success: Boolean?,
        ip: String?,
        eventTimeFrom: LocalDateTime?,
        eventTimeTo: LocalDateTime?
    ): Page<AuditLogResponse> {
        val specification = Specification<AuditLog> { root, _, cb ->
            val predicates = mutableListOf<jakarta.persistence.criteria.Predicate>()

            actorName?.trim()?.takeIf { it.isNotEmpty() }?.let { keyword ->
                predicates += cb.like(cb.lower(root.get("actorName")), "%${keyword.lowercase()}%")
            }
            actionType?.let {
                predicates += cb.equal(root.get<AuditActionType>("actionType"), it)
            }
            success?.let {
                predicates += cb.equal(root.get<Boolean>("success"), it)
            }
            ip?.trim()?.takeIf { it.isNotEmpty() }?.let { keyword ->
                predicates += cb.like(root.get("actorIp"), "%${keyword}%")
            }
            eventTimeFrom?.let {
                predicates += cb.greaterThanOrEqualTo(root.get("eventTime"), it)
            }
            eventTimeTo?.let {
                predicates += cb.lessThanOrEqualTo(root.get("eventTime"), it)
            }

            cb.and(*predicates.toTypedArray())
        }

        return auditLogRepository.findAll(specification, pageable).map { it.toResponse() }
    }

    @Transactional(readOnly = true)
    fun getAuditLogById(id: Long): AuditLogResponse {
        val entity = auditLogRepository.findById(id)
            .orElseThrow { NoSuchElementException("审计日志不存在: id=$id") }
        return entity.toResponse()
    }

    private fun persist(
        actorUuid: UUID?,
        actorName: String?,
        actorIp: String?,
        requestMethod: String?,
        requestPath: String?,
        requestQuery: String?,
        userAgent: String?,
        actionType: AuditActionType,
        resourceType: String?,
        resourceId: String?,
        eventContent: String,
        contextData: String?,
        success: Boolean
    ) {
        auditLogRepository.saveAndFlush(
            AuditLog(
                eventTime = LocalDateTime.now(ZoneOffset.UTC),
                actorUuid = actorUuid,
                actorName = actorName,
                actorIp = actorIp,
                requestMethod = requestMethod,
                requestPath = requestPath,
                requestQuery = requestQuery,
                userAgent = userAgent,
                actionType = actionType,
                resourceType = resourceType,
                resourceId = resourceId,
                eventContent = eventContent,
                contextData = contextData,
                success = success
            )
        )
    }

    private fun AuditActionType.fallbackType(): AuditActionType? {
        return when (this) {
            AuditActionType.INSTRUCTION_CREATE -> AuditActionType.MESSAGE_CREATE
            AuditActionType.INSTRUCTION_REVIEW -> AuditActionType.MESSAGE_UPDATE
            AuditActionType.ROUND_PUBLISH -> AuditActionType.TIMELINE_UPDATE
            AuditActionType.ROUND_PAUSE -> AuditActionType.TIMELINE_UPDATE
            AuditActionType.ROUND_RESUME -> AuditActionType.TIMELINE_UPDATE
            AuditActionType.ROUND_SET_NEXT -> AuditActionType.TIMELINE_UPDATE
            AuditActionType.ROUND_UPDATE -> AuditActionType.TIMELINE_UPDATE
            AuditActionType.ROUND_SET_CURRENT -> AuditActionType.TIMELINE_JUMP
            AuditActionType.ROUND_AUTO_ADVANCE -> AuditActionType.TIMELINE_JUMP
            else -> null
        }
    }

    private fun AuditLog.toResponse(): AuditLogResponse {
        return AuditLogResponse(
            id = id ?: 0L,
            eventTime = eventTime,
            actorUuid = actorUuid?.toString(),
            actorName = actorName,
            actorIp = actorIp,
            requestMethod = requestMethod,
            requestPath = requestPath,
            requestQuery = requestQuery,
            userAgent = userAgent,
            actionType = actionType,
            resourceType = resourceType,
            resourceId = resourceId,
            eventContent = eventContent,
            contextData = contextData,
            success = success
        )
    }
}
