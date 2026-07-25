package top.bearingwall.asya.repository

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import top.bearingwall.asya.model.UserGroup

@Repository
interface UserGroupRepository : JpaRepository<UserGroup, Long> {
    fun findFirstByGroupName(groupName: String): UserGroup?
}