package top.bearingwall.asya.http

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import top.bearingwall.asya.dto.UserRegistrationRequest
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.support.PostgresIntegrationTest

class UserConferenceHttpTest : PostgresIntegrationTest() {

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
