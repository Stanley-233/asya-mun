package top.bearingwall.asya.ws

import org.slf4j.LoggerFactory
import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.MessageHeaderAccessor
import org.springframework.messaging.support.MessageBuilder
import org.springframework.messaging.support.ChannelInterceptor
import org.springframework.stereotype.Component
import top.bearingwall.asya.service.UserService

@Component
class NotificationChannelInterceptor(
    private val userService: UserService,
) : ChannelInterceptor {
    private val log = LoggerFactory.getLogger(NotificationChannelInterceptor::class.java)

    override fun preSend(message: Message<*>, channel: MessageChannel): Message<*>? {
        val accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor::class.java)
            ?: return message
        if (accessor.command != StompCommand.CONNECT) {
            return message
        }

        val authorization = accessor.getFirstNativeHeader("Authorization")
            ?: throw IllegalArgumentException("缺少 Authorization 头")
        require(authorization.startsWith("Bearer ")) { "Authorization header must start with 'Bearer '" }

        val user = userService.getUserFromToken(authorization.removePrefix("Bearer ").trim())
        accessor.user = NotificationPrincipal(
            userUuid = user.uuid ?: throw IllegalStateException("User uuid missing"),
            role = user.role,
            conferenceUuid = user.conference?.uuid,
        )
        accessor.setLeaveMutable(true)
        log.info(
            "WebSocket CONNECT authenticated, userUuid={}, role={}, conferenceUuid={}",
            user.uuid,
            user.role,
            user.conference?.uuid,
        )

        return MessageBuilder.createMessage(message.payload, accessor.messageHeaders)
    }
}
