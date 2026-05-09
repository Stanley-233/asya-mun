package top.bearingwall.asya.audit

import java.util.UUID

data class AuditActor(
    val uuid: UUID? = null,
    val name: String? = null,
    val ip: String? = null,
    val requestMethod: String? = null,
    val requestPath: String? = null,
    val requestQuery: String? = null,
    val userAgent: String? = null
)

object AuditContextHolder {
    private val actorContext: ThreadLocal<AuditActor?> = ThreadLocal()

    fun set(actor: AuditActor?) {
        actorContext.set(actor)
    }

    fun get(): AuditActor? = actorContext.get()

    fun clear() {
        actorContext.remove()
    }
}
