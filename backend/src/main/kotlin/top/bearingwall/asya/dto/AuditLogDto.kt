package top.bearingwall.asya.dto

import top.bearingwall.asya.model.AuditActionType
import java.time.LocalDateTime

data class AuditLogResponse(
    val id: Long,
    val eventTime: LocalDateTime,
    val actorUuid: String?,
    val actorName: String?,
    val actorIp: String?,
    val requestMethod: String?,
    val requestPath: String?,
    val requestQuery: String?,
    val userAgent: String?,
    val actionType: AuditActionType,
    val resourceType: String?,
    val resourceId: String?,
    val eventContent: String,
    val contextData: String?,
    val success: Boolean
)
