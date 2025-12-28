package top.bearingwall.asya.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import top.bearingwall.asya.model.Group

@Repository
interface GroupRepository : JpaRepository<Group, Int>

