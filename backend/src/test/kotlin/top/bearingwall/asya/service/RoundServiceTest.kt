package top.bearingwall.asya.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.Mockito.any
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import top.bearingwall.asya.dto.RoundPublishRequest
import top.bearingwall.asya.dto.RoundSetCurrentRequest
import top.bearingwall.asya.dto.RoundSetNextRequest
import top.bearingwall.asya.dto.RoundSetRemainingRequest
import top.bearingwall.asya.dto.RoundUpdateRequest
import top.bearingwall.asya.model.Conference
import top.bearingwall.asya.model.Round
import top.bearingwall.asya.model.RoundStatus
import top.bearingwall.asya.repository.ConferenceRepository
import top.bearingwall.asya.repository.RoundRepository
import java.time.LocalDateTime
import java.util.Optional
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class RoundServiceTest {

    @Mock
    lateinit var roundRepository: RoundRepository

    @Mock
    lateinit var conferenceRepository: ConferenceRepository

    @InjectMocks
    lateinit var roundService: RoundService

    @Test
    fun `publishRound creates current round with running countdown`() {
        val conference = Conference(uuid = UUID.randomUUID(), name = "conf", description = "desc")

        `when`(conferenceRepository.findById(conference.uuid!!)).thenReturn(Optional.of(conference))
        `when`(roundRepository.save(any(Round::class.java))).thenAnswer {
            val round = it.getArgument<Round>(0)
            round.uuid = UUID.randomUUID()
            round
        }

        val response = roundService.publishRound(
            RoundPublishRequest(
                name = "Round 1",
                durationSeconds = 120,
                initialStatus = RoundStatus.RUNNING,
                nextRoundId = null
            ),
            conference.uuid!!
        )

        val captor = ArgumentCaptor.forClass(Round::class.java)
        verify(roundRepository).save(captor.capture())
        verify(roundRepository).updateIsCurrentToFalseByConferenceUuid(conference.uuid!!)

        val saved = captor.value
        assertEquals("Round 1", saved.name)
        assertEquals(120, saved.durationSeconds)
        assertEquals(120, saved.remainingSeconds)
        assertEquals(RoundStatus.RUNNING, saved.status)
        assertTrue(saved.isCurrent)
        assertNotNull(saved.endAt)

        assertEquals(RoundStatus.RUNNING, response.status)
        assertTrue(response.isCurrent)
        assertTrue(response.remainingSeconds in 0..120)
    }

    @Test
    fun `pauseRound pauses current running round and keeps remaining seconds`() {
        val conferenceId = UUID.randomUUID()
        val now = LocalDateTime.now()
        val round = Round(
            uuid = UUID.randomUUID(),
            conference = Conference(uuid = conferenceId, name = "conf", description = "desc"),
            name = "Round 1",
            durationSeconds = 100,
            remainingSeconds = 100,
            status = RoundStatus.RUNNING,
            isCurrent = true,
            endAt = now.plusSeconds(80),
            updatedAt = now
        )

        `when`(roundRepository.findCurrentForUpdate(conferenceId)).thenReturn(round, round)
        `when`(roundRepository.save(any(Round::class.java))).thenAnswer { it.getArgument(0) }

        val response = roundService.pauseRound(round.uuid!!, conferenceId)

        verify(roundRepository, times(2)).findCurrentForUpdate(conferenceId)
        assertEquals(RoundStatus.PAUSED, response.status)
        assertEquals(null, response.endAt)
        assertTrue(response.remainingSeconds in 0..100)
    }

    @Test
    fun `advanceIfExpired switches to next round and resets countdown`() {
        val conferenceId = UUID.randomUUID()
        val now = LocalDateTime.now()

        val nextRound = Round(
            uuid = UUID.randomUUID(),
            conference = Conference(uuid = conferenceId, name = "conf", description = "desc"),
            name = "Round 2",
            durationSeconds = 60,
            remainingSeconds = 10,
            status = RoundStatus.PAUSED,
            isCurrent = false,
            endAt = null,
            updatedAt = now
        )

        val currentRound = Round(
            uuid = UUID.randomUUID(),
            conference = Conference(uuid = conferenceId, name = "conf", description = "desc"),
            name = "Round 1",
            durationSeconds = 30,
            remainingSeconds = 1,
            status = RoundStatus.RUNNING,
            isCurrent = true,
            endAt = now.minusSeconds(1),
            updatedAt = now,
            nextRound = nextRound
        )

        `when`(roundRepository.findCurrentForUpdate(conferenceId)).thenReturn(currentRound)
        `when`(roundRepository.findByUuidAndConferenceUuid(nextRound.uuid!!, conferenceId)).thenReturn(nextRound)
        `when`(roundRepository.save(any(Round::class.java))).thenAnswer { it.getArgument(0) }

        val response = roundService.advanceIfExpired(conferenceId)

        verify(roundRepository).updateIsCurrentToFalseByConferenceUuid(conferenceId)
        assertNotNull(response)
        assertEquals(nextRound.uuid.toString(), response!!.roundId)
        assertEquals(RoundStatus.RUNNING, response.status)
        assertTrue(response.isCurrent)
        assertTrue(response.remainingSeconds in 0..60)
    }

    @Test
    fun `setNextRound allows clearing next round`() {
        val conferenceId = UUID.randomUUID()
        val round = Round(
            uuid = UUID.randomUUID(),
            conference = Conference(uuid = conferenceId, name = "conf", description = "desc"),
            name = "Round 1",
            durationSeconds = 60,
            remainingSeconds = 60,
            status = RoundStatus.PAUSED,
            isCurrent = false,
            endAt = null,
            updatedAt = LocalDateTime.now()
        )

        `when`(roundRepository.findByUuidAndConferenceUuid(round.uuid!!, conferenceId)).thenReturn(round)
        `when`(roundRepository.save(any(Round::class.java))).thenAnswer { it.getArgument(0) }

        val response = roundService.setNextRound(
            round.uuid!!,
            RoundSetNextRequest(nextRoundId = null),
            conferenceId
        )

        assertEquals(null, response.nextRoundId)
    }

    @Test
    fun `updateRound updates name and duration while preserving elapsed time`() {
        val conferenceId = UUID.randomUUID()
        val now = LocalDateTime.now()
        val round = Round(
            uuid = UUID.randomUUID(),
            conference = Conference(uuid = conferenceId, name = "conf", description = "desc"),
            name = "Round 1",
            durationSeconds = 100,
            remainingSeconds = 70,
            status = RoundStatus.PAUSED,
            isCurrent = false,
            endAt = null,
            updatedAt = now
        )

        `when`(roundRepository.findCurrentForUpdate(conferenceId)).thenReturn(null)
        `when`(roundRepository.findByUuidAndConferenceUuid(round.uuid!!, conferenceId)).thenReturn(round)
        `when`(roundRepository.save(any(Round::class.java))).thenAnswer { it.getArgument(0) }

        val response = roundService.updateRound(
            round.uuid!!,
            RoundUpdateRequest(name = "Updated Round", durationSeconds = 120),
            conferenceId
        )

        assertEquals("Updated Round", response.name)
        assertEquals(120, response.durationSeconds)
        assertEquals(90, response.remainingSeconds)
    }

    @Test
    fun `setCurrentRound switches current round to an existing round`() {
        val conferenceId = UUID.randomUUID()
        val now = LocalDateTime.now()
        val currentRound = Round(
            uuid = UUID.randomUUID(),
            conference = Conference(uuid = conferenceId, name = "conf", description = "desc"),
            name = "Round 1",
            durationSeconds = 120,
            remainingSeconds = 120,
            status = RoundStatus.RUNNING,
            isCurrent = true,
            endAt = now.plusSeconds(80),
            updatedAt = now
        )

        val targetRound = Round(
            uuid = UUID.randomUUID(),
            conference = currentRound.conference,
            name = "Round 2",
            durationSeconds = 150,
            remainingSeconds = 100,
            status = RoundStatus.PAUSED,
            isCurrent = false,
            endAt = null,
            updatedAt = now
        )

        `when`(roundRepository.findCurrentForUpdate(conferenceId)).thenReturn(currentRound, currentRound)
        `when`(roundRepository.findByUuidAndConferenceUuid(targetRound.uuid!!, conferenceId)).thenReturn(targetRound)
        `when`(roundRepository.save(any(Round::class.java))).thenAnswer { it.getArgument(0) }

        val response = roundService.setCurrentRound(
            RoundSetCurrentRequest(roundId = targetRound.uuid.toString()),
            conferenceId
        )

        assertEquals(targetRound.uuid.toString(), response.roundId)
        assertTrue(response.isCurrent)
        assertEquals(RoundStatus.PAUSED, response.status)
        assertTrue(currentRound.remainingSeconds in 79..80)
        assertEquals(RoundStatus.PAUSED, currentRound.status)
        assertEquals(null, currentRound.endAt)
    }

    @Test
    fun `resumeRound resets to full duration when no remaining time`() {
        val conferenceId = UUID.randomUUID()
        val now = LocalDateTime.now()
        val round = Round(
            uuid = UUID.randomUUID(),
            conference = Conference(uuid = conferenceId, name = "conf", description = "desc"),
            name = "Round 1",
            durationSeconds = 90,
            remainingSeconds = 0,
            status = RoundStatus.PAUSED,
            isCurrent = true,
            endAt = null,
            updatedAt = now
        )

        `when`(roundRepository.findCurrentForUpdate(conferenceId)).thenReturn(round, round)
        `when`(roundRepository.save(any(Round::class.java))).thenAnswer { it.getArgument(0) }

        val response = roundService.resumeRound(round.uuid!!, conferenceId)

        assertEquals(RoundStatus.RUNNING, response.status)
        assertEquals(90, response.remainingSeconds)
        assertNotNull(response.endAt)
        assertEquals(90, round.remainingSeconds)
        assertEquals(RoundStatus.RUNNING, round.status)
    }

    @Test
    fun `setRoundRemaining updates remaining time and endAt for running round`() {
        val conferenceId = UUID.randomUUID()
        val now = LocalDateTime.now()
        val round = Round(
            uuid = UUID.randomUUID(),
            conference = Conference(uuid = conferenceId, name = "conf", description = "desc"),
            name = "Round 1",
            durationSeconds = 120,
            remainingSeconds = 80,
            status = RoundStatus.RUNNING,
            isCurrent = true,
            endAt = now.plusSeconds(80),
            updatedAt = now
        )

        `when`(roundRepository.findCurrentForUpdate(conferenceId)).thenReturn(round)
        `when`(roundRepository.findByUuidAndConferenceUuid(round.uuid!!, conferenceId)).thenReturn(round)
        `when`(roundRepository.save(any(Round::class.java))).thenAnswer { it.getArgument(0) }

        val response = roundService.setRoundRemaining(
            round.uuid!!,
            RoundSetRemainingRequest(remainingSeconds = 45),
            conferenceId
        )

        assertEquals(45, response.remainingSeconds)
        assertEquals(45, round.remainingSeconds)
        assertNotNull(round.endAt)
    }
}
