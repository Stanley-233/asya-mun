package top.bearingwall.asya.audit

import top.bearingwall.asya.model.AuditActionType

@Target(AnnotationTarget.FUNCTION)
@Retention(AnnotationRetention.RUNTIME)
annotation class Auditable(
    val type: AuditActionType,
    val content: String
)

