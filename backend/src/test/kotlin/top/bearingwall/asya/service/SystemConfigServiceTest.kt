package top.bearingwall.asya.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import top.bearingwall.asya.model.SystemConfig
import top.bearingwall.asya.repository.SystemConfigRepository
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class SystemConfigServiceTest {

    @Mock
    lateinit var configRepository: SystemConfigRepository

    @InjectMocks
    lateinit var systemConfigService: SystemConfigService

    @Test
    fun `setInstructionSubmissionPaused updates existing true config to false`() {
        val existing = SystemConfig(
            key = SystemConfigService.KEY_INSTRUCTION_SUBMISSION_PAUSED,
            value = "true",
            description = "全局指令提交通道暂停开关"
        )

        `when`(configRepository.findById(SystemConfigService.KEY_INSTRUCTION_SUBMISSION_PAUSED))
            .thenReturn(Optional.of(existing))

        systemConfigService.setInstructionSubmissionPaused(false)

        val captor = ArgumentCaptor.forClass(SystemConfig::class.java)
        verify(configRepository).saveAndFlush(captor.capture())
        assertEquals(SystemConfigService.KEY_INSTRUCTION_SUBMISSION_PAUSED, captor.value.key)
        assertEquals("false", captor.value.value)
    }
}
