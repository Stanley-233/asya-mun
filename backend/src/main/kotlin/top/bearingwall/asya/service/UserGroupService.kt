package top.bearingwall.asya.service

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import top.bearingwall.asya.audit.Auditable
import top.bearingwall.asya.dto.UserGroupResponse
import top.bearingwall.asya.model.AuditActionType
import top.bearingwall.asya.model.UserGroup
import top.bearingwall.asya.repository.UserGroupRepository
import top.bearingwall.asya.repository.UserRepository
import java.util.UUID

@Service
class UserGroupService(
    private val userGroupRepository: UserGroupRepository,
    private val userRepository: UserRepository
) {

    @Transactional
    @Auditable(type = AuditActionType.USER_GROUP_CREATE, content = "创建用户组")
    fun createUserGroup(groupName: String): UserGroupResponse {
        val group = userGroupRepository.save(UserGroup(groupName = groupName))
        return group.toResponse()
    }

    @Transactional
    @Auditable(type = AuditActionType.USER_GROUP_UPDATE, content = "更新用户组")
    fun updateUserGroup(id: Long, groupName: String): UserGroupResponse {
        val group = userGroupRepository.findById(id).orElseThrow { IllegalArgumentException("用户组不存在") }
        group.groupName = groupName
        return userGroupRepository.save(group).toResponse()
    }

    @Transactional
    @Auditable(type = AuditActionType.USER_GROUP_DELETE, content = "删除用户组")
    fun deleteUserGroup(id: Long) {
        if (!userGroupRepository.existsById(id)) {
            throw IllegalArgumentException("用户组不存在")
        }
        userGroupRepository.deleteById(id)
    }

    @Transactional
    @Auditable(type = AuditActionType.USER_GROUP_MEMBERS_UPDATE, content = "设置用户组成员")
    fun setGroupMembers(id: Long, userUuids: List<String>): UserGroupResponse {
        val group = userGroupRepository.findById(id).orElseThrow { IllegalArgumentException("用户组不存在") }
        val uuids = userUuids.map { UUID.fromString(it) }
        group.users = userRepository.findAllById(uuids).toMutableSet()
        return userGroupRepository.save(group).toResponse()
    }

    @Transactional
    @Auditable(type = AuditActionType.USER_GROUP_MEMBER_REMOVE, content = "移除用户组成员")
    fun removeUserFromGroup(id: Long, uuid: UUID): UserGroupResponse {
        val group = userGroupRepository.findById(id).orElseThrow { IllegalArgumentException("用户组不存在") }
        group.users.removeIf { it.uuid == uuid }
        return userGroupRepository.save(group).toResponse()
    }

    private fun UserGroup.toResponse() = UserGroupResponse(
        id = id!!,
        groupName = groupName,
        userUuids = users.map { it.uuid.toString() }
    )
}
