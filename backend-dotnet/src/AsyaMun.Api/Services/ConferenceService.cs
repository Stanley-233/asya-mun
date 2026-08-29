using AsyaMun.Api.Data;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Errors;
using AsyaMun.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AsyaMun.Api.Services;

public class ConferenceService
{
    private readonly AppDbContext _db;

    public ConferenceService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<ConferenceResponse> CreateConferenceAsync(User requester, ConferenceRequest request)
    {
        if (requester.Role != UserRole.SYS_ADMIN)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Only SYS_ADMIN can create conference");
        }

        var conference = new Conference
        {
            Uuid = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description,
            Status = request.Status ?? ConferenceStatus.PREPARING
        };

        _db.Conferences.Add(conference);
        await _db.SaveChangesAsync();

        return ToResponse(conference);
    }

    public async Task<ConferenceResponse> UpdateConferenceAsync(User requester, ConferenceRequest request)
    {
        if (requester.Role is not (UserRole.DH or UserRole.DM or UserRole.SYS_ADMIN))
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Only DH, DM, or SYS_ADMIN can update conference");
        }

        var user = await LoadRequesterAsync(requester);
        var conference = user.Conference
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Requester not associated with any conference");

        conference.Name = request.Name;
        conference.Description = request.Description;
        if (request.Status.HasValue)
        {
            conference.Status = request.Status.Value;
        }

        await _db.SaveChangesAsync();

        return ToResponse(conference);
    }

    public async Task<ConferenceResponse> GetMyConferenceAsync(User requester, CancellationToken ct = default)
    {
        var user = await LoadRequesterAsync(requester, ct);
        var conference = user.Conference
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Requester not associated with any conference");

        return ToResponse(conference);
    }

    public async Task<List<UserInfoResponse>> GetConferenceUsersAsync(User requester, CancellationToken ct = default)
    {
        var user = await LoadRequesterAsync(requester, ct);
        var conference = user.Conference
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Requester not associated with any conference");

        var members = await _db.Users
            .AsNoTracking()
            .Include(u => u.Conference)
            .Where(u => u.ConferenceId == conference.Uuid)
            .ToListAsync(ct);

        return members.Select(UserInfoResponse.From).ToList();
    }

    public async Task<Page<UserInfoResponse>> GetConferenceDelegatesAsync(
        User requester,
        PageInput input,
        string? name,
        string? displayName,
        CancellationToken ct = default)
    {
        var user = await LoadRequesterAsync(requester, ct);
        var conference = user.Conference
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Requester not associated with any conference");

        IQueryable<User> query = _db.Users
            .AsNoTracking()
            .Include(u => u.Conference)
            .Where(u => u.ConferenceId == conference.Uuid && u.Role == UserRole.DELEGATE);

        if (!string.IsNullOrWhiteSpace(name))
        {
            var keyword = name.Trim().ToLower();
            query = query.Where(u => u.Name.ToLower().Contains(keyword));
        }

        if (!string.IsNullOrWhiteSpace(displayName))
        {
            var keyword = displayName.Trim().ToLower();
            query = query.Where(u => u.DisplayName != null && u.DisplayName.ToLower().Contains(keyword));
        }

        var page = await query.ToPageAsync(input, ct);

        return Page<UserInfoResponse>.Of(
            page.Content.Select(UserInfoResponse.From).ToList(),
            page.Number,
            page.Size,
            page.TotalElements);
    }

    public async Task<List<ConferenceResponse>> ListAllAsync(User requester, CancellationToken ct = default)
    {
        if (requester.Role != UserRole.SYS_ADMIN)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Only SYS_ADMIN can list all conferences");
        }

        var conferences = await _db.Conferences.AsNoTracking().ToListAsync(ct);

        return conferences.Select(ToResponse).ToList();
    }

    public async Task<Page<ConferenceResponse>> ListPageAsync(
        User requester,
        PageInput input,
        CancellationToken ct = default)
    {
        if (requester.Role != UserRole.SYS_ADMIN)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Only SYS_ADMIN can list conferences");
        }

        var page = await _db.Conferences.AsNoTracking().ToPageAsync(input, ct);

        return Page<ConferenceResponse>.Of(
            page.Content.Select(ToResponse).ToList(),
            page.Number,
            page.Size,
            page.TotalElements);
    }

    public async Task<ConferenceResponse> UpdateConferenceByUuidAsync(
        User requester,
        Guid conferenceUuid,
        ConferenceRequest request,
        CancellationToken ct = default)
    {
        if (requester.Role != UserRole.SYS_ADMIN)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Only SYS_ADMIN can update conference by uuid");
        }

        var conference = await _db.Conferences.FirstOrDefaultAsync(c => c.Uuid == conferenceUuid, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, $"Conference not found: {conferenceUuid}");

        conference.Name = request.Name;
        conference.Description = request.Description;
        if (request.Status.HasValue)
        {
            conference.Status = request.Status.Value;
        }

        await _db.SaveChangesAsync(ct);

        return ToResponse(conference);
    }

    public async Task<UserInfoResponse> AssignUserToConferenceAsync(
        User requester,
        Guid conferenceUuid,
        Guid userUuid,
        CancellationToken ct = default)
    {
        if (requester.Role != UserRole.SYS_ADMIN)
        {
            throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Only SYS_ADMIN can assign users to conference");
        }

        var conference = await _db.Conferences.FirstOrDefaultAsync(c => c.Uuid == conferenceUuid, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Conference not found");

        var user = await _db.Users.Include(u => u.Conference).FirstOrDefaultAsync(u => u.Uuid == userUuid, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "User not found");

        user.ConferenceId = conference.Uuid;
        user.Conference = conference;

        await _db.SaveChangesAsync(ct);

        return UserInfoResponse.From(user);
    }

    public async Task<bool> IsInstructionSubmissionPausedAsync(Guid conferenceUuid, CancellationToken ct = default)
    {
        var conference = await _db.Conferences.AsNoTracking().FirstOrDefaultAsync(c => c.Uuid == conferenceUuid, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Conference not found");

        return conference.InstructionSubmissionPaused;
    }

    public async Task<ConferenceResponse> SetInstructionSubmissionPausedAsync(
        Guid conferenceUuid,
        bool paused,
        CancellationToken ct = default)
    {
        var conference = await _db.Conferences.FirstOrDefaultAsync(c => c.Uuid == conferenceUuid, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "Conference not found");

        conference.InstructionSubmissionPaused = paused;

        await _db.SaveChangesAsync(ct);

        return ToResponse(conference);
    }

    private async Task<User> LoadRequesterAsync(User requester, CancellationToken ct = default)
    {
        return await _db.Users.Include(u => u.Conference)
            .FirstOrDefaultAsync(u => u.Uuid == requester.Uuid, ct)
            ?? throw new AsyaBusinessException(BizCode.PARAM_ERROR, "User not found");
    }

    private static ConferenceResponse ToResponse(Conference conference)
    {
        return new ConferenceResponse(
            conference.Uuid.ToString("D"),
            conference.Name,
            conference.Description,
            conference.Status,
            conference.InstructionSubmissionPaused);
    }
}