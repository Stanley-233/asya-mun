package top.bearingwall.asya.service

import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

@Component
class RoundScheduler(
    private val roundService: RoundService
) {
    @Scheduled(fixedDelay = 1000)
    fun advanceRounds() {
        roundService.advanceExpiredRounds()
    }
}
