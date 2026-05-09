package top.bearingwall.asya.controller

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import top.bearingwall.asya.dto.BizCode
import top.bearingwall.asya.dto.Result
import top.bearingwall.asya.dto.UserGroupMembersRequest
import top.bearingwall.asya.dto.UserGroupRequest
import top.bearingwall.asya.dto.UserGroupResponse
import top.bearingwall.asya.model.UserGroup
import top.bearingwall.asya.model.UserRole
import top.bearingwall.asya.repository.UserGroupRepository
import top.bearingwall.asya.service.UserGroupService
import top.bearingwall.asya.util.JwtUtil
import java.util.UUID

@RestController
@RequestMapping("/api/user-groups")
@Tag(name = "用户组管理")
class UserGroupController(
    private val userGroupRepository: UserGroupRepository,
    private val userGroupService: UserGroupService
) {

    private val allowedWriteRoles = setOf(UserRole.DH.name, UserRole.DM.name, UserRole.SYS_ADMIN.name)

    /** 验证 token 有效，返回角色；token 无效则抛异常 */
    private fun requireAuth(authorization: String): String {
        val prefix = "Bearer "
        if (!authorization.startsWith(prefix)) throw IllegalArgumentException("Authorization header 格式错误")
        val token = authorization.removePrefix(prefix).trim()
        val parsed = JwtUtil.parseToken(token)
        return parsed.claims["role"]?.toString() ?: ""
    }

    /** 验证调用方具有写/删权限（DH / DM / SYS_ADMIN） */
    private fun requireWriteRole(authorization: String) {
        val role = requireAuth(authorization)
        if (role !in allowedWriteRoles) throw SecurityException("权限不足，需要 DH / DM / SYS_ADMIN 角色")
    }

    @Operation(summary = "创建用户组", description = "需要 DH / DM / SYS_ADMIN 角色")
    @PostMapping
    fun createUserGroup(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @RequestBody req: UserGroupRequest
    ): ResponseEntity<Result<UserGroupResponse>> {
        return try {
            requireWriteRole(authorization)
            ResponseEntity.status(HttpStatus.CREATED).body(Result.success(userGroupService.createUserGroup(req.groupName)))
        } catch (e: SecurityException) {
            ResponseEntity.status(HttpStatus.FORBIDDEN).body(Result.failure(BizCode.PERMISSION_DENIED, e.message ?: "权限不足"))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "创建失败"))
        }
    }

    @Operation(summary = "获取所有用户组", description = "需要登录")
    @GetMapping
    fun getAllUserGroups(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<Result<List<UserGroupResponse>>> {
        return try {
            requireAuth(authorization)
            val groups = userGroupRepository.findAll().map { it.toResponse() }
            ResponseEntity.ok(Result.success(groups))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "认证失败"))
        }
    }

    @Operation(summary = "获取用户组详情", description = "需要登录")
    @GetMapping("/{id}")
    fun getUserGroup(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable id: Long
    ): ResponseEntity<Result<UserGroupResponse>> {
        return try {
            requireAuth(authorization)
            val group = userGroupRepository.findById(id).orElseThrow { IllegalArgumentException("用户组不存在") }
            ResponseEntity.ok(Result.success(group.toResponse()))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "用户组不存在"))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.TOKEN_INVALID, e.message ?: "认证失败"))
        }
    }

    @Operation(summary = "更新用户组名称", description = "需要 DH / DM / SYS_ADMIN 角色")
    @PutMapping("/{id}")
    fun updateUserGroup(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable id: Long,
        @RequestBody req: UserGroupRequest
    ): ResponseEntity<Result<UserGroupResponse>> {
        return try {
            requireWriteRole(authorization)
            ResponseEntity.ok(Result.success(userGroupService.updateUserGroup(id, req.groupName)))
        } catch (e: SecurityException) {
            ResponseEntity.status(HttpStatus.FORBIDDEN).body(Result.failure(BizCode.PERMISSION_DENIED, e.message ?: "权限不足"))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "用户组不存在"))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "更新失败"))
        }
    }

    @Operation(summary = "删除用户组", description = "需要 DH / DM / SYS_ADMIN 角色")
    @DeleteMapping("/{id}")
    fun deleteUserGroup(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable id: Long
    ): ResponseEntity<Result<Unit>> {
        return try {
            requireWriteRole(authorization)
            userGroupService.deleteUserGroup(id)
            ResponseEntity.ok(Result.success(Unit))
        } catch (e: SecurityException) {
            ResponseEntity.status(HttpStatus.FORBIDDEN).body(Result.failure(BizCode.PERMISSION_DENIED, e.message ?: "权限不足"))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "删除失败"))
        }
    }

    @Operation(summary = "设置用户组成员（全量替换）", description = "需要 DH / DM / SYS_ADMIN 角色")
    @PostMapping("/{id}/users")
    fun setGroupMembers(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable id: Long,
        @RequestBody req: UserGroupMembersRequest
    ): ResponseEntity<Result<UserGroupResponse>> {
        return try {
            requireWriteRole(authorization)
            ResponseEntity.ok(Result.success(userGroupService.setGroupMembers(id, req.userUuids)))
        } catch (e: SecurityException) {
            ResponseEntity.status(HttpStatus.FORBIDDEN).body(Result.failure(BizCode.PERMISSION_DENIED, e.message ?: "权限不足"))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "参数错误"))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "操作失败"))
        }
    }

    @Operation(summary = "从用户组移除成员", description = "需要 DH / DM / SYS_ADMIN 角色")
    @DeleteMapping("/{id}/users/{uuid}")
    fun removeUserFromGroup(
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String,
        @PathVariable id: Long,
        @PathVariable uuid: UUID
    ): ResponseEntity<Result<UserGroupResponse>> {
        return try {
            requireWriteRole(authorization)
            ResponseEntity.ok(Result.success(userGroupService.removeUserFromGroup(id, uuid)))
        } catch (e: SecurityException) {
            ResponseEntity.status(HttpStatus.FORBIDDEN).body(Result.failure(BizCode.PERMISSION_DENIED, e.message ?: "权限不足"))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "用户组不存在"))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.OK).body(Result.failure(BizCode.PARAM_ERROR, e.message ?: "操作失败"))
        }
    }

    private fun UserGroup.toResponse() = UserGroupResponse(
        id = id!!,
        groupName = groupName,
        userUuids = users.map { it.uuid.toString() }
    )
}
