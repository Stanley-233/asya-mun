package top.bearingwall.asya.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.Mockito.doThrow
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.dao.DataIntegrityViolationException
import top.bearingwall.asya.model.AuditActionType
import top.bearingwall.asya.model.AuditLog
import top.bearingwall.asya.repository.AuditLogRepository

@ExtendWith(MockitoExtension::class)
class AuditLogServiceTest {

    @Mock
    lateinit var auditLogRepository: AuditLogRepository

    @InjectMocks
    lateinit var auditLogService: AuditLogService

    @Test
    fun `save falls back to legacy audit action when new action type is rejected`() {
        doThrow(DataIntegrityViolationException("constraint"))
            .doAnswer { it.getArgument<AuditLog>(0) }
            .`when`(auditLogRepository)
            .saveAndFlush(org.mockito.Mockito.any(AuditLog::class.java))

        auditLogService.save(
            actorUuid = null,
            actorName = "tester",
            actorIp = "127.0.0.1",
            actionType = AuditActionType.INSTRUCTION_CREATE,
            eventContent = "提交指令",
            success = true
        )

        val captor = ArgumentCaptor.forClass(AuditLog::class.java)
        verify(auditLogRepository, times(2)).saveAndFlush(captor.capture())
        val fallbackLog = captor.allValues.last()
        assertEquals(AuditActionType.MESSAGE_CREATE, fallbackLog.actionType)
        assertTrue(fallbackLog.eventContent.startsWith("[fallbackFrom=INSTRUCTION_CREATE]"))
    }
}
