package top.bearingwall.asya.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import top.bearingwall.asya.model.AuditLog

@Repository
interface AuditLogRepository : JpaRepository<AuditLog, Long>

