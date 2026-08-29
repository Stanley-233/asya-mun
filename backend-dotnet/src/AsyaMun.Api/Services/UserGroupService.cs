using AsyaMun.Api.Data;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Errors;
using AsyaMun.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AsyaMun.Api.Services;

public class UserGroupService
{
    private readonly AppDbContext _db;

    public UserGroupService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<UserGroupResponse> CreateUserGroupAsync(string groupName, CancellationToken ct = default)
    {
        var group = new UserGroup { GroupName = groupName };

        _db.UserGroups.Add(group);
        await _db.SaveChangesAsync(ct);

        return ToResponse(group);
    }

    public async Task<List<UserGroupResponse>> GetAllUserGroupsAsync(CancellationToken ct = default)
    {
        var groups = await _db.UserGroups.AsNoTracking().Include(g => g.UserUus).ToListAsync(ct);

        return groups.Select(ToResponse).ToList();
    }

    public async Task<UserGroupResponse> GetUserGroupAsync(long id, CancellationToken ct = default)
    {
        var group = await _db.UserGroups.AsNoTracking().Include(g => g.UserUus)
            .FirstOrDefaultAsync(g => g.Id == id, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "用户组不存在");

        return ToResponse(group);
    }

    public async Task<UserGroupResponse> UpdateUserGroupAsync(long id, string groupName, CancellationToken ct = default)
    {
        var group = await _db.UserGroups.Include(g => g.UserUus).FirstOrDefaultAsync(g => g.Id == id, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "用户组不存在");

        group.GroupName = groupName;

        await _db.SaveChangesAsync(ct);

        return ToResponse(group);
    }

    public async Task DeleteUserGroupAsync(long id, CancellationToken ct = default)
    {
        var group = await _db.UserGroups.FirstOrDefaultAsync(g => g.Id == id, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "用户组不存在");

        _db.UserGroups.Remove(group);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<UserGroupResponse> SetGroupMembersAsync(long id, List<string> userUuids, CancellationToken ct = default)
    {
        var group = await _db.UserGroups.Include(g => g.UserUus).FirstOrDefaultAsync(g => g.Id == id, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "用户组不存在");

        var parsed = new List<Guid>();
        foreach (var raw in userUuids)
        {
            if (!Guid.TryParse(raw, out var guid))
            {
                throw new AsyaBusinessException(BizCode.PARAM_ERROR, "参数错误");
            }

            parsed.Add(guid);
        }

        var members = await _db.Users.Where(u => parsed.Contains(u.Uuid)).ToListAsync(ct);

        group.UserUus = members;

        await _db.SaveChangesAsync(ct);

        return ToResponse(group);
    }

    public async Task<UserGroupResponse> RemoveUserFromGroupAsync(long id, Guid uuid, CancellationToken ct = default)
    {
        var group = await _db.UserGroups.Include(g => g.UserUus).FirstOrDefaultAsync(g => g.Id == id, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "用户组不存在");

        var member = group.UserUus.FirstOrDefault(u => u.Uuid == uuid);
        if (member != null)
        {
            group.UserUus.Remove(member);
            await _db.SaveChangesAsync(ct);
        }

        return ToResponse(group);
    }

    private static UserGroupResponse ToResponse(UserGroup group)
    {
        return new UserGroupResponse(
            group.Id,
            group.GroupName,
            group.UserUus.Select(u => u.Uuid.ToString("D")).ToList());
    }
}