package top.bearingwall.asya.config

import org.slf4j.LoggerFactory
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component

@Component
class DatabaseConstraintCleanup(
    private val jdbcTemplate: JdbcTemplate
) {
    private val log = LoggerFactory.getLogger(DatabaseConstraintCleanup::class.java)

    @EventListener(ApplicationReadyEvent::class)
    fun dropLegacyAuditActionTypeConstraint() {
        runCatching {
            jdbcTemplate.execute(
                """
                ALTER TABLE IF EXISTS audit_logs
                DROP CONSTRAINT IF EXISTS audit_logs_action_type_check
                """.trimIndent()
            )
            log.info("Dropped legacy constraint audit_logs_action_type_check if it existed")
        }.onFailure {
            log.warn("Failed to drop legacy constraint audit_logs_action_type_check", it)
        }
    }
}
