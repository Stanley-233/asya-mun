package top.bearingwall.asya.service

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.audit.Auditable
import top.bearingwall.asya.dto.RoundPublishRequest
import top.bearingwall.asya.dto.RoundResponse
import top.bearingwall.asya.dto.RoundSetNextRequest
import top.bearingwall.asya.dto.RoundSetCurrentRequest
import top.bearingwall.asya.dto.RoundUpdateRequest
import top.bearingwall.asya.model.AuditActionType
import top.bearingwall.asya.model.Round
import top.bearingwall.asya.model.RoundStatus
import top.bearingwall.asya.repository.ConferenceRepository
import top.bearingwall.asya.repository.RoundRepository
import java.time.Duration
import java.time.LocalDateTime
import java.util.UUID
import kotlin.math.max

@Service
class RoundService(
    private val roundRepository: RoundRepository,
    private val conferenceRepository: ConferenceRepository
) {
    private val log = LoggerFactory.getLogger(RoundService::class.java)

    @Transactional
    @Auditable(type = AuditActionType.ROUND_PUBLISH, content = "发布回合")
    fun publishRound(request: RoundPublishRequest, conferenceUuid: UUID): RoundResponse {
        require(request.name.isNotBlank()) { "Round name cannot be blank" }
        require(request.durationSeconds > 0) { "durationSeconds must be greater than 0" }

        val conference = conferenceRepository.findById(conferenceUuid).orElseThrow {
            IllegalArgumentException("Conference not found: $conferenceUuid")
        }

        val nextRound = parseNextRound(request.nextRoundId, conferenceUuid)
        val now = LocalDateTime.now()

        roundRepository.updateIsCurrentToFalseByConferenceUuid(conferenceUuid)

        val round = Round(
            conference = conference,
            name = request.name.trim(),
            durationSeconds = request.durationSeconds,
            remainingSeconds = request.durationSeconds,
            status = request.initialStatus,
            isCurrent = true,
            endAt = if (request.initialStatus == RoundStatus.RUNNING) now.plusSeconds(request.durationSeconds) else null,
            updatedAt = now,
            nextRound = nextRound
        )

        val saved = roundRepository.save(round)
        return saved.toResponse(now)
    }

    @Transactional
    @Auditable(type = AuditActionType.ROUND_SET_NEXT, content = "设置回合下一跳")
    fun setNextRound(roundUuid: UUID, request: RoundSetNextRequest, conferenceUuid: UUID): RoundResponse {
        val round = roundRepository.findByUuidAndConferenceUuid(roundUuid, conferenceUuid)
            ?: throw IllegalArgumentException("Round not found: $roundUuid")

        round.nextRound = parseNextRound(request.nextRoundId, conferenceUuid)
        round.updatedAt = LocalDateTime.now()

        return roundRepository.save(round).toResponse(LocalDateTime.now())
    }

    @Transactional
    @Auditable(type = AuditActionType.ROUND_UPDATE, content = "修改回合")
    fun updateRound(roundUuid: UUID, request: RoundUpdateRequest, conferenceUuid: UUID): RoundResponse {
        advanceIfExpired(conferenceUuid)

        val round = roundRepository.findByUuidAndConferenceUuid(roundUuid, conferenceUuid)
            ?: throw IllegalArgumentException("Round not found: $roundUuid")

        return updateRound(round, request)
    }

    @Transactional
    @Auditable(type = AuditActionType.ROUND_SET_CURRENT, content = "切换当前回合")
    fun setCurrentRound(request: RoundSetCurrentRequest, conferenceUuid: UUID): RoundResponse {
        advanceIfExpired(conferenceUuid)

        val targetRoundUuid = runCatching { UUID.fromString(request.roundId) }
            .getOrElse { throw IllegalArgumentException("Invalid roundId") }
        val now = LocalDateTime.now()

        val target = roundRepository.findByUuidAndConferenceUuid(targetRoundUuid, conferenceUuid)
            ?: throw IllegalArgumentException("Round not found: $targetRoundUuid")

        val current = roundRepository.findCurrentForUpdate(conferenceUuid)
        if (current?.uuid == target.uuid) {
            return target.toResponse(now)
        }

        if (current != null) {
            current.isCurrent = false
            if (current.status == RoundStatus.RUNNING) {
                current.remainingSeconds = remainingSeconds(current, now)
                current.status = RoundStatus.PAUSED
                current.endAt = null
            }
            current.updatedAt = now
            roundRepository.save(current)
        }

        target.isCurrent = true
        if (target.status == RoundStatus.RUNNING) {
            target.endAt = now.plusSeconds(target.remainingSeconds)
        } else {
            target.endAt = null
        }
        target.updatedAt = now

        return roundRepository.save(target).toResponse(now)
    }

    @Transactional
    @Auditable(type = AuditActionType.ROUND_PAUSE, content = "暂停回合")
    fun pauseRound(roundUuid: UUID, conferenceUuid: UUID): RoundResponse {
        advanceIfExpired(conferenceUuid)

        val current = roundRepository.findCurrentForUpdate(conferenceUuid)
            ?: throw IllegalStateException("No current round")
        require(current.uuid == roundUuid) { "Only current round can be paused" }
        require(current.status == RoundStatus.RUNNING) { "Round is not running" }

        val now = LocalDateTime.now()
        current.remainingSeconds = remainingSeconds(current, now)
        current.status = RoundStatus.PAUSED
        current.endAt = null
        current.updatedAt = now

        return roundRepository.save(current).toResponse(now)
    }

    @Transactional
    @Auditable(type = AuditActionType.ROUND_RESUME, content = "恢复回合")
    fun resumeRound(roundUuid: UUID, conferenceUuid: UUID): RoundResponse {
        advanceIfExpired(conferenceUuid)

        val current = roundRepository.findCurrentForUpdate(conferenceUuid)
            ?: throw IllegalStateException("No current round")
        require(current.uuid == roundUuid) { "Only current round can be resumed" }
        require(current.status == RoundStatus.PAUSED) { "Round is not paused" }
        require(current.remainingSeconds > 0) { "Round has no remaining time" }

        val now = LocalDateTime.now()
        current.status = RoundStatus.RUNNING
        current.endAt = now.plusSeconds(current.remainingSeconds)
        current.updatedAt = now

        return roundRepository.save(current).toResponse(now)
    }

    @Transactional(readOnly = true)
    fun listRounds(conferenceUuid: UUID): List<RoundResponse> {
        val now = LocalDateTime.now()
        return roundRepository.findAllByConferenceUuidOrderByUpdatedAtDesc(conferenceUuid).map { it.toResponse(now) }
    }

    @Transactional
    fun getRoundDetail(roundUuid: UUID, conferenceUuid: UUID): RoundResponse {
        advanceIfExpired(conferenceUuid)
        val round = roundRepository.findByUuidAndConferenceUuid(roundUuid, conferenceUuid)
            ?: throw IllegalArgumentException("Round not found: $roundUuid")
        return round.toResponse(LocalDateTime.now())
    }

    @Transactional
    fun getCurrentRound(conferenceUuid: UUID): RoundResponse? {
        advanceIfExpired(conferenceUuid)
        val now = LocalDateTime.now()
        return roundRepository.findFirstByConferenceUuidAndIsCurrentTrue(conferenceUuid)?.toResponse(now)
    }

    @Transactional
    @Auditable(type = AuditActionType.ROUND_AUTO_ADVANCE, content = "回合自动推进")
    fun advanceIfExpired(conferenceUuid: UUID): RoundResponse? {
        val now = LocalDateTime.now()
        val current = roundRepository.findCurrentForUpdate(conferenceUuid) ?: return null

        if (current.status != RoundStatus.RUNNING || current.endAt == null || current.endAt!!.isAfter(now)) {
            return current.toResponse(now)
        }

        current.isCurrent = false
        current.status = RoundStatus.PAUSED
        current.remainingSeconds = 0
        current.endAt = null
        current.updatedAt = now
        roundRepository.save(current)

        val nextRoundId = current.nextRound?.uuid
        if (nextRoundId == null) {
            return null
        }

        val nextRound = roundRepository.findByUuidAndConferenceUuid(nextRoundId, conferenceUuid)
            ?: throw IllegalStateException("Next round not found in same conference: $nextRoundId")

        roundRepository.updateIsCurrentToFalseByConferenceUuid(conferenceUuid)

        nextRound.isCurrent = true
        nextRound.status = RoundStatus.RUNNING
        nextRound.remainingSeconds = nextRound.durationSeconds
        nextRound.endAt = now.plusSeconds(nextRound.durationSeconds)
        nextRound.updatedAt = now

        return roundRepository.save(nextRound).toResponse(now)
    }

    @Transactional
    fun advanceExpiredRounds() {
        val now = LocalDateTime.now()
        val conferenceIds = roundRepository.findConferenceIdsWithExpiredCurrentRound(now)
        conferenceIds.forEach { conferenceId ->
            runCatching { advanceIfExpired(conferenceId) }
                .onFailure { ex ->
                    log.error("Failed to auto advance round for conference {}", conferenceId, ex)
                }
        }
    }

    private fun parseNextRound(nextRoundId: String?, conferenceUuid: UUID): Round? {
        if (nextRoundId.isNullOrBlank()) {
            return null
        }
        val nextUuid = runCatching { UUID.fromString(nextRoundId) }
            .getOrElse { throw IllegalArgumentException("Invalid nextRoundId") }

        return roundRepository.findByUuidAndConferenceUuid(nextUuid, conferenceUuid)
            ?: throw IllegalArgumentException("nextRoundId not found in current conference")
    }

    private fun updateRound(round: Round, request: RoundUpdateRequest): RoundResponse {
        require(request.name.isNotBlank()) { "Round name cannot be blank" }
        require(request.durationSeconds > 0) { "durationSeconds must be greater than 0" }

        val now = LocalDateTime.now()
        val currentRemaining = remainingSeconds(round, now)
        val elapsedSeconds = max(0, round.durationSeconds - currentRemaining)
        val newRemainingSeconds = max(0, request.durationSeconds - elapsedSeconds)

        round.name = request.name.trim()
        round.durationSeconds = request.durationSeconds
        round.remainingSeconds = newRemainingSeconds
        round.updatedAt = now

        if (round.status == RoundStatus.RUNNING) {
            round.endAt = now.plusSeconds(newRemainingSeconds)
        }

        if (round.status == RoundStatus.PAUSED) {
            round.endAt = null
        }

        return roundRepository.save(round).toResponse(now)
    }

    private fun remainingSeconds(round: Round, now: LocalDateTime): Long {
        return when (round.status) {
            RoundStatus.PAUSED -> round.remainingSeconds
            RoundStatus.RUNNING -> {
                val endAt = round.endAt ?: return round.remainingSeconds
                max(0, Duration.between(now, endAt).seconds)
            }
        }
    }

    private fun Round.toResponse(now: LocalDateTime): RoundResponse {
        val conferenceId = this.conference?.uuid?.toString()
            ?: throw IllegalStateException("Round conference is missing")
        val roundId = this.uuid?.toString() ?: throw IllegalStateException("Round uuid is missing")

        return RoundResponse(
            roundId = roundId,
            conferenceId = conferenceId,
            name = this.name,
            durationSeconds = this.durationSeconds,
            remainingSeconds = remainingSeconds(this, now),
            status = this.status,
            isCurrent = this.isCurrent,
            nextRoundId = this.nextRound?.uuid?.toString(),
            endAt = this.endAt,
            serverTime = now
        )
    }
}
