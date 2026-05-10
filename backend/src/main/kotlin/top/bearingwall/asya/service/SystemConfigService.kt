package top.bearingwall.asya.service

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.audit.Auditable
import top.bearingwall.asya.model.AuditActionType
import top.bearingwall.asya.model.SystemConfig
import top.bearingwall.asya.repository.SystemConfigRepository
import java.util.UUID

@Service
class SystemConfigService(
    private val configRepository: SystemConfigRepository
) {
    companion object {
        const val KEY_REGISTRATION_ALLOWED = "REGISTRATION_ALLOWED"
        const val KEY_ANNOUNCEMENT_IMAGE_UUID = "ANNOUNCEMENT_IMAGE_UUID"
    }

    @Transactional(readOnly = true)
    fun isRegistrationAllowed(): Boolean {
        // 默认为允许注册
        return configRepository.findById(KEY_REGISTRATION_ALLOWED)
            .map { it.value.toBoolean() }
            .orElse(true)
    }

    @Transactional
    @Auditable(type = AuditActionType.USER_REGISTRATION_SWITCH, content = "设置用户注册开关")
    fun setRegistrationAllowed(allowed: Boolean) {
        val config = configRepository.findById(KEY_REGISTRATION_ALLOWED)
            .orElse(SystemConfig(key = KEY_REGISTRATION_ALLOWED, value = allowed.toString(), description = "全局用户注册开关"))

        config.value = allowed.toString()
        configRepository.save(config)
    }

    @Transactional(readOnly = true)
    fun getAnnouncementImageUuid(): UUID? {
        val raw = configRepository.findById(KEY_ANNOUNCEMENT_IMAGE_UUID)
            .map { it.value.trim() }
            .orElse("")
        if (raw.isBlank()) {
            return null
        }
        return try {
            UUID.fromString(raw)
        } catch (_: IllegalArgumentException) {
            throw IllegalStateException("公告图配置无效")
        }
    }

    @Transactional
    fun setAnnouncementImageUuid(uuid: UUID?) {
        if (uuid == null) {
            configRepository.deleteById(KEY_ANNOUNCEMENT_IMAGE_UUID)
            return
        }
        val config = configRepository.findById(KEY_ANNOUNCEMENT_IMAGE_UUID)
            .orElse(
                SystemConfig(
                    key = KEY_ANNOUNCEMENT_IMAGE_UUID,
                    value = uuid.toString(),
                    description = "当前公告图附件UUID"
                )
            )
        config.value = uuid.toString()
        configRepository.save(config)
    }
}
