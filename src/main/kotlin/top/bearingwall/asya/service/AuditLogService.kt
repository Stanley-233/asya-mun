package top.bearingwall.asya.service

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.model.AuditActionType
import top.bearingwall.asya.model.AuditLog
import top.bearingwall.asya.repository.AuditLogRepository
import java.time.LocalDateTime
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
        actionType: AuditActionType,
        eventContent: String,
        success: Boolean
    ) {
        runCatching { persist(actorUuid, actorName, actorIp, actionType, eventContent, success) }
            .recoverCatching { ex ->
                val fallbackType = actionType.fallbackType() ?: throw ex
                val fallbackContent = "[fallbackFrom=$actionType] $eventContent"
                log.warn(
                    "Audit log type {} rejected by database constraint, retrying with fallback type {}",
                    actionType,
                    fallbackType
                )
                persist(actorUuid, actorName, actorIp, fallbackType, fallbackContent, success)
            }
            .onFailure {
                log.error("Failed to persist audit log, type={}, actorName={}, actorIp={}", actionType, actorName, actorIp, it)
            }
    }

    private fun persist(
        actorUuid: UUID?,
        actorName: String?,
        actorIp: String?,
        actionType: AuditActionType,
        eventContent: String,
        success: Boolean
    ) {
        auditLogRepository.saveAndFlush(
            AuditLog(
                eventTime = LocalDateTime.now(),
                actorUuid = actorUuid,
                actorName = actorName,
                actorIp = actorIp,
                actionType = actionType,
                eventContent = eventContent,
                success = success
            )
        )
    }

    private fun AuditActionType.fallbackType(): AuditActionType? {
        return when (this) {
            AuditActionType.INSTRUCTION_CREATE -> AuditActionType.MESSAGE_CREATE
            AuditActionType.INSTRUCTION_REVIEW -> AuditActionType.MESSAGE_UPDATE
            else -> null
        }
    }
}
