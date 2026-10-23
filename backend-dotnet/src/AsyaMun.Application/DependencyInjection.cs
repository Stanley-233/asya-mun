using AsyaMun.Application.Services;

namespace AsyaMun.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddAsyaApplication(this IServiceCollection services)
    {
        services.AddScoped<AuditLogService>();
        services.AddScoped<SystemConfigService>();
        services.AddScoped<UserService>();
        services.AddScoped<ConferenceService>();
        services.AddScoped<UserGroupService>();
        services.AddScoped<RoundService>();
        services.AddScoped<TimeService>();
        services.AddScoped<MessageService>();
        services.AddScoped<InstructionService>();
        services.AddScoped<AttachmentService>();
        services.AddScoped<AnnouncementService>();
        services.AddScoped<DelegateAttrService>();
        services.AddScoped<NotificationService>();
        services.AddScoped<TestDataService>();
        return services;
    }
}
