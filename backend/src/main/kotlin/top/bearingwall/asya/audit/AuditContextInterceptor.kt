package top.bearingwall.asya.audit

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor
import top.bearingwall.asya.util.JwtUtil
import java.util.UUID

@Component
class AuditContextInterceptor : HandlerInterceptor {

    // Prefer proxy-forwarded IP, fallback to servlet remote address.
    private fun resolveClientIp(request: HttpServletRequest): String? {
        val xForwardedFor = request.getHeader("X-Forwarded-For")
            ?.split(",")
            ?.firstOrNull()
            ?.trim()
            ?.takeIf { it.isNotBlank() }
        if (xForwardedFor != null) {
            return xForwardedFor
        }

        val realIp = request.getHeader("X-Real-IP")?.trim()?.takeIf { it.isNotBlank() }
        if (realIp != null) {
            return realIp
        }

        return request.remoteAddr?.trim()?.takeIf { it.isNotBlank() }
    }

    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        val clientIp = resolveClientIp(request)
        val requestMethod = request.method?.trim()?.takeIf { it.isNotBlank() }
        val requestPath = request.requestURI?.trim()?.takeIf { it.isNotBlank() }
        val requestQuery = request.queryString?.trim()?.takeIf { it.isNotBlank() }
        val userAgent = request.getHeader("User-Agent")?.trim()?.takeIf { it.isNotBlank() }
        val authHeader = request.getHeader("Authorization")
        if (!authHeader.isNullOrBlank() && authHeader.startsWith("Bearer ")) {
            val token = authHeader.removePrefix("Bearer ").trim()
            try {
                val parsed = JwtUtil.parseToken(token)
                val actorUuid = runCatching { UUID.fromString(parsed.subject) }.getOrNull()
                val actorName = parsed.claims["name"]?.toString()
                AuditContextHolder.set(
                    AuditActor(
                        uuid = actorUuid,
                        name = actorName,
                        ip = clientIp,
                        requestMethod = requestMethod,
                        requestPath = requestPath,
                        requestQuery = requestQuery,
                        userAgent = userAgent
                    )
                )
            } catch (_: Exception) {
                AuditContextHolder.set(
                    AuditActor(
                        ip = clientIp,
                        requestMethod = requestMethod,
                        requestPath = requestPath,
                        requestQuery = requestQuery,
                        userAgent = userAgent
                    )
                )
            }
        } else {
            AuditContextHolder.set(
                AuditActor(
                    ip = clientIp,
                    requestMethod = requestMethod,
                    requestPath = requestPath,
                    requestQuery = requestQuery,
                    userAgent = userAgent
                )
            )
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
