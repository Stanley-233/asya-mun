package top.bearingwall.asya.http

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import top.bearingwall.asya.dto.UserRegistrationRequest
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.support.PostgresIntegrationTest
import java.util.UUID

class UserConferenceHttpTest : PostgresIntegrationTest() {
    companion object {
        private const val REFRESH_COOKIE_NAME = "asya_refresh_token"
    }

    @Test
    fun `register login and current user work through http`() {
        putConfig("REGISTRATION_ALLOWED", "true", "integration switch")

        val registerResponse = postJson(
            "/api/users/register",
            UserRegistrationRequest(
                name = "http-user",
                displayName = "HTTP User",
                password = "secret123",
                role = UserRole.DELEGATE
            )
        )

        assertEquals(HttpStatus.CREATED.value(), registerResponse.statusCode())
        val registerBody = readJson(registerResponse.body())
        assertEquals(200, registerBody["code"].asInt())
        val token = registerBody["data"]["token"].asText()
        val refreshCookie = extractCookie(registerResponse, REFRESH_COOKIE_NAME)
        assertNotNull(refreshCookie)

        val currentUserResponse = get(
            "/api/users/user",
            org.springframework.http.HttpHeaders().apply { setBearerAuth(token) }
        )

        assertEquals(HttpStatus.OK.value(), currentUserResponse.statusCode())
        val currentUserBody = readJson(currentUserResponse.body())
        assertEquals("http-user", currentUserBody["data"]["name"].asText())
        assertEquals(UserRole.DELEGATE.name, currentUserBody["data"]["role"].asText())
    }

    @Test
    fun `refresh returns new access token and rotates refresh cookie`() {
        putConfig("REGISTRATION_ALLOWED", "true", "integration switch")

        val registerResponse = postJson(
            "/api/users/register",
            UserRegistrationRequest(
                name = "refresh-user",
                displayName = "Refresh User",
                password = "secret123",
                role = UserRole.DELEGATE
            )
        )

        val originalRefreshCookie = extractCookie(registerResponse, REFRESH_COOKIE_NAME)
        val refreshResponse = postEmpty("/api/users/refresh", cookieHeaders(originalRefreshCookie))

        assertEquals(HttpStatus.OK.value(), refreshResponse.statusCode())
        val refreshBody = readJson(refreshResponse.body())
        assertEquals(200, refreshBody["code"].asInt())
        assertNotNull(refreshBody["data"]["token"].asText())

        val rotatedRefreshCookie = extractCookie(refreshResponse, REFRESH_COOKIE_NAME)
        assertNotEquals(originalRefreshCookie, rotatedRefreshCookie)
    }

    @Test
    fun `password reset invalidates prior access token and refresh cookie`() {
        putConfig("REGISTRATION_ALLOWED", "true", "integration switch")

        val admin = saveUser("sys-admin", UserRole.SYS_ADMIN)
        val registerResponse = postJson(
            "/api/users/register",
            UserRegistrationRequest(
                name = "delegate-user",
                displayName = "Delegate User",
                password = "password",
                role = UserRole.DELEGATE
            )
        )

        assertEquals(HttpStatus.CREATED.value(), registerResponse.statusCode())
        val registerBody = readJson(registerResponse.body())
        val accessToken = registerBody["data"]["token"].asText()
        val refreshCookie = extractCookie(registerResponse, REFRESH_COOKIE_NAME)
        val delegateUuid = UUID.fromString(registerBody["data"]["uuid"].asText())

        val resetResponse = postJson(
            "/api/users/$delegateUuid/password-reset",
            mapOf("password" to "new-password"),
            bearerHeadersFor(admin)
        )

        assertEquals(HttpStatus.OK.value(), resetResponse.statusCode())

        val staleAccessResponse = get(
            "/api/users/user",
            org.springframework.http.HttpHeaders().apply { setBearerAuth(accessToken) }
        )
        val staleAccessBody = readJson(staleAccessResponse.body())
        assertEquals(4003, staleAccessBody["code"].asInt())

        val staleRefreshResponse = postEmpty("/api/users/refresh", cookieHeaders(refreshCookie))
        val staleRefreshBody = readJson(staleRefreshResponse.body())
        assertEquals(HttpStatus.UNAUTHORIZED.value(), staleRefreshResponse.statusCode())
        assertEquals(4003, staleRefreshBody["code"].asInt())
    }

    @Test
    fun `logout clears refresh cookie and prevents further refresh`() {
        putConfig("REGISTRATION_ALLOWED", "true", "integration switch")

        val registerResponse = postJson(
            "/api/users/register",
            UserRegistrationRequest(
                name = "logout-user",
                displayName = "Logout User",
                password = "secret123",
                role = UserRole.DELEGATE
            )
        )

        val refreshCookie = extractCookie(registerResponse, REFRESH_COOKIE_NAME)
        val logoutResponse = postEmpty("/api/users/logout", cookieHeaders(refreshCookie))

        assertEquals(HttpStatus.OK.value(), logoutResponse.statusCode())
        val clearedCookie = extractCookie(logoutResponse, REFRESH_COOKIE_NAME)
        assertEquals("$REFRESH_COOKIE_NAME=", clearedCookie)

        val refreshAfterLogout = postEmpty("/api/users/refresh", cookieHeaders(clearedCookie))
        val refreshAfterLogoutBody = readJson(refreshAfterLogout.body())
        assertEquals(HttpStatus.UNAUTHORIZED.value(), refreshAfterLogout.statusCode())
        assertEquals(4003, refreshAfterLogoutBody["code"].asInt())
    }

    @Test
    fun `login returns user not found instead of 500 when system has no users`() {
        val loginResponse = postJson(
            "/api/users/login",
            UserRegistrationRequest(
                name = "missing-user",
                password = "secret123",
                role = UserRole.DM
            )
        )

        assertEquals(HttpStatus.OK.value(), loginResponse.statusCode())
        val loginBody = readJson(loginResponse.body())
        assertEquals(4004, loginBody["code"].asInt())
        assertEquals("系统中还没有该用户，请先完成注册", loginBody["message"].asText())
    }

    @Test
    fun `registration switch stays open during bootstrap even if config is disabled`() {
        putConfig("REGISTRATION_ALLOWED", "false", "integration switch")

        val switchResponse = get("/api/users/registration-switch")

        assertEquals(HttpStatus.OK.value(), switchResponse.statusCode())
        val switchBody = readJson(switchResponse.body())
        assertEquals(200, switchBody["code"].asInt())
        assertEquals(true, switchBody["data"].asBoolean())
    }

    @Test
    fun `registration returns business failure instead of 500 when switch is disabled after bootstrap`() {
        putConfig("REGISTRATION_ALLOWED", "false", "integration switch")
        saveUser("sys-admin", UserRole.SYS_ADMIN)

        val registerResponse = postJson(
            "/api/users/register",
            UserRegistrationRequest(
                name = "late-user",
                displayName = "Late User",
                password = "secret123",
                role = UserRole.DELEGATE
            )
        )

        assertEquals(HttpStatus.OK.value(), registerResponse.statusCode())
        val registerBody = readJson(registerResponse.body())
        assertEquals(4001, registerBody["code"].asInt())
        assertEquals("系统当前禁止新用户注册", registerBody["message"].asText())
    }

    @Test
    fun `admin can assign user to conference and list filtered users over http`() {
        val admin = saveUser("sys-admin", UserRole.SYS_ADMIN)
        val conference = saveConference(name = "Assigned Conference")
        val delegate = saveUser("assign-target", UserRole.DELEGATE)

        val assignResponse = postJson(
            "/api/conference/assign",
            mapOf(
                "conferenceUuid" to conference.uuid.toString(),
                "userUuid" to delegate.uuid.toString()
            ),
            bearerHeadersFor(admin)
        )

        assertEquals(HttpStatus.OK.value(), assignResponse.statusCode())
        val assignBody = readJson(assignResponse.body())
        assertEquals(conference.uuid.toString(), assignBody["data"]["conferenceUuid"].asText())

        val listResponse = get(
            "/api/users?conferenceUuid=${conference.uuid}&role=DELEGATE&current=1",
            bearerHeadersFor(admin)
        )

        assertEquals(HttpStatus.OK.value(), listResponse.statusCode())
        val content = readJson(listResponse.body())["data"]["content"]
        assertEquals(1, content.size())
        assertEquals("assign-target", content[0]["name"].asText())
        assertEquals("Assigned Conference", content[0]["conferenceName"].asText())
    }

    @Test
    fun `dh can update current conference through http`() {
        val conference = saveConference(name = "Old Name", description = "Old Desc")
        val dh = saveUser("dh-user", UserRole.DH, conference)

        val updateResponse = putJson(
            "/api/conference",
            mapOf(
                "name" to "New Name",
                "description" to "New Desc",
                "status" to "COMPLETED"
            ),
            bearerHeadersFor(dh)
        )

        assertEquals(HttpStatus.OK.value(), updateResponse.statusCode())
        val updateBody = readJson(updateResponse.body())
        assertEquals("New Name", updateBody["data"]["name"].asText())
        assertEquals("COMPLETED", updateBody["data"]["status"].asText())

        val mineResponse = get(
            "/api/conference",
            bearerHeadersFor(dh)
        )

        val mineBody = readJson(mineResponse.body())
        assertEquals("New Name", mineBody["data"]["name"].asText())
        assertNotNull(mineBody["data"]["uuid"].asText())
    }
}
