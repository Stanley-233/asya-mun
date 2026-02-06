package top.bearingwall.asya.service

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.model.SystemConfig
import top.bearingwall.asya.repository.SystemConfigRepository

@Service
class SystemConfigService(
    private val configRepository: SystemConfigRepository
) {
    companion object {
        const val KEY_REGISTRATION_ALLOWED = "REGISTRATION_ALLOWED"
    }

    @Transactional(readOnly = true)
    fun isRegistrationAllowed(): Boolean {
        // 默认为允许注册
        return configRepository.findById(KEY_REGISTRATION_ALLOWED)
            .map { it.value.toBoolean() }
            .orElse(true)
    }

    @Transactional
    fun setRegistrationAllowed(allowed: Boolean) {
        val config = configRepository.findById(KEY_REGISTRATION_ALLOWED)
            .orElse(SystemConfig(key = KEY_REGISTRATION_ALLOWED, value = allowed.toString(), description = "全局用户注册开关"))

        config.value = allowed.toString()
        configRepository.save(config)
    }
}
