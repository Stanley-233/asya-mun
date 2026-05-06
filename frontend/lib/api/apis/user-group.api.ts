import { apiRequester } from '../client'
import type {
  UserGroupMembersRequest,
  UserGroupRequest,
  UserGroupResponse,
} from '../generated'

export async function getAllUserGroups() {
  return apiRequester.requestProtected<UserGroupResponse[]>({
    path: '/api/user-groups',
    method: 'GET',
  })
}

export async function createUserGroup(data: UserGroupRequest) {
  return apiRequester.requestProtected<void>({
    path: '/api/user-groups',
    method: 'POST',
    body: data,
  })
}

export async function updateUserGroup(id: number, data: UserGroupRequest) {
  return apiRequester.requestProtected<void>({
    path: `/api/user-groups/${id}`,
    method: 'PUT',
    body: data,
  })
}

export async function deleteUserGroup(id: number) {
  return apiRequester.requestProtected<void>({
    path: `/api/user-groups/${id}`,
    method: 'DELETE',
  })
}

export async function setGroupMembers(id: number, data: UserGroupMembersRequest) {
  return apiRequester.requestProtected<void>({
    path: `/api/user-groups/${id}/users`,
    method: 'POST',
    body: data,
  })
}
