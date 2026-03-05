package top.bearingwall.asya.config

import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.InterceptorRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
import top.bearingwall.asya.audit.AuditContextInterceptor

@Configuration
class AuditWebMvcConfig(
    private val auditContextInterceptor: AuditContextInterceptor
) : WebMvcConfigurer {

    override fun addInterceptors(registry: InterceptorRegistry) {
        registry.addInterceptor(auditContextInterceptor).addPathPatterns("/**")
    }
}

