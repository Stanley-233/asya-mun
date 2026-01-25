package top.bearingwall.asya.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import top.bearingwall.asya.model.ConferenceSession
import java.util.UUID

@Repository
interface ConferenceSessionRepository : JpaRepository<ConferenceSession, UUID>
