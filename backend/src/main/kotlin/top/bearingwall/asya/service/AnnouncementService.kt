package top.bearingwall.asya.service

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import top.bearingwall.asya.audit.Auditable
import top.bearingwall.asya.dto.AnnouncementImageResponse
import top.bearingwall.asya.model.Attachment
import top.bearingwall.asya.model.AttachmentTargetType
import top.bearingwall.asya.model.AuditActionType
import java.util.UUID

@Service
class AnnouncementService(
    private val attachmentService: AttachmentService,
    private val systemConfigService: SystemConfigService
) {

    @Transactional
    @Auditable(type = AuditActionType.ANNOUNCEMENT_IMAGE_UPDATE, content = "更新公告图片")
    fun replaceAnnouncementImage(file: MultipartFile): AnnouncementImageResponse {
        val oldUuid = systemConfigService.getAnnouncementImageUuid()
        val uploaded = attachmentService.uploadAttachment(file, AttachmentTargetType.ANNOUNCEMENT, null)
        val newUuid = UUID.fromString(uploaded.uuid)

        systemConfigService.setAnnouncementImageUuid(newUuid)

        if (oldUuid != null && oldUuid != newUuid) {
            try {
                attachmentService.deleteAttachment(oldUuid)
            } catch (_: IllegalArgumentException) {
                // 旧附件缺失时忽略，避免阻断新公告图发布
            }
        }

        val attachment = attachmentService.getAttachment(newUuid)
        return toAnnouncementImageResponse(attachment)
    }

    @Transactional(readOnly = true)
    fun getCurrentAnnouncementImageInfo(): AnnouncementImageResponse? {
        val uuid = systemConfigService.getAnnouncementImageUuid() ?: return null
        val attachment = findAnnouncementAttachment(uuid)
        return toAnnouncementImageResponse(attachment)
    }

    @Transactional(readOnly = true)
    fun getCurrentAnnouncementImageAttachment(): Attachment {
        val uuid = systemConfigService.getAnnouncementImageUuid()
            ?: throw IllegalStateException("当前未设置公告图")
        return findAnnouncementAttachment(uuid)
    }

    private fun findAnnouncementAttachment(uuid: UUID): Attachment {
        val attachment = attachmentService.getAttachment(uuid)
        if (attachment.targetType != AttachmentTargetType.ANNOUNCEMENT) {
            throw IllegalStateException("公告图配置无效")
        }
        return attachment
    }

    private fun toAnnouncementImageResponse(attachment: Attachment): AnnouncementImageResponse {
        return AnnouncementImageResponse(
            uuid = attachment.uuid.toString(),
            fileName = attachment.fileName,
            fileType = attachment.fileType,
            fileSize = attachment.fileSize
        )
    }
}
