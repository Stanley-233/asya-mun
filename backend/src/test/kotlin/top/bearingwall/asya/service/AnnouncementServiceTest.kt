package top.bearingwall.asya.service

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Captor
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.web.multipart.MultipartFile
import top.bearingwall.asya.dto.AttachmentUploadResponse
import top.bearingwall.asya.model.Attachment
import top.bearingwall.asya.model.AttachmentTargetType
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class AnnouncementServiceTest {

    @Mock
    lateinit var attachmentService: AttachmentService

    @Mock
    lateinit var systemConfigService: SystemConfigService

    @Mock
    lateinit var file: MultipartFile

    @InjectMocks
    lateinit var announcementService: AnnouncementService

    @Captor
    lateinit var uuidCaptor: ArgumentCaptor<UUID>

    @Test
    fun `replaceAnnouncementImage sets new uuid without deleting when old is absent`() {
        val newUuid = UUID.randomUUID()
        val attachment = Attachment(
            uuid = newUuid,
            fileName = "notice",
            fileType = "png",
            fileSize = 123,
            fileBlob = byteArrayOf(1, 2, 3),
            targetType = AttachmentTargetType.ANNOUNCEMENT
        )

        `when`(systemConfigService.getAnnouncementImageUuid()).thenReturn(null)
        `when`(attachmentService.uploadAttachment(file, AttachmentTargetType.ANNOUNCEMENT, null))
            .thenReturn(AttachmentUploadResponse(newUuid.toString(), "notice", "png"))
        `when`(attachmentService.getAttachment(newUuid)).thenReturn(attachment)

        val response = announcementService.replaceAnnouncementImage(file)

        verify(systemConfigService).setAnnouncementImageUuid(uuidCaptor.capture())
        assertEquals(newUuid, uuidCaptor.value)
        assertEquals(newUuid.toString(), response.uuid)
    }

    @Test
    fun `replaceAnnouncementImage deletes old image when replacing`() {
        val oldUuid = UUID.randomUUID()
        val newUuid = UUID.randomUUID()
        val attachment = Attachment(
            uuid = newUuid,
            fileName = "next",
            fileType = "jpg",
            fileSize = 10,
            fileBlob = byteArrayOf(9),
            targetType = AttachmentTargetType.ANNOUNCEMENT
        )

        `when`(systemConfigService.getAnnouncementImageUuid()).thenReturn(oldUuid)
        `when`(attachmentService.uploadAttachment(file, AttachmentTargetType.ANNOUNCEMENT, null))
            .thenReturn(AttachmentUploadResponse(newUuid.toString(), "next", "jpg"))
        `when`(attachmentService.getAttachment(newUuid)).thenReturn(attachment)

        announcementService.replaceAnnouncementImage(file)

        verify(systemConfigService).setAnnouncementImageUuid(newUuid)
        verify(attachmentService).deleteAttachment(oldUuid)
    }

    @Test
    fun `getCurrentAnnouncementImageInfo returns null when not configured`() {
        `when`(systemConfigService.getAnnouncementImageUuid()).thenReturn(null)

        val response = announcementService.getCurrentAnnouncementImageInfo()

        assertNull(response)
    }

    @Test
    fun `getCurrentAnnouncementImageAttachment throws when configured attachment has wrong target`() {
        val configuredUuid = UUID.randomUUID()
        val attachment = Attachment(
            uuid = configuredUuid,
            fileName = "file",
            fileType = "png",
            fileSize = 1,
            fileBlob = byteArrayOf(1),
            targetType = AttachmentTargetType.MESSAGE
        )
        `when`(systemConfigService.getAnnouncementImageUuid()).thenReturn(configuredUuid)
        `when`(attachmentService.getAttachment(configuredUuid)).thenReturn(attachment)

        assertThrows(IllegalStateException::class.java) {
            announcementService.getCurrentAnnouncementImageAttachment()
        }
    }
}
