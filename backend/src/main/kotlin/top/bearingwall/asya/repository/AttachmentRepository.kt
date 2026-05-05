package top.bearingwall.asya.repository

import org.springframework.data.jpa.repository.JpaRepository
import top.bearingwall.asya.model.Attachment
import java.util.UUID

interface AttachmentRepository : JpaRepository<Attachment, UUID>
