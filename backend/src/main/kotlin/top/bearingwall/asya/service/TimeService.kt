package top.bearingwall.asya.service

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import top.bearingwall.asya.audit.Auditable
import top.bearingwall.asya.dto.TimeAnchorResponse
import top.bearingwall.asya.dto.TimeUpdateRequest
import top.bearingwall.asya.dto.TimeJumpRequest
import top.bearingwall.asya.model.AuditActionType
import top.bearingwall.asya.model.TimeAnchor
import top.bearingwall.asya.repository.ConferenceRepository
import top.bearingwall.asya.repository.TimeAnchorRepository
import java.io.IOException
import java.time.Duration
import java.time.LocalDateTime
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList

@Service
class TimeService(
    private val timeAnchorRepository: TimeAnchorRepository,
    private val conferenceRepository: ConferenceRepository
) {
    private val log = LoggerFactory.getLogger(TimeService::class.java)
    private val emitters = java.util.concurrent.ConcurrentHashMap<UUID, CopyOnWriteArrayList<SseEmitter>>()

    @Transactional(readOnly = true)
    fun getAllTimeAnchors(conferenceUuid: UUID): List<TimeAnchorResponse> {
        return timeAnchorRepository.findAllByConferenceUuid(conferenceUuid).map { it.toResponse() }
    }

    @Transactional(readOnly = true)
    fun getLatestTimeAnchor(conferenceUuid: UUID): TimeAnchorResponse? {
        conferenceRepository.findById(conferenceUuid).orElse(null) ?: return null

        return (timeAnchorRepository.findFirstByConferenceUuidAndIsCurrentTrue(conferenceUuid)
            ?: timeAnchorRepository.findFirstByConferenceUuidOrderByIdDesc(conferenceUuid))
            ?.toResponse()
    }

    fun broadcast(anchor: TimeAnchor, eventName: String = "TIME_UPDATE") {
        val conferenceUuid = anchor.conference?.uuid ?: return
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
    @Auditable(type = AuditActionType.TIMELINE_UPDATE, content = "更新时间轴")
    fun updateTimeAnchor(request: TimeUpdateRequest, conferenceUuid: UUID): TimeAnchorResponse {
        val conference = conferenceRepository.findById(conferenceUuid).orElseThrow {
            IllegalArgumentException("Conference not found: $conferenceUuid")
        }

        val lastAnchor = timeAnchorRepository.findFirstByConferenceUuidOrderByIdDesc(conferenceUuid)
        val now = LocalDateTime.now()

        val baseGameTime = if (lastAnchor != null && lastAnchor.anchorRealTime != null &&
            lastAnchor.anchorGameTime != null && lastAnchor.timeRatio != null
        ) {
            val elapsedSeconds = Duration.between(lastAnchor.anchorRealTime, now).seconds
            val gameSeconds = (elapsedSeconds * lastAnchor.timeRatio!!.toDouble()).toLong()
            lastAnchor.anchorGameTime!!.plusSeconds(gameSeconds)
        } else {
            now
        }

        timeAnchorRepository.updateIsCurrentToFalseByConferenceUuid(conferenceUuid)

        val newAnchor = TimeAnchor(
            conference = conference,
            updateTime = now,
            anchorRealTime = now,
            anchorGameTime = baseGameTime,
            timeRatio = request.timeRatio,
            isCurrent = true
        )
        val savedAnchor = timeAnchorRepository.save(newAnchor)

        broadcast(savedAnchor)

        return savedAnchor.toResponse()
    }

    @Transactional
    @Auditable(type = AuditActionType.TIMELINE_JUMP, content = "时间轴跳跃")
    fun jumpTimeAnchor(request: TimeJumpRequest, conferenceUuid: UUID): TimeAnchorResponse {
        val conference = conferenceRepository.findById(conferenceUuid).orElseThrow {
            IllegalArgumentException("Conference not found: $conferenceUuid")
        }
        val now = LocalDateTime.now()

        timeAnchorRepository.updateIsCurrentToFalseByConferenceUuid(conferenceUuid)

        val newAnchor = TimeAnchor(
            conference = conference,
            updateTime = now,
            anchorRealTime = now,
            anchorGameTime = request.targetGameTime,
            timeRatio = request.timeRatio,
            isCurrent = true
        )
        val savedAnchor = timeAnchorRepository.save(newAnchor)

        broadcast(savedAnchor, "TIME_JUMP")
        return savedAnchor.toResponse()
    }

    @Transactional(readOnly = true)
    fun getCurrentGameTime(conferenceUuid: UUID): LocalDateTime? {
        conferenceRepository.findById(conferenceUuid).orElse(null) ?: return null

        val anchor = timeAnchorRepository.findFirstByConferenceUuidAndIsCurrentTrue(conferenceUuid)
            ?: timeAnchorRepository.findFirstByConferenceUuidOrderByIdDesc(conferenceUuid)
            ?: return null

        val ratio = anchor.timeRatio?.toDouble() ?: return anchor.anchorGameTime
        if (ratio == 0.0) {
            return anchor.anchorGameTime
        }

        val now = LocalDateTime.now()
        if (anchor.anchorRealTime == null || anchor.anchorGameTime == null) {
            return anchor.anchorGameTime
        }

        val elapsedSeconds = Duration.between(anchor.anchorRealTime, now).seconds
        val gameSeconds = (elapsedSeconds * ratio).toLong()

        return anchor.anchorGameTime!!.plusSeconds(gameSeconds)
    }

    private fun TimeAnchor.toResponse() = TimeAnchorResponse(
        id = this.id ?: 0,
        conferenceId = this.conference?.uuid?.toString(),
        updateTime = this.updateTime,
        anchorRealTime = this.anchorRealTime,
        anchorGameTime = this.anchorGameTime,
        timeRatio = this.timeRatio,
        isCurrent = this.isCurrent
    )
}
