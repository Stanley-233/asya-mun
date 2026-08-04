package top.bearingwall.asya.service

import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.concurrent.atomic.AtomicReference

@Component
class SecretMessageNotificationScheduler(
    private val notificationService: NotificationService,
) {
    private val lastScanAt = AtomicReference(LocalDateTime.now(ZoneOffset.UTC))

    @Scheduled(fixedDelay = 5000)
    fun notifyReadableSecretMessages() {
        val now = LocalDateTime.now(ZoneOffset.UTC)
        val after = lastScanAt.getAndSet(now)
        notificationService.notifyReadableSecretMessagesBetween(after, now)
    }
}
