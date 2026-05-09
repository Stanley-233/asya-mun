package top.bearingwall.asya.config

import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.info.Info
import org.springdoc.core.models.GroupedOpenApi
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class OpenApiConfig(
    @Value("\${app.version}")
    private val appVersion: String,
) {

    @Bean
    fun customOpenAPI(): OpenAPI {
        return OpenAPI()
            .info(
                Info()
                    .title("Asya Backend API")
                    .version(appVersion)
                    .description("API documentation for Asya Backend application")
            )
    }

    @Bean
    fun defaultGroupedOpenApi(): GroupedOpenApi {
        return GroupedOpenApi.builder()
            .group("default")
            .pathsToMatch("/api/**")
            .build()
    }
}
