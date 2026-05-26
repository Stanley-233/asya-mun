package top.bearingwall.asya.config

import org.springframework.context.annotation.Configuration
import org.springframework.messaging.simp.config.ChannelRegistration
import org.springframework.messaging.simp.config.MessageBrokerRegistry
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker
import org.springframework.web.socket.config.annotation.StompEndpointRegistry
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer
import top.bearingwall.asya.ws.NotificationChannelInterceptor

@Configuration
@EnableWebSocketMessageBroker
class WebSocketConfig(
    private val notificationChannelInterceptor: NotificationChannelInterceptor,
) : WebSocketMessageBrokerConfigurer {

    private val allowedOriginPatterns: Array<String> by lazy {
        val configuredPatterns = System.getenv("WS_ALLOWED_ORIGIN_PATTERNS")
            ?.split(",")
            ?.map { it.trim() }
            ?.filter { it.isNotEmpty() }
            .orEmpty()

        if (configuredPatterns.isEmpty()) {
            arrayOf("*")
        } else {
            configuredPatterns.toTypedArray()
        }
    }

    override fun configureMessageBroker(config: MessageBrokerRegistry) {
        config.enableSimpleBroker("/queue", "/topic")
        config.setApplicationDestinationPrefixes("/app")
        config.setUserDestinationPrefix("/user")
    }

    override fun registerStompEndpoints(registry: StompEndpointRegistry) {
        registry.addEndpoint("/ws")
            .setAllowedOriginPatterns(*allowedOriginPatterns)
    }

    override fun configureClientInboundChannel(registration: ChannelRegistration) {
        registration.interceptors(notificationChannelInterceptor)
    }
}
