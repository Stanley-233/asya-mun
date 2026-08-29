using System.Globalization;
using AsyaMun.Api.Auth;
using AsyaMun.Api.Data;
using AsyaMun.Api.Dtos;
using AsyaMun.Api.Errors;
using AsyaMun.Api.Models;

namespace AsyaMun.Api.Services;

public class TestDataService
{
    private const string DefaultPassword = "123456";

    private readonly AppDbContext _db;

    public TestDataService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<TestDataBootstrapResponse> BootstrapScenarioAsync(User requester)
    {
        if (requester.Role != UserRole.SYS_ADMIN)
        {
            throw new ForbiddenException("Only SYS_ADMIN can bootstrap test data");
        }

        var now = NowUtc();
        var seed = now.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture);

        var conference = new Conference
        {
            Name = $"测试会议-{seed}",
            Description = "自动生成的联调测试会议",
            Status = ConferenceStatus.RUNNING
        };
        _db.Conferences.Add(conference);
        await _db.SaveChangesAsync();

        var dh = await CreateUserAsync($"seed_dh_{seed}", "DH", UserRole.DH, DefaultPassword, conference);
        var dm = await CreateUserAsync($"seed_dm_{seed}", "DM", UserRole.DM, DefaultPassword, conference);
        var delegateA = await CreateUserAsync($"seed_delegate_a_{seed}", "代表A", UserRole.DELEGATE, DefaultPassword, conference);
        var delegateB = await CreateUserAsync($"seed_delegate_b_{seed}", "代表B", UserRole.DELEGATE, DefaultPassword, conference);
        var delegateC = await CreateUserAsync($"seed_delegate_c_{seed}", "代表C", UserRole.DELEGATE, DefaultPassword, conference);

        _db.TimeAnchors.Add(new TimeAnchor
        {
            ConferenceId = conference.Uuid,
            UpdateTime = now,
            AnchorRealTime = now,
            AnchorGameTime = now.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture),
            TimeRatio = 1.00m,
            IsCurrent = true
        });

        var publicMessages = Enumerable.Range(1, 15).Select(index =>
        {
            var sender = index % 2 == 0 ? dh : dm;
            return new Message
            {
                Uuid = Guid.NewGuid(),
                ConferenceId = conference.Uuid,
                SenderId = sender.Uuid,
                Title = $"公开测试消息-{index}",
                Brief = $"公开测试消息摘要-{index}",
                MsgContent = $"这是自动生成的公开测试消息内容，第 {index} 条。",
                MsgType = PublicMessageType(index),
                PublishRealTime = now.AddMinutes(index),
                PublishGameTime = FormatGameTime(now.AddMinutes(index)),
                IsSecret = false
            };
        }).ToList();

        var secretMessages = new List<Message>();
        for (var index = 1; index <= 11; index++)
        {
            secretMessages.Add(SecretMessage(
                conference,
                dh,
                delegateA,
                index,
                now.AddMinutes(15 + index)));
        }

        for (var index = 1; index <= 4; index++)
        {
            secretMessages.Add(SecretMessage(
                conference,
                dm,
                delegateB,
                11 + index,
                now.AddMinutes(26 + index)));
        }

        var instructions = Enumerable.Range(1, 15).Select(index =>
        {
            var submitTime = now.AddMinutes(40 + index);
            return new Instruction
            {
                Uuid = Guid.NewGuid(),
                ConferenceId = conference.Uuid,
                SubmitterId = delegateA.Uuid,
                Title = $"A代表测试指令-{index}",
                InstructionType = TestInstructionType(index),
                InstructionContent = $"这是代表A自动生成的第 {index} 条测试指令。",
                Status = InstructionStatus.SUBMITTED,
                SubmitRealTime = submitTime,
                SubmitGameTime = FormatGameTime(submitTime)
            };
        }).ToList();

        _db.Messages.AddRange(publicMessages);
        _db.Messages.AddRange(secretMessages);
        _db.Instructions.AddRange(instructions);
        await _db.SaveChangesAsync();

        var users = new[] { dh, dm, delegateA, delegateB, delegateC }
            .Select(user => new TestDataUserResponse(
                user.Uuid.ToString("D"),
                user.Name,
                user.DisplayName,
                user.Role,
                DefaultPassword,
                JwtUtil.GenerateAccessToken(user.Uuid.ToString("D"), user.AuthVersion, user.Name, user.Role)))
            .ToList();

        return new TestDataBootstrapResponse(
            conference.Uuid.ToString("D"),
            conference.Name,
            users,
            publicMessages.Count,
            secretMessages.Count,
            11,
            4,
            instructions.Count,
            "1.00");
    }

    private async Task<User> CreateUserAsync(
        string name,
        string displayName,
        UserRole role,
        string rawPassword,
        Conference conference)
    {
        var user = new User
        {
            Name = name,
            DisplayName = displayName,
            Password = BCrypt.Net.BCrypt.HashPassword(rawPassword),
            Role = role,
            ConferenceId = conference.Uuid,
            AuthVersion = 0
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user;
    }

    private static Message SecretMessage(
        Conference conference,
        User sender,
        User receiver,
        int index,
        DateTime realTime)
    {
        var message = new Message
        {
            Uuid = Guid.NewGuid(),
            ConferenceId = conference.Uuid,
            SenderId = sender.Uuid,
            Title = $"非对称测试消息-{index}",
            Brief = $"定向投递给{receiver.DisplayName}",
            MsgContent = $"这是自动生成的第 {index} 条非对称测试消息，接收方为{receiver.DisplayName}。",
            MsgType = MessageType.SECRET_LETTER,
            PublishRealTime = realTime,
            PublishGameTime = FormatGameTime(realTime),
            IsSecret = true
        };
        message.MessageReceivers.Add(new MessageReceiver
        {
            UserId = receiver.Uuid,
            ReadableAt = realTime
        });
        return message;
    }

    private static MessageType PublicMessageType(int index)
    {
        return (index % 5) switch
        {
            0 => MessageType.EVENT,
            1 => MessageType.NEWS,
            2 => MessageType.CRISIS,
            3 => MessageType.WAR_REPORT,
            _ => MessageType.EVENT
        };
    }

    private static InstructionType TestInstructionType(int index)
    {
        return (index % 4) switch
        {
            0 => InstructionType.MILITARY,
            1 => InstructionType.DIPLOMACY,
            2 => InstructionType.INTERNAL,
            _ => InstructionType.OTHER
        };
    }

    private static string FormatGameTime(DateTime value)
    {
        return value.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture);
    }

    private static DateTime NowUtc()
    {
        return DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);
    }
}