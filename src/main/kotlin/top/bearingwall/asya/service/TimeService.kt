package top.bearingwall.asya.service

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import top.bearingwall.asya.dto.SessionStatus
import top.bearingwall.asya.dto.TimeAnchorResponse
import top.bearingwall.asya.dto.TimeUpdateRequest
import top.bearingwall.asya.dto.TimeJumpRequest
import top.bearingwall.asya.model.TimeAnchor
import top.bearingwall.asya.repository.ConferenceRepository
import top.bearingwall.asya.repository.ConferenceSessionRepository
import top.bearingwall.asya.repository.TimeAnchorRepository
import java.io.IOException
import java.time.Duration
import java.time.LocalDateTime
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList

@Service
class TimeService(
    private val timeAnchorRepository: TimeAnchorRepository,
    private val conferenceSessionRepository: ConferenceSessionRepository,
    private val conferenceRepository: ConferenceRepository
) {
    private val log = LoggerFactory.getLogger(TimeService::class.java)
    private val emitters = java.util.concurrent.ConcurrentHashMap<UUID, CopyOnWriteArrayList<SseEmitter>>()

    @Transactional(readOnly = true)
    fun getAllTimeAnchors(conferenceUuid: UUID): List<TimeAnchorResponse> {
        return timeAnchorRepository.findAllBySessionConferenceUuid(conferenceUuid).map { it.toResponse() }
    }

    @Transactional(readOnly = true)
    fun getLatestTimeAnchor(conferenceUuid: UUID): TimeAnchorResponse? {
        val conference = conferenceRepository.findById(conferenceUuid).orElse(null) ?: return null
        val currentSession = conference.currentSession ?: return null

        return (timeAnchorRepository.findFirstBySessionUuidAndIsCurrentTrue(currentSession.uuid!!)
            ?: timeAnchorRepository.findFirstBySessionUuidOrderByIdDesc(currentSession.uuid!!))
            ?.toResponse()
    }

    @Transactional(readOnly = true)
    fun subscribe(conferenceUuid: UUID): SseEmitter {
        val emitter = SseEmitter(Long.MAX_VALUE)
        emitters.computeIfAbsent(conferenceUuid) { CopyOnWriteArrayList() }.add(emitter)

        val removeEmitter = {
            log.debug("Removing emitter for conference {}", conferenceUuid)
            emitters[conferenceUuid]?.remove(emitter)
            if (emitters[conferenceUuid]?.isEmpty() == true) {
                emitters.remove(conferenceUuid)
            }
        }

        emitter.onCompletion {
            log.debug("Emitter completed")
            removeEmitter()
        }
        emitter.onTimeout {
            log.debug("Emitter timed out")
            removeEmitter()
        }
        emitter.onError {
            log.debug("Emitter error")
            removeEmitter()
        }

        // Immediately send the latest state if available?
        // Often good practice for SSE to send initial state.
        val latest = getLatestTimeAnchor(conferenceUuid)
        if (latest != null) {
            try {
                emitter.send(SseEmitter.event().name("init").data(latest))
            } catch (_: IOException) {
                removeEmitter()
            }
        }

        return emitter
    }

    fun broadcast(anchor: TimeAnchor, eventName: String = "TIME_UPDATE") {
        val conferenceUuid = anchor.session?.conference?.uuid ?: return
        val conferenceEmitters = emitters[conferenceUuid] ?: return
        val response = anchor.toResponse()
        val deadEmitters = mutableListOf<SseEmitter>()
        conferenceEmitters.forEach { emitter ->
            try {
                emitter.send(SseEmitter.event().name(eventName).data(response))
            } catch (_: IOException) {
                deadEmitters.add(emitter)
            }
        }
        conferenceEmitters.removeAll(deadEmitters.toSet())
    }

    @Transactional
    fun updateTimeAnchor(request: TimeUpdateRequest, conferenceUuid: UUID): TimeAnchorResponse {
        val sessionUuid = UUID.fromString(request.sessionId)
        val session = conferenceSessionRepository.findById(sessionUuid).orElseThrow {
            IllegalArgumentException("Session not found: ${request.sessionId}")
        }
        if (session.conference.uuid != conferenceUuid) {
            throw IllegalArgumentException("Session not found in current conference")
        }

        // 1. Find latest anchor
        val lastAnchor = timeAnchorRepository.findFirstBySessionUuidOrderByIdDesc(sessionUuid)
        val now = LocalDateTime.now()

        // 2 & 3. Calculate current game time (as start point for new anchor)
        // If session was PAUSED, time stood still at last anchor's game time.
        // If session was RUNNING, time advanced.
        val baseGameTime = if (session.status == SessionStatus.RUNNING) {
            if (lastAnchor != null && lastAnchor.anchorRealTime != null && lastAnchor.anchorGameTime != null && lastAnchor.timeRatio != null) {
                val elapsedSeconds = Duration.between(lastAnchor.anchorRealTime, now).seconds
                // If the last anchor had ratio 0, then time stood still effectively anyway, but status handles it better.
                val gameSeconds = (elapsedSeconds * lastAnchor.timeRatio!!.toDouble()).toLong()
                lastAnchor.anchorGameTime!!.plusSeconds(gameSeconds)
            } else {
                // If running but no anchor? Should not happen if well-managed. Fallback to now.
                now
            }
        } else {
            // PAUSED or PREPARE or ENDED
            // Time resumes from where it left off.
            lastAnchor?.anchorGameTime ?: now
        }

        // 3. Mark old anchors as not current
        timeAnchorRepository.updateIsCurrentToFalseBySessionUuid(sessionUuid)

        // 4. Create new anchor
        val newAnchor = TimeAnchor(
            session = session,
            updateTime = now,
            anchorRealTime = now,
            anchorGameTime = baseGameTime,
            timeRatio = request.timeRatio,
            isCurrent = true
        )
        val savedAnchor = timeAnchorRepository.save(newAnchor)

        // Implicit Step: Update session status if we are "starting/resuming"
        // If ratio > 0, we can assume it should be RUNNING.
        if (request.timeRatio.toDouble() > 0 && session.status != SessionStatus.RUNNING) {
             session.status = SessionStatus.RUNNING
             conferenceSessionRepository.save(session)
        }
        // If ratio == 0, maybe we should pause? The prompt does not specify "Pause" action explicitly but implies "Time Ratio" passed.
        // If ratio is 0, technically it is running at 0 speed, or PAUSED?
        // Usually 0 speed = Pause.
        if (request.timeRatio.toDouble() == 0.0 && session.status == SessionStatus.RUNNING) {
             session.status = SessionStatus.PAUSED
             conferenceSessionRepository.save(session)
        }

        // 5. Broadcast
        broadcast(savedAnchor)

        return savedAnchor.toResponse()
    }

    @Transactional
    fun jumpTimeAnchor(request: TimeJumpRequest, conferenceUuid: UUID): TimeAnchorResponse {
        val sessionUuid = UUID.fromString(request.sessionId)
        val session = conferenceSessionRepository.findById(sessionUuid).orElseThrow {
            IllegalArgumentException("Session not found: ${request.sessionId}")
        }
        if (session.conference.uuid != conferenceUuid) {
            throw IllegalArgumentException("Session not found in current conference")
        }
        val now = LocalDateTime.now()

        // Mark old anchors as not current
        timeAnchorRepository.updateIsCurrentToFalseBySessionUuid(sessionUuid)

        val newAnchor = TimeAnchor(
            session = session,
            updateTime = now,
            anchorRealTime = now,
            anchorGameTime = request.targetGameTime,
            timeRatio = request.timeRatio,
            isCurrent = true
        )
        val savedAnchor = timeAnchorRepository.save(newAnchor)

        // If session paused, make it running
        // Note: Logic implies we are setting a new state.
        if (session.status == SessionStatus.PAUSED) {
            session.status = SessionStatus.RUNNING
            conferenceSessionRepository.save(session)
        }

        broadcast(savedAnchor, "TIME_JUMP")
        return savedAnchor.toResponse()
    }

    @Transactional(readOnly = true)
    fun getCurrentGameTime(conferenceUuid: UUID): LocalDateTime? {
        val conference = conferenceRepository.findById(conferenceUuid).orElse(null) ?: return null
        val currentSession = conference.currentSession ?: return null

        val anchor = timeAnchorRepository.findFirstBySessionUuidAndIsCurrentTrue(currentSession.uuid!!)
            ?: timeAnchorRepository.findFirstBySessionUuidOrderByIdDesc(currentSession.uuid!!)
            ?: return null

        if (anchor.session?.status == SessionStatus.PAUSED) {
            return anchor.anchorGameTime
        }

        val now = LocalDateTime.now()

        // If anchor data is incomplete, just return what we have
        if (anchor.anchorRealTime == null || anchor.anchorGameTime == null || anchor.timeRatio == null) {
            return anchor.anchorGameTime
        }

        val elapsedSeconds = Duration.between(anchor.anchorRealTime, now).seconds
        val gameSeconds = (elapsedSeconds * anchor.timeRatio!!.toDouble()).toLong()

        return anchor.anchorGameTime!!.plusSeconds(gameSeconds)
    }

    private fun TimeAnchor.toResponse() = TimeAnchorResponse(
        id = this.id ?: 0,
        sessionId = this.session?.uuid?.toString(),
        updateTime = this.updateTime,
        anchorRealTime = this.anchorRealTime,
        anchorGameTime = this.anchorGameTime,
        timeRatio = this.timeRatio,
        isCurrent = this.isCurrent
    )
}
