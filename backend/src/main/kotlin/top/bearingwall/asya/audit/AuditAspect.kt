package top.bearingwall.asya.audit

import org.aspectj.lang.ProceedingJoinPoint
import org.aspectj.lang.annotation.Around
import org.aspectj.lang.annotation.Aspect
import org.springframework.stereotype.Component
import org.springframework.web.multipart.MultipartFile
import top.bearingwall.asya.dto.UserRegistrationRequest
import top.bearingwall.asya.model.User
import top.bearingwall.asya.repository.UserRepository
import top.bearingwall.asya.service.AuditLogService
import java.beans.Introspector
import java.time.temporal.Temporal
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
        val signature = joinPoint.signature
        val methodName = signature.name
        val className = signature.declaringType.simpleName
        val requestSummary = linkedMapOf<String, Any?>(
            "className" to className,
            "methodName" to methodName,
            "arguments" to joinPoint.args.mapIndexed { index, value -> mapOf("index" to index, "value" to summarizeValue(value)) }
        )
        val resourceType = resolveResourceType(signature.declaringType.simpleName)
        val resourceId = resolveResourceId(joinPoint.args)
        val baseContent = buildBaseContent(
            content = auditable.content,
            className = className,
            methodName = methodName,
            resourceId = resourceId
        )

        return try {
            val result = joinPoint.proceed()
            auditLogService.save(
                actorUuid = actor.uuid,
                actorName = actor.name,
                actorIp = actor.ip,
                requestMethod = actor.requestMethod,
                requestPath = actor.requestPath,
                requestQuery = actor.requestQuery,
                userAgent = actor.userAgent,
                actionType = auditable.type,
                resourceType = resourceType,
                resourceId = resourceId ?: resolveResourceId(result),
                eventContent = baseContent,
                contextData = writeContextData(
                    requestSummary + mapOf(
                        "result" to summarizeValue(result)
                    )
                ),
                success = true
            )
            result
        } catch (ex: Exception) {
            auditLogService.save(
                actorUuid = actor.uuid,
                actorName = actor.name,
                actorIp = actor.ip,
                requestMethod = actor.requestMethod,
                requestPath = actor.requestPath,
                requestQuery = actor.requestQuery,
                userAgent = actor.userAgent,
                actionType = auditable.type,
                resourceType = resourceType,
                resourceId = resourceId,
                eventContent = "$baseContent [error=${ex.message?.take(200)}]",
                contextData = writeContextData(
                    requestSummary + mapOf(
                        "errorType" to ex.javaClass.simpleName,
                        "errorMessage" to ex.message?.take(500)
                    )
                ),
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
        if (registrationArg != null) {
            val userByName = userRepository.findByName(registrationArg.name)
            if (userByName?.uuid != null && resolvedUuid == null) {
                resolvedUuid = userByName.uuid
            }
            if (!userByName?.name.isNullOrBlank() && resolvedName == null) {
                resolvedName = userByName?.name
            }
            if (resolvedName == null) {
                resolvedName = registrationArg.name
            }
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
            ip = resolvedIp,
            requestMethod = fromContext?.requestMethod,
            requestPath = fromContext?.requestPath,
            requestQuery = fromContext?.requestQuery,
            userAgent = fromContext?.userAgent
        )
    }

    private fun buildBaseContent(
        content: String,
        className: String,
        methodName: String,
        resourceId: String?
    ): String {
        val resourceSegment = resourceId?.let { " resourceId=$it" }.orEmpty()
        return "$content [method=$className.$methodName$resourceSegment]"
    }

    private fun resolveResourceType(className: String): String {
        return className.removeSuffix("Service").removeSuffix("Controller")
    }

    private fun resolveResourceId(source: Any?): String? {
        return when (source) {
            null -> null
            is UUID -> source.toString()
            is Number -> source.toString()
            is String -> source.takeIf { UUID_PATTERN.matches(it) || NUMERIC_PATTERN.matches(it) }
            is Array<*> -> source.firstNotNullOfOrNull { resolveResourceId(it) }
            is Iterable<*> -> source.firstNotNullOfOrNull { resolveResourceId(it) }
            else -> extractProperty(source, "uuid") ?: extractProperty(source, "id")
        }
    }

    private fun summarizeValue(value: Any?, depth: Int = 0): Any? {
        if (value == null) {
            return null
        }
        if (depth >= 2) {
            return truncateText(value.toString(), 200)
        }

        return when (value) {
            is String -> truncateText(value, 500)
            is Number, is Boolean, is Enum<*>, is UUID -> value
            is Temporal -> value.toString()
            is MultipartFile -> mapOf(
                "originalFilename" to value.originalFilename,
                "contentType" to value.contentType,
                "size" to value.size
            )
            is ByteArray -> mapOf("byteLength" to value.size)
            is Array<*> -> value.take(10).map { summarizeValue(it, depth + 1) }
            is Iterable<*> -> value.take(10).map { summarizeValue(it, depth + 1) }
            is Map<*, *> -> value.entries.take(10).associate { (k, v) ->
                truncateText(k.toString(), 80) to summarizeValue(v, depth + 1)
            }
            is User -> mapOf(
                "uuid" to value.uuid?.toString(),
                "name" to value.name,
                "displayName" to value.displayName,
                "role" to value.role.name,
                "conferenceUuid" to value.conference?.uuid?.toString()
            )
            else -> summarizeBean(value, depth)
        }
    }

    private fun summarizeBean(value: Any, depth: Int): Any {
        val beanInfo = runCatching { Introspector.getBeanInfo(value.javaClass, Any::class.java) }.getOrNull()
            ?: return truncateText(value.toString(), 200)

        val visibleProperties = beanInfo.propertyDescriptors
            .asSequence()
            .filter { descriptor ->
                descriptor.readMethod != null &&
                    descriptor.name !in excludedPropertyNames &&
                    !descriptor.name.startsWith("_")
            }
            .take(12)
            .mapNotNull { descriptor ->
                val propertyValue = runCatching { descriptor.readMethod.invoke(value) }.getOrNull() ?: return@mapNotNull null
                descriptor.name to summarizeValue(propertyValue, depth + 1)
            }
            .toMap()

        return if (visibleProperties.isEmpty()) {
            truncateText(value.toString(), 200)
        } else {
            visibleProperties
        }
    }

    private fun extractProperty(source: Any, propertyName: String): String? {
        val beanInfo = runCatching { Introspector.getBeanInfo(source.javaClass, Any::class.java) }.getOrNull() ?: return null
        val descriptor = beanInfo.propertyDescriptors.firstOrNull { it.name == propertyName && it.readMethod != null } ?: return null
        val value = runCatching { descriptor.readMethod.invoke(source) }.getOrNull() ?: return null
        return when (value) {
            is UUID -> value.toString()
            is Number -> value.toString()
            is String -> truncateText(value, 120)
            else -> null
        }
    }

    private fun writeContextData(context: Map<String, Any?>): String {
        return serializeJson(context)
    }

    private fun truncateText(value: String, maxLength: Int): String {
        return if (value.length <= maxLength) value else value.take(maxLength) + "..."
    }

    private fun serializeJson(value: Any?): String {
        return when (value) {
            null -> "null"
            is String -> "\"${escapeJson(value)}\""
            is Number, is Boolean -> value.toString()
            is Map<*, *> -> value.entries.joinToString(prefix = "{", postfix = "}") { (key, nestedValue) ->
                "\"${escapeJson(key.toString())}\":${serializeJson(nestedValue)}"
            }
            is Iterable<*> -> value.joinToString(prefix = "[", postfix = "]") { serializeJson(it) }
            is Array<*> -> value.joinToString(prefix = "[", postfix = "]") { serializeJson(it) }
            else -> "\"${escapeJson(value.toString())}\""
        }
    }

    private fun escapeJson(value: String): String {
        return buildString(value.length + 16) {
            value.forEach { ch ->
                when (ch) {
                    '\\' -> append("\\\\")
                    '"' -> append("\\\"")
                    '\n' -> append("\\n")
                    '\r' -> append("\\r")
                    '\t' -> append("\\t")
                    else -> append(ch)
                }
            }
        }
    }

    companion object {
        private val UUID_PATTERN = Regex("^[0-9a-fA-F-]{32,36}$")
        private val NUMERIC_PATTERN = Regex("^\\d+$")
        private val excludedPropertyNames = setOf(
            "class",
            "password",
            "fileBlob",
            "bytes",
            "inputStream",
            "resource",
            "headers",
            "authorization"
        )
    }
}
