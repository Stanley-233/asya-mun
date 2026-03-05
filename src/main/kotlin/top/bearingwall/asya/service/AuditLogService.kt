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
        actionType: AuditActionType,
        eventContent: String,
        success: Boolean
    ) {
        runCatching {
            auditLogRepository.save(
                AuditLog(
                    eventTime = LocalDateTime.now(),
                    actorUuid = actorUuid,
                    actorName = actorName,
                    actionType = actionType,
                    eventContent = eventContent,
                    success = success
                )
            )
        }.onFailure {
            log.error("Failed to persist audit log, type={}, actorName={}", actionType, actorName, it)
        }
    }
}

