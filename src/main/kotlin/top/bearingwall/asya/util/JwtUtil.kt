package top.bearingwall.asya.util

import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import io.jsonwebtoken.security.WeakKeyException
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.util.Date
import javax.crypto.SecretKey

object JwtUtil {
    private const val DEFAULT_SECRET = "asya-backend-jwt-secret-key-change-me-to-at-least-32-chars"
    private const val MIN_KEY_BYTES = 32
    private const val EXPIRATION_SECONDS = 3600L

    private val key: SecretKey by lazy { buildKey() }

    private fun buildKey(): SecretKey {
        val configured = System.getenv("JWT_SECRET")
            ?: System.getProperty("jwt.secret")
            ?: DEFAULT_SECRET
        val keyBytes = configured.toByteArray(StandardCharsets.UTF_8)
        require(keyBytes.size >= MIN_KEY_BYTES) {
            "JWT secret must be at least $MIN_KEY_BYTES bytes; configure JWT_SECRET env or -Djwt.secret"
        }
        return try {
            Keys.hmacShaKeyFor(keyBytes)
        } catch (e: WeakKeyException) {
            throw IllegalStateException("JWT secret too weak: ${e.message}", e)
        }
    }

    fun generateToken(subject: String, claims: Map<String, Any> = emptyMap()): String {
        val now = Instant.now()
        return Jwts.builder()
            .subject(subject)
            .claims(claims)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(EXPIRATION_SECONDS)))
            .signWith(key, Jwts.SIG.HS256)
            .compact()
    }

    // Parse JWT and return subject and claims. Throws if invalid/expired.
    fun parseToken(token: String): ParsedToken {
        val claims = Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .payload
        return ParsedToken(
            subject = claims.subject,
            claims = claims
        )
    }
}

data class ParsedToken(
    val subject: String,
    val claims: io.jsonwebtoken.Claims
)
