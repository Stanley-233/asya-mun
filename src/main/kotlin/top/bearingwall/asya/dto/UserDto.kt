package top.bearingwall.asya.dto

import top.bearingwall.asya.model.UserRole

data class UserRegistrationRequest(
    val name: String,
    val password: String,
    val role: UserRole
)

data class UserResponse(
    val uuid: String,
    val name: String,
    val role: UserRole
)

