using AsyaMun.Api.Data;
using AsyaMun.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AsyaMun.Api.Services;

public class SystemConfigService
{
    public const string KeyRegistrationAllowed = "REGISTRATION_ALLOWED";
    public const string KeyAnnouncementImageUuid = "ANNOUNCEMENT_IMAGE_UUID";

    private readonly AppDbContext _db;

    public SystemConfigService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<bool> IsRegistrationAllowedAsync()
    {
        var config = await _db.SystemConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.ConfigKey == KeyRegistrationAllowed);

        return config == null || bool.TryParse(config.ConfigValue, out var allowed) && allowed;
    }

    public async Task SetRegistrationAllowedAsync(bool allowed)
    {
        var config = await _db.SystemConfigs.FirstOrDefaultAsync(c => c.ConfigKey == KeyRegistrationAllowed);
        if (config == null)
        {
            config = new SystemConfig
            {
                ConfigKey = KeyRegistrationAllowed,
                ConfigValue = allowed.ToString(),
                Description = "全局用户注册开关"
            };
            _db.SystemConfigs.Add(config);
        }
        else
        {
            config.ConfigValue = allowed.ToString();
        }

        await _db.SaveChangesAsync();
    }

    public async Task<Guid?> GetAnnouncementImageUuidAsync()
    {
        var config = await _db.SystemConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.ConfigKey == KeyAnnouncementImageUuid);

        var raw = config?.ConfigValue?.Trim();
        if (string.IsNullOrEmpty(raw))
        {
            return null;
        }

        if (!Guid.TryParse(raw, out var uuid))
        {
            throw new InvalidOperationException("公告图配置无效");
        }

        return uuid;
    }

    public async Task SetAnnouncementImageUuidAsync(Guid? uuid)
    {
        if (!uuid.HasValue)
        {
            var existing = await _db.SystemConfigs
                .FirstOrDefaultAsync(c => c.ConfigKey == KeyAnnouncementImageUuid);
            if (existing != null)
            {
                _db.SystemConfigs.Remove(existing);
                await _db.SaveChangesAsync();
            }

            return;
        }

        var config = await _db.SystemConfigs.FirstOrDefaultAsync(c => c.ConfigKey == KeyAnnouncementImageUuid);
        if (config == null)
        {
            config = new SystemConfig
            {
                ConfigKey = KeyAnnouncementImageUuid,
                ConfigValue = uuid.Value.ToString("D"),
                Description = "当前公告图附件UUID"
            };
            _db.SystemConfigs.Add(config);
        }
        else
        {
            config.ConfigValue = uuid.Value.ToString("D");
        }

        await _db.SaveChangesAsync();
    }
}