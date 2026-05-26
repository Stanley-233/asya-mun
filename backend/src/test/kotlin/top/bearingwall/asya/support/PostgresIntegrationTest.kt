package top.bearingwall.asya.support

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import org.junit.jupiter.api.BeforeEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.JdbcTemplate
import top.bearingwall.asya.dto.Result
import top.bearingwall.asya.model.Conference
import top.bearingwall.asya.model.ConferenceStatus
import top.bearingwall.asya.model.SystemConfig
import top.bearingwall.asya.model.User
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.repository.ConferenceRepository
import top.bearingwall.asya.repository.SystemConfigRepository
import top.bearingwall.asya.repository.UserRepository
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.test.context.ActiveProfiles
import top.bearingwall.asya.util.JwtUtil
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
abstract class PostgresIntegrationTest {

    @Autowired
    lateinit var jdbcTemplate: JdbcTemplate

    @Autowired
    lateinit var conferenceRepository: ConferenceRepository

    @Autowired
    lateinit var userRepository: UserRepository

    @Autowired
    lateinit var systemConfigRepository: SystemConfigRepository

    @LocalServerPort
    var port: Int = 0

    private val httpClient: HttpClient = HttpClient.newHttpClient()
    private val objectMapper: ObjectMapper = jacksonObjectMapper().registerModule(JavaTimeModule())

    @BeforeEach
    fun cleanDatabase() {
        jdbcTemplate.execute(
            """
            TRUNCATE TABLE
                message_receivers,
                user_group_members,
                delegate_attr_values,
                delegate_attr_records,
                delegate_attr_configs,
                attachments,
                instructions,
                messages,
                rounds,
                time_anchors,
                users,
                user_groups,
                system_configs,
                conferences,
                audit_logs
            RESTART IDENTITY CASCADE
            """.trimIndent()
        )
    }

    protected fun saveConference(
        name: String = "Test Conference",
        description: String = "integration",
        status: ConferenceStatus = ConferenceStatus.RUNNING
    ): Conference {
        return conferenceRepository.save(
            Conference(
                name = name,
                description = description,
                status = status
            )
        )
    }

    protected fun saveUser(
        name: String,
        role: UserRole,
        conference: Conference? = null,
        displayName: String = name
    ): User {
        return userRepository.save(
            User(
                name = name,
                displayName = displayName,
                password = "\$2a\$10\$7EqJtq98hPqEX7fNZaFWoOHiO7D6R0ZQ8X7n1HULICwhf66A1VpDa",
                role = role,
                conference = conference
            )
        )
    }

    protected fun bearerHeadersFor(user: User): HttpHeaders {
        val headers = HttpHeaders()
        headers.setBearerAuth(
            JwtUtil.generateAccessToken(
                subject = user.uuid.toString(),
                claims = mapOf("name" to user.name, "role" to user.role.name),
                authVersion = user.authVersion
            )
        )
        return headers
    }

    protected fun cookieHeaders(cookie: String): HttpHeaders {
        val headers = HttpHeaders()
        headers.add(HttpHeaders.COOKIE, cookie)
        return headers
    }

    protected fun extractCookie(response: HttpResponse<String>, cookieName: String): String {
        val setCookie = response.headers().allValues("set-cookie")
            .firstOrNull { it.startsWith("$cookieName=") }
            ?: throw IllegalStateException("Cookie $cookieName not found in response")
        return setCookie.substringBefore(';')
    }

    protected fun putConfig(key: String, value: String, description: String? = null) {
        systemConfigRepository.save(
            SystemConfig(
                key = key,
                value = value,
                description = description
            )
        )
    }

    protected fun get(path: String, headers: HttpHeaders = HttpHeaders()): HttpResponse<String> {
        return send(path, "GET", headers)
    }

    protected fun postJson(path: String, body: Any, headers: HttpHeaders = HttpHeaders()): HttpResponse<String> {
        headers.contentType = org.springframework.http.MediaType.APPLICATION_JSON
        return send(path, "POST", headers, objectMapper.writeValueAsString(body))
    }

    protected fun putJson(path: String, body: Any, headers: HttpHeaders = HttpHeaders()): HttpResponse<String> {
        headers.contentType = org.springframework.http.MediaType.APPLICATION_JSON
        return send(path, "PUT", headers, objectMapper.writeValueAsString(body))
    }

    protected fun postEmpty(path: String, headers: HttpHeaders = HttpHeaders()): HttpResponse<String> {
        return send(path, "POST", headers, "")
    }

    protected fun putMultipart(
        path: String,
        fieldName: String,
        fileName: String,
        contentType: String,
        bytes: ByteArray,
        headers: HttpHeaders = HttpHeaders()
    ): HttpResponse<String> {
        val boundary = "----AsyaBoundary${System.nanoTime()}"
        headers.contentType = org.springframework.http.MediaType.parseMediaType("multipart/form-data; boundary=$boundary")
        val body = buildMultipartBody(boundary, fieldName, fileName, contentType, bytes)
        return sendBytes(path, "PUT", headers, body)
    }

    protected fun readJson(body: String): JsonNode = objectMapper.readTree(body)

    protected fun bootstrapScenario(admin: User): JsonNode {
        val response = postEmpty("/api/test-data/bootstrap", bearerHeadersFor(admin))
        check(response.statusCode() == HttpStatus.CREATED.value()) {
            "bootstrap endpoint returned unexpected status: ${response.statusCode()}"
        }
        val body = readJson(response.body())
        check(body["code"].asInt() == 200) { "bootstrap endpoint failed: ${body["message"].asText()}" }
        return body["data"]
    }

    private fun send(
        path: String,
        method: String,
        headers: HttpHeaders,
        body: String? = null
    ): HttpResponse<String> {
        val builder = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl(path)))
        headers.forEach { name, values -> values.forEach { builder.header(name, it) } }
        when (method) {
            "GET" -> builder.GET()
            "DELETE" -> builder.DELETE()
            "POST" -> builder.POST(HttpRequest.BodyPublishers.ofString(body ?: "", StandardCharsets.UTF_8))
            "PUT" -> builder.PUT(HttpRequest.BodyPublishers.ofString(body ?: "", StandardCharsets.UTF_8))
            else -> error("Unsupported method: $method")
        }
        return httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
    }

    private fun sendBytes(
        path: String,
        method: String,
        headers: HttpHeaders,
        body: ByteArray
    ): HttpResponse<String> {
        val builder = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl(path)))
        headers.forEach { name, values -> values.forEach { builder.header(name, it) } }
        when (method) {
            "POST" -> builder.POST(HttpRequest.BodyPublishers.ofByteArray(body))
            "PUT" -> builder.PUT(HttpRequest.BodyPublishers.ofByteArray(body))
            else -> error("Unsupported byte-body method: $method")
        }
        return httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
    }

    private fun buildMultipartBody(
        boundary: String,
        fieldName: String,
        fileName: String,
        contentType: String,
        bytes: ByteArray
    ): ByteArray {
        val prefix = buildString {
            append("--").append(boundary).append("\r\n")
            append("""Content-Disposition: form-data; name="$fieldName"; filename="$fileName"""").append("\r\n")
            append("Content-Type: ").append(contentType).append("\r\n\r\n")
        }.toByteArray(StandardCharsets.UTF_8)
        val suffix = "\r\n--$boundary--\r\n".toByteArray(StandardCharsets.UTF_8)
        return prefix + bytes + suffix
    }

    private fun baseUrl(path: String): String {
        return "http://localhost:$port$path"
    }
}
