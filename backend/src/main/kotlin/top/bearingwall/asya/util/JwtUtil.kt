package top.bearingwall.asya.util

import io.jsonwebtoken.Jwts
import io.jsonwebtoken.JwtException
import io.jsonwebtoken.security.Keys
import io.jsonwebtoken.security.WeakKeyException
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.util.Date
import java.util.UUID
import javax.crypto.SecretKey

object JwtUtil {
    private const val DEFAULT_SECRET = "asya-backend-jwt-secret-key-change-me-to-at-least-32-chars"
    private const val MIN_KEY_BYTES = 32
    private const val ACCESS_EXPIRATION_SECONDS = 3600L
    private const val REFRESH_EXPIRATION_SECONDS = 30L * 24 * 60 * 60
    private const val CLAIM_TYPE = "type"
    private const val CLAIM_AUTH_VERSION = "ver"

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

    fun generateAccessToken(subject: String, claims: Map<String, Any> = emptyMap(), authVersion: Int): String {
        return generateToken(
            subject = subject,
            claims = claims + mapOf(
                CLAIM_TYPE to TokenType.ACCESS.claimValue,
                CLAIM_AUTH_VERSION to authVersion
            ),
            expirationSeconds = ACCESS_EXPIRATION_SECONDS
        )
    }

    fun generateRefreshToken(subject: String, authVersion: Int): String {
        return generateToken(
            subject = subject,
            claims = mapOf(
                CLAIM_TYPE to TokenType.REFRESH.claimValue,
                CLAIM_AUTH_VERSION to authVersion
            ),
            expirationSeconds = REFRESH_EXPIRATION_SECONDS
        )
    }

    private fun generateToken(subject: String, claims: Map<String, Any>, expirationSeconds: Long): String {
        val now = Instant.now()
        return Jwts.builder()
            .subject(subject)
            .claims(claims)
            .id(UUID.randomUUID().toString())
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(expirationSeconds)))
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

    fun requireTokenType(parsedToken: ParsedToken, expectedType: TokenType) {
        val actualType = parsedToken.claims[CLAIM_TYPE]?.toString()
        if (actualType != expectedType.claimValue) {
            throw JwtException("Token类型无效")
        }
    }

    fun getAuthVersion(parsedToken: ParsedToken): Int {
        val rawVersion = parsedToken.claims[CLAIM_AUTH_VERSION]
            ?: throw JwtException("Token缺少认证版本")
        return when (rawVersion) {
            is Number -> rawVersion.toInt()
            is String -> rawVersion.toIntOrNull() ?: throw JwtException("Token认证版本无效")
            else -> throw JwtException("Token认证版本无效")
        }
    }
}

data class ParsedToken(
    val subject: String,
    val claims: io.jsonwebtoken.Claims
)

enum class TokenType(val claimValue: String) {
    ACCESS("access"),
    REFRESH("refresh")
}
