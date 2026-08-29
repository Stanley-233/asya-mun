namespace AsyaMun.Api.Dtos;

public record UserGroupRequest(string GroupName);

public record UserGroupMembersRequest(List<string> UserUuids);

public record UserGroupResponse(long Id, string GroupName, List<string> UserUuids);