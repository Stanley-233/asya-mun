package top.bearingwall.asya.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import top.bearingwall.asya.model.Conference
import java.util.UUID

@Repository
interface ConferenceRepository : JpaRepository<Conference, UUID>

