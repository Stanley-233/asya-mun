package top.bearingwall.asya.controller

import org.slf4j.LoggerFactory
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.messaging.handler.annotation.Payload
import org.springframework.stereotype.Controller
import top.bearingwall.asya.dto.NotificationSyncRequest
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.service.NotificationService
import top.bearingwall.asya.ws.NotificationPrincipal
import java.security.Principal

@Controller
class NotificationWsController(
    private val notificationService: NotificationService,
) {
    private val log = LoggerFactory.getLogger(NotificationWsController::class.java)

    @MessageMapping("/notifications/sync")
    fun syncNotifications(
        principal: Principal,
        @Payload request: NotificationSyncRequest?,
    ) {
        val notificationPrincipal = principal as? NotificationPrincipal ?: return
        if (notificationPrincipal.role != UserRole.DELEGATE) {
            return
        }

        log.info(
            "Notification sync requested, userUuid={}, conferenceUuid={}, publicAfter={}, secretAfter={}, instructionAfter={}",
            notificationPrincipal.userUuid,
            notificationPrincipal.conferenceUuid,
            request?.publicMessageAfter,
            request?.secretMessageAfter,
            request?.instructionFeedbackAfter,
        )

        notificationService.syncNotifications(
            delegateUuid = notificationPrincipal.userUuid,
            request = request ?: NotificationSyncRequest(),
        )
    }
}
