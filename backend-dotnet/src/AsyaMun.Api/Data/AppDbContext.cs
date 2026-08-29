using AsyaMun.Api.Models;
using Microsoft.EntityFrameworkCore;

#pragma warning disable CS0618

namespace AsyaMun.Api.Data;

public partial class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Attachment> Attachments { get; set; }

    public virtual DbSet<AuditLog> AuditLogs { get; set; }

    public virtual DbSet<Conference> Conferences { get; set; }

    public virtual DbSet<DelegateAttrConfig> DelegateAttrConfigs { get; set; }

    public virtual DbSet<DelegateAttrRecord> DelegateAttrRecords { get; set; }

    public virtual DbSet<DelegateAttrValue> DelegateAttrValues { get; set; }

    public virtual DbSet<Instruction> Instructions { get; set; }

    public virtual DbSet<Message> Messages { get; set; }

    public virtual DbSet<MessageReceiver> MessageReceivers { get; set; }

    public virtual DbSet<Round> Rounds { get; set; }

    public virtual DbSet<SystemConfig> SystemConfigs { get; set; }

    public virtual DbSet<TimeAnchor> TimeAnchors { get; set; }

    public virtual DbSet<User> Users { get; set; }

    public virtual DbSet<UserGroup> UserGroups { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Attachment>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("attachments_pkey");

            entity.ToTable("attachments");

            entity.HasIndex(e => e.MessageId, "idx_attachment_message_id");

            entity.HasIndex(e => new { e.TargetType, e.TargetId }, "idx_attachment_target");

            entity.Property(e => e.Uuid)
                .ValueGeneratedNever()
                .HasColumnName("uuid");
            entity.Property(e => e.FileBlob)
                .HasColumnType("oid")
                .HasColumnName("file_blob");
            entity.Property(e => e.FileName)
                .HasMaxLength(255)
                .HasColumnName("file_name");
            entity.Property(e => e.FileSize).HasColumnName("file_size");
            entity.Property(e => e.FileType)
                .HasMaxLength(20)
                .HasColumnName("file_type");
            entity.Property(e => e.MessageId).HasColumnName("message_id");
            entity.Property(e => e.TargetId).HasColumnName("target_id");
            entity.Property(e => e.TargetType).HasColumnName("target_type");

            entity.HasCheckConstraint("chk_attachments_file_name_not_blank", "btrim(file_name) <> ''");
            entity.HasCheckConstraint("chk_attachments_file_type_not_blank", "btrim(file_type) <> ''");
            entity.HasCheckConstraint("chk_attachments_file_size_non_negative", "file_size >= 0");
            entity.HasCheckConstraint("chk_attachments_target_pair", "(target_type is null and target_id is null) or (target_type = 'ANNOUNCEMENT' and target_id is null) or (target_type is not null and target_id is not null)");
            entity.HasCheckConstraint("chk_attachments_message_target_consistency", "message_id is null or (target_type = 'MESSAGE' and target_id is not null)");

            entity.HasOne(d => d.Message).WithMany(p => p.Attachments)
                .HasForeignKey(d => d.MessageId)
                .HasConstraintName("fk_attachments_message");
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("audit_logs_pkey");

            entity.ToTable("audit_logs");

            entity.HasIndex(e => e.ActorUuid, "idx_audit_logs_actor_uuid");

            entity.HasIndex(e => e.ActionType, "idx_audit_logs_action_type");

            entity.HasIndex(e => e.EventTime, "idx_audit_logs_event_time").IsDescending();

            entity.HasIndex(e => e.Success, "idx_audit_logs_success");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ActorIp)
                .HasMaxLength(45)
                .HasColumnName("actor_ip");
            entity.Property(e => e.ActorName)
                .HasMaxLength(120)
                .HasColumnName("actor_name");
            entity.Property(e => e.ActorUuid).HasColumnName("actor_uuid");
            entity.Property(e => e.ActionType).HasColumnName("action_type");
            entity.Property(e => e.ContextData).HasColumnName("context_data");
            entity.Property(e => e.EventContent).HasColumnName("event_content");
            entity.Property(e => e.EventTime)
                .HasColumnType("timestamp(6) without time zone")
                .HasColumnName("event_time");
            entity.Property(e => e.RequestMethod)
                .HasMaxLength(10)
                .HasColumnName("request_method");
            entity.Property(e => e.RequestPath)
                .HasMaxLength(255)
                .HasColumnName("request_path");
            entity.Property(e => e.RequestQuery)
                .HasMaxLength(1000)
                .HasColumnName("request_query");
            entity.Property(e => e.ResourceId)
                .HasMaxLength(120)
                .HasColumnName("resource_id");
            entity.Property(e => e.ResourceType)
                .HasMaxLength(80)
                .HasColumnName("resource_type");
            entity.Property(e => e.Success).HasColumnName("success");
            entity.Property(e => e.UserAgent)
                .HasMaxLength(300)
                .HasColumnName("user_agent");

            entity.HasCheckConstraint("chk_audit_logs_event_content_not_blank", "btrim(event_content) <> ''");
        });

        modelBuilder.Entity<Conference>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("conferences_pkey");

            entity.ToTable("conferences");

            entity.Property(e => e.Uuid)
                .ValueGeneratedNever()
                .HasColumnName("uuid");
            entity.Property(e => e.Description)
                .HasMaxLength(255)
                .HasColumnName("description");
            entity.Property(e => e.InstructionSubmissionPaused).HasColumnName("instruction_submission_paused");
            entity.Property(e => e.Name)
                .HasMaxLength(255)
                .HasColumnName("name");
            entity.Property(e => e.Status).HasColumnName("status");

            entity.HasCheckConstraint("chk_conferences_name_not_blank", "btrim(name) <> ''");
            entity.HasCheckConstraint("chk_conferences_description_not_blank", "btrim(description) <> ''");
        });

        modelBuilder.Entity<DelegateAttrConfig>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("delegate_attr_configs_pkey");

            entity.ToTable("delegate_attr_configs");

            entity.HasIndex(e => new { e.ConferenceId, e.Enabled, e.SortOrder, e.Id }, "idx_delegate_attr_configs_conference_enabled_sort");

            entity.HasIndex(e => new { e.ConferenceId, e.SortOrder, e.Id }, "idx_delegate_attr_configs_conference_sort");

            entity.HasIndex(e => new { e.ConferenceId, e.AttrKey }, "uk_delegate_attr_config_conference_key").IsUnique();

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("id");
            entity.Property(e => e.AttrKey)
                .HasMaxLength(80)
                .HasColumnName("attr_key");
            entity.Property(e => e.AttrLabel)
                .HasMaxLength(120)
                .HasColumnName("attr_label");
            entity.Property(e => e.AttrType).HasColumnName("attr_type");
            entity.Property(e => e.ConferenceId).HasColumnName("conference_id");
            entity.Property(e => e.CreatedAt)
                .HasColumnType("timestamp(6) without time zone")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.Enabled).HasColumnName("enabled");
            entity.Property(e => e.SortOrder).HasColumnName("sort_order");
            entity.Property(e => e.UpdatedAt)
                .HasColumnType("timestamp(6) without time zone")
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy).HasColumnName("updated_by");
            entity.Property(e => e.Visible)
                .HasDefaultValue(true)
                .HasColumnName("visible");

            entity.HasCheckConstraint("chk_delegate_attr_configs_key_not_blank", "btrim(attr_key) <> ''");
            entity.HasCheckConstraint("chk_delegate_attr_configs_label_not_blank", "btrim(attr_label) <> ''");

            entity.HasOne(d => d.Conference).WithMany(p => p.DelegateAttrConfigs)
                .HasForeignKey(d => d.ConferenceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_delegate_attr_configs_conference");
        });

        modelBuilder.Entity<DelegateAttrRecord>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("delegate_attr_records_pkey");

            entity.ToTable("delegate_attr_records");

            entity.HasIndex(e => e.ConferenceId, "idx_delegate_attr_records_conference");

            entity.HasIndex(e => new { e.DelegateId, e.ConferenceId, e.CreatedAt, e.Id }, "idx_delegate_attr_records_delegate_conference").IsDescending(false, false, true, true);

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("id");
            entity.Property(e => e.ConferenceId).HasColumnName("conference_id");
            entity.Property(e => e.CreatedAt)
                .HasColumnType("timestamp(6) without time zone")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.DelegateId).HasColumnName("delegate_id");
            entity.Property(e => e.UpdatedAt)
                .HasColumnType("timestamp(6) without time zone")
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy).HasColumnName("updated_by");

            entity.HasOne(d => d.Conference).WithMany(p => p.DelegateAttrRecords)
                .HasForeignKey(d => d.ConferenceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_delegate_attr_records_conference");

            entity.HasOne(d => d.Delegate).WithMany(p => p.DelegateAttrRecords)
                .HasForeignKey(d => d.DelegateId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_delegate_attr_records_delegate");
        });

        modelBuilder.Entity<DelegateAttrValue>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("delegate_attr_values_pkey");

            entity.ToTable("delegate_attr_values");

            entity.HasIndex(e => e.AttrConfigId, "idx_delegate_attr_values_attr_config");

            entity.HasIndex(e => new { e.RecordId, e.AttrConfigId }, "uk_delegate_attr_value_record_config").IsUnique();

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("id");
            entity.Property(e => e.AttrConfigId).HasColumnName("attr_config_id");
            entity.Property(e => e.RecordId).HasColumnName("record_id");
            entity.Property(e => e.ValueNumber)
                .HasPrecision(20, 6)
                .HasColumnName("value_number");
            entity.Property(e => e.ValueText)
                .HasMaxLength(1000)
                .HasColumnName("value_text");

            entity.HasCheckConstraint("chk_delegate_attr_values_not_both_null", "value_text is not null or value_number is not null");
            entity.HasCheckConstraint("chk_delegate_attr_values_text_not_blank", "value_text is null or btrim(value_text) <> ''");

            entity.HasOne(d => d.AttrConfig).WithMany(p => p.DelegateAttrValues)
                .HasForeignKey(d => d.AttrConfigId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_delegate_attr_values_attr_config");

            entity.HasOne(d => d.Record).WithMany(p => p.DelegateAttrValues)
                .HasForeignKey(d => d.RecordId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_delegate_attr_values_record");
        });

modelBuilder.Entity<Instruction>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("instructions_pkey");

            entity.ToTable("instructions");

            entity.HasIndex(e => e.ReviewedBy, "idx_instructions_reviewed_by");

            entity.HasIndex(e => new { e.SubmitterId, e.Status, e.SubmitRealTime, e.Uuid }, "idx_instructions_submitter_status_time").IsDescending(false, false, true, true);

            entity.HasIndex(e => new { e.ConferenceId, e.Status, e.InstructionType, e.SubmitRealTime, e.Uuid }, "idx_instructions_conference_query").IsDescending(false, false, false, true, true);

            entity.Property(e => e.Uuid)
                .ValueGeneratedNever()
                .HasColumnName("uuid");
            entity.Property(e => e.ConferenceId).HasColumnName("conference_id");
            entity.Property(e => e.InstructionContent).HasColumnName("instruction_content");
            entity.Property(e => e.InstructionType).HasColumnName("instruction_type");
            entity.Property(e => e.ReviewComment).HasColumnName("review_comment");
            entity.Property(e => e.ReviewedBy).HasColumnName("reviewed_by");
            entity.Property(e => e.ReviewedGameTime)
                .HasMaxLength(255)
                .HasColumnName("reviewed_game_time");
            entity.Property(e => e.ReviewedRealTime)
                .HasColumnType("timestamp(6) without time zone")
                .HasColumnName("reviewed_real_time");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.SubmitGameTime)
                .HasMaxLength(255)
                .HasColumnName("submit_game_time");
            entity.Property(e => e.SubmitRealTime)
                .HasColumnType("timestamp(6) without time zone")
                .HasColumnName("submit_real_time");
            entity.Property(e => e.SubmitterId).HasColumnName("submitter_id");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");

            entity.HasCheckConstraint("chk_instructions_title_not_blank", "btrim(title) <> ''");
            entity.HasCheckConstraint("chk_instructions_content_not_blank", "btrim(instruction_content) <> ''");
            entity.HasCheckConstraint("chk_instructions_submit_game_time_not_blank", "btrim(submit_game_time) <> ''");
            entity.HasCheckConstraint("chk_instructions_reviewed_game_time_not_blank", "reviewed_game_time is null or btrim(reviewed_game_time) <> ''");
            entity.HasCheckConstraint("chk_instructions_review_payload", "(reviewed_by is null and reviewed_real_time is null and reviewed_game_time is null) or reviewed_by is not null");

            entity.HasOne(d => d.Conference).WithMany(p => p.Instructions)
                .HasForeignKey(d => d.ConferenceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_instructions_conference");

            entity.HasOne(d => d.ReviewedByNavigation).WithMany(p => p.InstructionReviewedByNavigations)
                .HasForeignKey(d => d.ReviewedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_instructions_reviewed_by");

            entity.HasOne(d => d.Submitter).WithMany(p => p.InstructionSubmitters)
                .HasForeignKey(d => d.SubmitterId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_instructions_submitter");
        });

        modelBuilder.Entity<Message>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("messages_pkey");

            entity.ToTable("messages");

            entity.HasIndex(e => new { e.ConferenceId, e.IsSecret, e.PublishRealTime }, "idx_messages_conference_public_time").IsDescending(false, false, true);

            entity.HasIndex(e => new { e.ConferenceId, e.SenderId }, "idx_messages_conference_sender");

            entity.HasIndex(e => new { e.IsSecret, e.PublishRealTime }, "idx_messages_secret_lookup").IsDescending(false, true);

            entity.Property(e => e.Uuid)
                .ValueGeneratedNever()
                .HasColumnName("uuid");
            entity.Property(e => e.Brief)
                .HasMaxLength(500)
                .HasColumnName("brief");
            entity.Property(e => e.ConferenceId).HasColumnName("conference_id");
            entity.Property(e => e.IsSecret).HasColumnName("is_secret");
            entity.Property(e => e.MsgContent).HasColumnName("msg_content");
            entity.Property(e => e.MsgType).HasColumnName("msg_type");
            entity.Property(e => e.PublishGameTime)
                .HasMaxLength(255)
                .HasColumnName("publish_game_time");
            entity.Property(e => e.PublishRealTime)
                .HasColumnType("timestamp(6) without time zone")
                .HasColumnName("publish_real_time");
            entity.Property(e => e.SenderId).HasColumnName("sender_id");
            entity.Property(e => e.Title)
                .HasMaxLength(200)
                .HasColumnName("title");

            entity.HasCheckConstraint("chk_messages_publish_game_time_not_blank", "btrim(publish_game_time) <> ''");
            entity.HasCheckConstraint("chk_messages_title_not_blank", "title is null or btrim(title) <> ''");
            entity.HasCheckConstraint("chk_messages_brief_not_blank", "brief is null or btrim(brief) <> ''");

            entity.HasOne(d => d.Conference).WithMany(p => p.Messages)
                .HasForeignKey(d => d.ConferenceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_messages_conference");

            entity.HasOne(d => d.Sender).WithMany(p => p.Messages)
                .HasForeignKey(d => d.SenderId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_messages_sender");
        });

        modelBuilder.Entity<MessageReceiver>(entity =>
        {
            entity.HasKey(e => new { e.MessageId, e.UserId }).HasName("message_receivers_pkey");

            entity.ToTable("message_receivers");

            entity.HasIndex(e => new { e.UserId, e.ReadableAt }, "idx_message_receivers_user_readable");

            entity.Property(e => e.MessageId).HasColumnName("message_id");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.ReadableAt)
                .HasColumnType("timestamp(6) without time zone")
                .HasColumnName("readable_at");

            entity.HasOne(d => d.Message).WithMany(p => p.MessageReceivers)
                .HasForeignKey(d => d.MessageId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_message_receivers_message");

            entity.HasOne(d => d.User).WithMany(p => p.MessageReceivers)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_message_receivers_user");
        });

        modelBuilder.Entity<Round>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("rounds_pkey");

            entity.ToTable("rounds");

            entity.HasIndex(e => new { e.ConferenceId, e.IsCurrent }, "idx_round_conference_current");

            entity.HasIndex(e => new { e.ConferenceId, e.UpdatedAt }, "idx_round_conference_updated_at").IsDescending(false, true);

            entity.HasIndex(e => e.EndAt, "idx_round_end_at");

            entity.HasIndex(e => new { e.Status, e.EndAt }, "idx_round_expired_current").HasFilter("is_current");

            entity.HasIndex(e => e.ConferenceId, "uk_rounds_one_current_per_conference")
                .IsUnique()
                .HasFilter("is_current");

            entity.Property(e => e.Uuid)
                .ValueGeneratedNever()
                .HasColumnName("uuid");
            entity.Property(e => e.ConferenceId).HasColumnName("conference_id");
            entity.Property(e => e.DurationSeconds).HasColumnName("duration_seconds");
            entity.Property(e => e.EndAt)
                .HasColumnType("timestamp(6) without time zone")
                .HasColumnName("end_at");
            entity.Property(e => e.IsCurrent).HasColumnName("is_current");
            entity.Property(e => e.Name)
                .HasMaxLength(255)
                .HasColumnName("name");
            entity.Property(e => e.NextRoundId).HasColumnName("next_round_id");

            entity.HasCheckConstraint("chk_rounds_name_not_blank", "btrim(name) <> ''");
            entity.HasCheckConstraint("chk_rounds_duration_non_negative", "duration_seconds >= 0");
            entity.HasCheckConstraint("chk_rounds_remaining_non_negative", "remaining_seconds >= 0");
            entity.HasCheckConstraint("chk_rounds_remaining_not_exceed_duration", "remaining_seconds <= duration_seconds");
            entity.HasCheckConstraint("chk_rounds_next_round_not_self", "next_round_id is null or next_round_id <> uuid");
            entity.Property(e => e.RemainingSeconds).HasColumnName("remaining_seconds");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasColumnType("timestamp(6) without time zone")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Conference).WithOne(p => p.Round)
                .HasForeignKey<Round>(d => d.ConferenceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_rounds_conference");

            entity.HasOne(d => d.NextRound).WithMany(p => p.InverseNextRound)
                .HasForeignKey(d => d.NextRoundId)
                .HasConstraintName("fk_rounds_next_round");
        });

        modelBuilder.Entity<SystemConfig>(entity =>
        {
            entity.HasKey(e => e.ConfigKey).HasName("system_configs_pkey");

            entity.ToTable("system_configs");

            entity.Property(e => e.ConfigKey)
                .HasMaxLength(50)
                .HasColumnName("config_key");
            entity.Property(e => e.ConfigValue)
                .HasMaxLength(255)
                .HasColumnName("config_value");
            entity.Property(e => e.Description)
                .HasMaxLength(255)
                .HasColumnName("description");

            entity.HasCheckConstraint("chk_system_configs_key_not_blank", "btrim(config_key) <> ''");
            entity.HasCheckConstraint("chk_system_configs_value_not_blank", "btrim(config_value) <> ''");
        });

        modelBuilder.Entity<TimeAnchor>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("time_anchors_pkey");

            entity.ToTable("time_anchors");

            entity.HasIndex(e => new { e.ConferenceId, e.IsCurrent }, "idx_time_anchors_conference_current");

            entity.HasIndex(e => new { e.ConferenceId, e.Id }, "idx_time_anchors_conference_id").IsDescending(false, true);

            entity.HasIndex(e => e.ConferenceId, "uk_time_anchors_one_current_per_conference")
                .IsUnique()
                .HasFilter("is_current");

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.AnchorGameTime)
                .HasMaxLength(255)
                .HasColumnName("anchor_game_time");
            entity.Property(e => e.AnchorRealTime)
                .HasColumnType("timestamp(6) without time zone")
                .HasColumnName("anchor_real_time");
            entity.Property(e => e.ConferenceId).HasColumnName("conference_id");
            entity.Property(e => e.IsCurrent).HasColumnName("is_current");
            entity.Property(e => e.TimeRatio)
                .HasPrecision(10, 2)
                .HasColumnName("time_ratio");
            entity.Property(e => e.UpdateTime)
                .HasColumnType("timestamp(6) without time zone")
                .HasColumnName("update_time");

            entity.HasCheckConstraint("chk_time_anchors_ratio_non_negative", "time_ratio is null or time_ratio >= 0");
            entity.HasCheckConstraint("chk_time_anchors_payload_all_or_none", "(anchor_real_time is null and anchor_game_time is null and time_ratio is null) or (anchor_real_time is not null and anchor_game_time is not null and time_ratio is not null)");

            entity.HasOne(d => d.Conference).WithOne(p => p.TimeAnchor)
                .HasForeignKey<TimeAnchor>(d => d.ConferenceId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("fk_time_anchors_conference");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Uuid).HasName("users_pkey");

            entity.ToTable("users");

            entity.HasIndex(e => e.ConferenceId, "idx_users_conference_id");

            entity.HasIndex(e => e.Name, "uk_users_name").IsUnique();

            entity.HasIndex(e => e.Role, "idx_users_role");

            entity.Property(e => e.Uuid)
                .ValueGeneratedNever()
                .HasColumnName("uuid");
            entity.Property(e => e.AuthVersion).HasColumnName("auth_version");
            entity.Property(e => e.ConferenceId).HasColumnName("conference_id");
            entity.Property(e => e.DisplayName)
                .HasMaxLength(255)
                .HasColumnName("display_name");
            entity.Property(e => e.Name)
                .HasMaxLength(255)
                .HasColumnName("name");
            entity.Property(e => e.Password)
                .HasMaxLength(255)
                .HasColumnName("password");
            entity.Property(e => e.Role).HasColumnName("role");

            entity.HasCheckConstraint("chk_users_name_not_blank", "btrim(name) <> ''");
            entity.HasCheckConstraint("chk_users_password_not_blank", "btrim(password) <> ''");
            entity.HasCheckConstraint("chk_users_display_name_not_blank", "display_name is null or btrim(display_name) <> ''");

            entity.HasOne(d => d.Conference).WithMany(p => p.Users)
                .HasForeignKey(d => d.ConferenceId)
                .HasConstraintName("fk_users_conference");
        });

        modelBuilder.Entity<UserGroup>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("user_groups_pkey");

            entity.ToTable("user_groups");

            entity.HasIndex(e => e.GroupName, "uk_user_groups_group_name").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.GroupName)
                .HasMaxLength(120)
                .HasColumnName("group_name");

            entity.HasCheckConstraint("chk_user_groups_group_name_not_blank", "btrim(group_name) <> ''");

            entity.HasMany(d => d.UserUus).WithMany(p => p.Groups)
                .UsingEntity<Dictionary<string, object>>(
                    "UserGroupMember",
r => r.HasOne<User>().WithMany()
                        .HasForeignKey("UserUuid")
                        .OnDelete(DeleteBehavior.Cascade)
                        .HasConstraintName("fk_user_group_members_user"),
                    l => l.HasOne<UserGroup>().WithMany()
                        .HasForeignKey("GroupId")
                        .OnDelete(DeleteBehavior.ClientSetNull)
                        .HasConstraintName("fk_user_group_members_group"),
                    j =>
                    {
                        j.HasKey("GroupId", "UserUuid").HasName("user_group_members_pkey");
                        j.ToTable("user_group_members");
                        j.HasIndex(new[] { "UserUuid" }, "idx_user_group_members_user_uuid");
                        j.IndexerProperty<long>("GroupId").HasColumnName("group_id");
                        j.IndexerProperty<Guid>("UserUuid").HasColumnName("user_uuid");
                    });
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
