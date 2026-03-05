package top.bearingwall.asya.service

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import top.bearingwall.asya.dto.AttachmentInfoResponse
import top.bearingwall.asya.dto.AttachmentUploadResponse
import top.bearingwall.asya.model.Attachment
import top.bearingwall.asya.repository.AttachmentRepository
import java.util.UUID

@Service
class AttachmentService(
    private val attachmentRepository: AttachmentRepository
) {

    @Transactional
    fun uploadAttachment(file: MultipartFile): AttachmentUploadResponse {
        if (file.isEmpty) {
            throw IllegalArgumentException("文件为空")
        }
        val (fileName, fileType) = splitFileName(file.originalFilename)
        val attachment = Attachment(
            fileName = fileName,
            fileType = fileType,
            fileSize = file.size,
            fileBlob = file.bytes
        )
        val saved = attachmentRepository.save(attachment)
        return AttachmentUploadResponse(
            uuid = saved.uuid.toString(),
            fileName = saved.fileName,
            fileType = saved.fileType
        )
    }

    @Transactional(readOnly = true)
    fun listAll(): List<AttachmentInfoResponse> {
        return attachmentRepository.findAll().map { attachment ->
            attachment.toInfoResponse()
        }
    }

    @Transactional(readOnly = true)
    fun getAttachmentInfo(uuid: UUID): AttachmentInfoResponse {
        return getAttachment(uuid).toInfoResponse()
    }

    @Transactional(readOnly = true)
    fun getAttachment(uuid: UUID): Attachment {
        return attachmentRepository.findById(uuid).orElseThrow {
            IllegalArgumentException("Attachment not found: $uuid")
        }
    }

    @Transactional
    fun deleteAttachment(uuid: UUID) {
        if (!attachmentRepository.existsById(uuid)) {
            throw IllegalArgumentException("Attachment not found: $uuid")
        }
        attachmentRepository.deleteById(uuid)
    }

    private fun splitFileName(originalFilename: String?): Pair<String, String> {
        val fallbackName = "unknown"
        val rawName = originalFilename?.ifBlank { fallbackName } ?: fallbackName
        val normalized = rawName.substringAfterLast('/').substringAfterLast('\\')
        val dotIndex = normalized.lastIndexOf('.')
        if (dotIndex <= 0 || dotIndex == normalized.length - 1) {
            return Pair(normalized, "bin")
        }
        return Pair(
            normalized.substring(0, dotIndex),
            normalized.substring(dotIndex + 1)
        )
    }

    private fun Attachment.toInfoResponse(): AttachmentInfoResponse {
        return AttachmentInfoResponse(
            uuid = uuid.toString(),
            fileName = fileName,
            fileType = fileType,
            fileSize = fileSize,
            targetType = targetType,
            targetId = targetId?.toString(),
            messageId = message?.uuid?.toString()
        )
    }
}
