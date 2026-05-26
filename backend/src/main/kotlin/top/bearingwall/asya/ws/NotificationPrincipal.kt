package top.bearingwall.asya.ws

import top.bearingwall.asya.model.UserRole
import java.security.Principal
import java.util.UUID

data class NotificationPrincipal(
    val userUuid: UUID,
    val role: UserRole,
    val conferenceUuid: UUID? = null,
) : Principal {
    override fun getName(): String = userUuid.toString()
}
