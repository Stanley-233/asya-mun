package top.bearingwall.asya.audit

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor
import top.bearingwall.asya.util.JwtUtil
import java.util.UUID

@Component
class AuditContextInterceptor : HandlerInterceptor {

    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        val authHeader = request.getHeader("Authorization")
        if (!authHeader.isNullOrBlank() && authHeader.startsWith("Bearer ")) {
            val token = authHeader.removePrefix("Bearer ").trim()
            try {
                val parsed = JwtUtil.parseToken(token)
                val actorUuid = runCatching { UUID.fromString(parsed.subject) }.getOrNull()
                val actorName = parsed.claims["name"]?.toString()
                AuditContextHolder.set(AuditActor(uuid = actorUuid, name = actorName))
            } catch (_: Exception) {
                AuditContextHolder.clear()
            }
        } else {
            AuditContextHolder.clear()
        }
        return true
    }

    override fun afterCompletion(
        request: HttpServletRequest,
        response: HttpServletResponse,
        handler: Any,
        ex: Exception?
    ) {
        AuditContextHolder.clear()
    }
}

