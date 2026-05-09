package top.bearingwall.asya.http

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.support.PostgresIntegrationTest

class RoundAnnouncementHttpTest : PostgresIntegrationTest() {

    @Test
    fun `dm can publish and pause round through http`() {
        val conference = saveConference()
        val dm = saveUser("round-dm", UserRole.DM, conference)

        val publishResponse = postJson(
            "/api/round",
            mapOf(
                "name" to "Round 1",
                "durationSeconds" to 120,
                "initialStatus" to "RUNNING",
                "nextRoundId" to null
            ),
            bearerHeadersFor(dm)
        )

        assertEquals(HttpStatus.CREATED.value(), publishResponse.statusCode())
        val round = readJson(publishResponse.body())["data"]
        assertEquals("Round 1", round["name"].asText())
        assertEquals("RUNNING", round["status"].asText())
        assertEquals(true, round["current"].asBoolean())

        val roundId = round["roundId"].asText()
        val pauseResponse = postEmpty(
            "/api/round/$roundId/pause",
            bearerHeadersFor(dm)
        )

        assertEquals(HttpStatus.OK.value(), pauseResponse.statusCode())
        assertEquals("PAUSED", readJson(pauseResponse.body())["data"]["status"].asText())
    }

    @Test
    fun `bootstraped manager can upload and fetch announcement image through http`() {
        val admin = saveUser("bootstrap-admin", UserRole.SYS_ADMIN)
        val bootstrap = bootstrapScenario(admin)
        val managerToken = bootstrap["users"].first { it["role"].asText() == "DM" }["token"].asText()

        val uploadResponse = putMultipart(
            "/api/announcement/image",
            fieldName = "file",
            fileName = "announcement.png",
            contentType = "image/png",
            bytes = "fake-png".toByteArray(),
            headers = org.springframework.http.HttpHeaders().apply { setBearerAuth(managerToken) }
        )

        assertEquals(HttpStatus.OK.value(), uploadResponse.statusCode())
        val uploadBody = readJson(uploadResponse.body())
        assertEquals(200, uploadBody["code"].asInt(), uploadBody.toPrettyString())
        assertTrue(!uploadBody["data"].isNull, uploadBody.toPrettyString())
        assertEquals("announcement", uploadBody["data"]["fileName"].asText())
        assertEquals("png", uploadBody["data"]["fileType"].asText())

        val infoResponse = get(
            "/api/announcement/image",
            org.springframework.http.HttpHeaders().apply { setBearerAuth(managerToken) }
        )

        assertEquals(HttpStatus.OK.value(), infoResponse.statusCode())
        val infoBody = readJson(infoResponse.body())
        assertEquals("announcement", infoBody["data"]["fileName"].asText())

        val downloadResponse = get(
            "/api/announcement/image/download",
            org.springframework.http.HttpHeaders().apply { setBearerAuth(managerToken) }
        )

        assertEquals(HttpStatus.OK.value(), downloadResponse.statusCode())
        assertTrue(downloadResponse.body().contains("fake-png"))
    }
}
