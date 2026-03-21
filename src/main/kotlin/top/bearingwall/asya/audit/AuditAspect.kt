package top.bearingwall.asya.audit

import org.aspectj.lang.ProceedingJoinPoint
import org.aspectj.lang.annotation.Around
import org.aspectj.lang.annotation.Aspect
import org.springframework.stereotype.Component
import top.bearingwall.asya.dto.UserRegistrationRequest
import top.bearingwall.asya.model.User
import top.bearingwall.asya.repository.UserRepository
import top.bearingwall.asya.service.AuditLogService
import java.util.UUID

@Aspect
@Component
class AuditAspect(
    private val auditLogService: AuditLogService,
    private val userRepository: UserRepository
) {

    @Around("@annotation(auditable)")
    fun around(joinPoint: ProceedingJoinPoint, auditable: Auditable): Any? {
        val actor = resolveActor(joinPoint.args)
        val methodName = joinPoint.signature.name
        val baseContent = "${auditable.content} [method=$methodName]"

        return try {
            val result = joinPoint.proceed()
            auditLogService.save(
                actorUuid = actor.uuid,
                actorName = actor.name,
                actorIp = actor.ip,
                actionType = auditable.type,
                eventContent = baseContent,
                success = true
            )
            result
        } catch (ex: Exception) {
            auditLogService.save(
                actorUuid = actor.uuid,
                actorName = actor.name,
                actorIp = actor.ip,
                actionType = auditable.type,
                eventContent = "$baseContent [error=${ex.message?.take(200)}]",
                success = false
            )
            throw ex
        }
    }

    private fun resolveActor(args: Array<Any?>): AuditActor {
        val fromContext = AuditContextHolder.get()
        var resolvedUuid = fromContext?.uuid
        var resolvedName = fromContext?.name?.takeIf { it.isNotBlank() }
        val resolvedIp = fromContext?.ip

        val userArg = args.filterIsInstance<User>().firstOrNull()
        if (userArg != null && resolvedName == null) {
            resolvedName = userArg.name
        }
        if (userArg?.uuid != null && resolvedUuid == null) {
            resolvedUuid = userArg.uuid
        }

        val registrationArg = args.filterIsInstance<UserRegistrationRequest>().firstOrNull()
        if (registrationArg != null && resolvedName == null) {
            resolvedName = registrationArg.name
        }

        val uuidArg = args.filterIsInstance<UUID>().firstOrNull()
        if (uuidArg != null && resolvedUuid == null) {
            resolvedUuid = uuidArg
        }
        if (uuidArg != null && resolvedName == null) {
            resolvedName = userRepository.findById(uuidArg).orElse(null)?.name
        }

        return AuditActor(
            uuid = resolvedUuid,
            name = resolvedName ?: "anonymous",
            ip = resolvedIp
        )
    }
}
