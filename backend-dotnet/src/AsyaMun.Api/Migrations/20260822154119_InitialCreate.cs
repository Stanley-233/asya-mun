using System;
using AsyaMun.Api.Models;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AsyaMun.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:public.attachmenttargettype", "ANNOUNCEMENT,DIRECTIVE,MESSAGE")
                .Annotation("Npgsql:Enum:public.auditactiontype", "ANNOUNCEMENT_IMAGE_UPDATE,ATTACHMENT_DELETE,ATTACHMENT_UPLOAD,CONFERENCE_ASSIGN_USER,CONFERENCE_CREATE,CONFERENCE_UPDATE,DELEGATE_ATTR_CONFIG_CREATE,DELEGATE_ATTR_CONFIG_UPDATE,DELEGATE_ATTR_RECORD_CREATE,DELEGATE_ATTR_RECORD_DELETE,DELEGATE_ATTR_RECORD_UPDATE,INSTRUCTION_CREATE,INSTRUCTION_REVIEW,INSTRUCTION_SUBMISSION_SWITCH,MESSAGE_CREATE,MESSAGE_DELETE,MESSAGE_UPDATE,ROUND_AUTO_ADVANCE,ROUND_PAUSE,ROUND_PUBLISH,ROUND_RESUME,ROUND_SET_CURRENT,ROUND_SET_NEXT,ROUND_SET_REMAINING,ROUND_UPDATE,TEST_DATA_BOOTSTRAP,TIMELINE_JUMP,TIMELINE_UPDATE,USER_BATCH_REGISTER,USER_BATCH_REGISTER_FULL,USER_DELETE,USER_GROUP_CREATE,USER_GROUP_DELETE,USER_GROUP_MEMBERS_UPDATE,USER_GROUP_MEMBER_REMOVE,USER_GROUP_UPDATE,USER_LOGIN,USER_PASSWORD_RESET,USER_REGISTER,USER_REGISTRATION_SWITCH,USER_UPDATE")
                .Annotation("Npgsql:Enum:public.conferencestatus", "COMPLETED,PREPARING,RUNNING")
                .Annotation("Npgsql:Enum:public.delegateattrtype", "NUMBER,TEXT")
                .Annotation("Npgsql:Enum:public.instructionstatus", "FEEDBACKED,IN_PROGRESS,REJECTED,SUBMITTED")
                .Annotation("Npgsql:Enum:public.instructiontype", "DIPLOMACY,ECONOMY,INTERNAL,MILITARY,OTHER")
                .Annotation("Npgsql:Enum:public.messagetype", "AMENDMENT,CRISIS,DECLARATION,EVENT,MEMORANDUM,NEWS,PROTOCOL,SECRET_LETTER,WAR_REPORT")
                .Annotation("Npgsql:Enum:public.roundstatus", "PAUSED,RUNNING")
                .Annotation("Npgsql:Enum:public.userrole", "DELEGATE,DH,DM,SYS_ADMIN");

            migrationBuilder.CreateTable(
                name: "audit_logs",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    actor_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    actor_uuid = table.Column<Guid>(type: "uuid", nullable: true),
                    actor_ip = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    request_method = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    request_path = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    request_query = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    user_agent = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    resource_type = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    resource_id = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    action_type = table.Column<AuditActionType>(type: "public.auditactiontype", nullable: false),
                    event_content = table.Column<string>(type: "text", nullable: false),
                    context_data = table.Column<string>(type: "text", nullable: true),
                    event_time = table.Column<DateTime>(type: "timestamp(6) without time zone", nullable: false),
                    success = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("audit_logs_pkey", x => x.id);
                    table.CheckConstraint("chk_audit_logs_event_content_not_blank", "btrim(event_content) <> ''");
                });

            migrationBuilder.CreateTable(
                name: "conferences",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    status = table.Column<ConferenceStatus>(type: "public.conferencestatus", nullable: false),
                    instruction_submission_paused = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("conferences_pkey", x => x.uuid);
                    table.CheckConstraint("chk_conferences_description_not_blank", "btrim(description) <> ''");
                    table.CheckConstraint("chk_conferences_name_not_blank", "btrim(name) <> ''");
                });

            migrationBuilder.CreateTable(
                name: "system_configs",
                columns: table => new
                {
                    config_key = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    config_value = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("system_configs_pkey", x => x.config_key);
                    table.CheckConstraint("chk_system_configs_key_not_blank", "btrim(config_key) <> ''");
                    table.CheckConstraint("chk_system_configs_value_not_blank", "btrim(config_value) <> ''");
                });

            migrationBuilder.CreateTable(
                name: "user_groups",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    group_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("user_groups_pkey", x => x.id);
                    table.CheckConstraint("chk_user_groups_group_name_not_blank", "btrim(group_name) <> ''");
                });

            migrationBuilder.CreateTable(
                name: "delegate_attr_configs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    attr_key = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    attr_label = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    attr_type = table.Column<DelegateAttrType>(type: "public.delegateattrtype", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp(6) without time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp(6) without time zone", nullable: false),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    conference_id = table.Column<Guid>(type: "uuid", nullable: false),
                    visible = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("delegate_attr_configs_pkey", x => x.id);
                    table.CheckConstraint("chk_delegate_attr_configs_key_not_blank", "btrim(attr_key) <> ''");
                    table.CheckConstraint("chk_delegate_attr_configs_label_not_blank", "btrim(attr_label) <> ''");
                    table.ForeignKey(
                        name: "fk_delegate_attr_configs_conference",
                        column: x => x.conference_id,
                        principalTable: "conferences",
                        principalColumn: "uuid");
                });

            migrationBuilder.CreateTable(
                name: "rounds",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    duration_seconds = table.Column<long>(type: "bigint", nullable: false),
                    end_at = table.Column<DateTime>(type: "timestamp(6) without time zone", nullable: true),
                    is_current = table.Column<bool>(type: "boolean", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    remaining_seconds = table.Column<long>(type: "bigint", nullable: false),
                    status = table.Column<RoundStatus>(type: "public.roundstatus", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp(6) without time zone", nullable: false),
                    conference_id = table.Column<Guid>(type: "uuid", nullable: false),
                    next_round_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("rounds_pkey", x => x.uuid);
                    table.CheckConstraint("chk_rounds_duration_non_negative", "duration_seconds >= 0");
                    table.CheckConstraint("chk_rounds_name_not_blank", "btrim(name) <> ''");
                    table.CheckConstraint("chk_rounds_next_round_not_self", "next_round_id is null or next_round_id <> uuid");
                    table.CheckConstraint("chk_rounds_remaining_non_negative", "remaining_seconds >= 0");
                    table.CheckConstraint("chk_rounds_remaining_not_exceed_duration", "remaining_seconds <= duration_seconds");
                    table.ForeignKey(
                        name: "fk_rounds_conference",
                        column: x => x.conference_id,
                        principalTable: "conferences",
                        principalColumn: "uuid");
                    table.ForeignKey(
                        name: "fk_rounds_next_round",
                        column: x => x.next_round_id,
                        principalTable: "rounds",
                        principalColumn: "uuid");
                });

            migrationBuilder.CreateTable(
                name: "time_anchors",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    anchor_game_time = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    anchor_real_time = table.Column<DateTime>(type: "timestamp(6) without time zone", nullable: true),
                    is_current = table.Column<bool>(type: "boolean", nullable: false),
                    time_ratio = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    update_time = table.Column<DateTime>(type: "timestamp(6) without time zone", nullable: true),
                    conference_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("time_anchors_pkey", x => x.id);
                    table.CheckConstraint("chk_time_anchors_payload_all_or_none", "(anchor_real_time is null and anchor_game_time is null and time_ratio is null) or (anchor_real_time is not null and anchor_game_time is not null and time_ratio is not null)");
                    table.CheckConstraint("chk_time_anchors_ratio_non_negative", "time_ratio is null or time_ratio >= 0");
                    table.ForeignKey(
                        name: "fk_time_anchors_conference",
                        column: x => x.conference_id,
                        principalTable: "conferences",
                        principalColumn: "uuid");
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    display_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    password = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    role = table.Column<UserRole>(type: "public.userrole", nullable: false),
                    conference_id = table.Column<Guid>(type: "uuid", nullable: true),
                    auth_version = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("users_pkey", x => x.uuid);
                    table.CheckConstraint("chk_users_display_name_not_blank", "display_name is null or btrim(display_name) <> ''");
                    table.CheckConstraint("chk_users_name_not_blank", "btrim(name) <> ''");
                    table.CheckConstraint("chk_users_password_not_blank", "btrim(password) <> ''");
                    table.ForeignKey(
                        name: "fk_users_conference",
                        column: x => x.conference_id,
                        principalTable: "conferences",
                        principalColumn: "uuid");
                });

            migrationBuilder.CreateTable(
                name: "delegate_attr_records",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp(6) without time zone", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp(6) without time zone", nullable: false),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    conference_id = table.Column<Guid>(type: "uuid", nullable: false),
                    delegate_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("delegate_attr_records_pkey", x => x.id);
                    table.ForeignKey(
                        name: "fk_delegate_attr_records_conference",
                        column: x => x.conference_id,
                        principalTable: "conferences",
                        principalColumn: "uuid");
                    table.ForeignKey(
                        name: "fk_delegate_attr_records_delegate",
                        column: x => x.delegate_id,
                        principalTable: "users",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "instructions",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    instruction_content = table.Column<string>(type: "text", nullable: false),
                    instruction_type = table.Column<InstructionType>(type: "public.instructiontype", nullable: false),
                    review_comment = table.Column<string>(type: "text", nullable: true),
                    reviewed_game_time = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    reviewed_real_time = table.Column<DateTime>(type: "timestamp(6) without time zone", nullable: true),
                    submit_game_time = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    submit_real_time = table.Column<DateTime>(type: "timestamp(6) without time zone", nullable: false),
                    status = table.Column<InstructionStatus>(type: "public.instructionstatus", nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    conference_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reviewed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    submitter_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("instructions_pkey", x => x.uuid);
                    table.CheckConstraint("chk_instructions_content_not_blank", "btrim(instruction_content) <> ''");
                    table.CheckConstraint("chk_instructions_review_payload", "(reviewed_by is null and reviewed_real_time is null and reviewed_game_time is null) or reviewed_by is not null");
                    table.CheckConstraint("chk_instructions_reviewed_game_time_not_blank", "reviewed_game_time is null or btrim(reviewed_game_time) <> ''");
                    table.CheckConstraint("chk_instructions_submit_game_time_not_blank", "btrim(submit_game_time) <> ''");
                    table.CheckConstraint("chk_instructions_title_not_blank", "btrim(title) <> ''");
                    table.ForeignKey(
                        name: "fk_instructions_conference",
                        column: x => x.conference_id,
                        principalTable: "conferences",
                        principalColumn: "uuid");
                    table.ForeignKey(
                        name: "fk_instructions_reviewed_by",
                        column: x => x.reviewed_by,
                        principalTable: "users",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_instructions_submitter",
                        column: x => x.submitter_id,
                        principalTable: "users",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "messages",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    brief = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    msg_content = table.Column<string>(type: "text", nullable: true),
                    is_secret = table.Column<bool>(type: "boolean", nullable: false),
                    msg_type = table.Column<MessageType>(type: "public.messagetype", nullable: true),
                    publish_game_time = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    publish_real_time = table.Column<DateTime>(type: "timestamp(6) without time zone", nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    conference_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sender_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("messages_pkey", x => x.uuid);
                    table.CheckConstraint("chk_messages_brief_not_blank", "brief is null or btrim(brief) <> ''");
                    table.CheckConstraint("chk_messages_publish_game_time_not_blank", "btrim(publish_game_time) <> ''");
                    table.CheckConstraint("chk_messages_title_not_blank", "title is null or btrim(title) <> ''");
                    table.ForeignKey(
                        name: "fk_messages_conference",
                        column: x => x.conference_id,
                        principalTable: "conferences",
                        principalColumn: "uuid");
                    table.ForeignKey(
                        name: "fk_messages_sender",
                        column: x => x.sender_id,
                        principalTable: "users",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "user_group_members",
                columns: table => new
                {
                    group_id = table.Column<long>(type: "bigint", nullable: false),
                    user_uuid = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("user_group_members_pkey", x => new { x.group_id, x.user_uuid });
                    table.ForeignKey(
                        name: "fk_user_group_members_group",
                        column: x => x.group_id,
                        principalTable: "user_groups",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_user_group_members_user",
                        column: x => x.user_uuid,
                        principalTable: "users",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "delegate_attr_values",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    value_number = table.Column<decimal>(type: "numeric(20,6)", precision: 20, scale: 6, nullable: true),
                    value_text = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    attr_config_id = table.Column<Guid>(type: "uuid", nullable: false),
                    record_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("delegate_attr_values_pkey", x => x.id);
                    table.CheckConstraint("chk_delegate_attr_values_not_both_null", "value_text is not null or value_number is not null");
                    table.CheckConstraint("chk_delegate_attr_values_text_not_blank", "value_text is null or btrim(value_text) <> ''");
                    table.ForeignKey(
                        name: "fk_delegate_attr_values_attr_config",
                        column: x => x.attr_config_id,
                        principalTable: "delegate_attr_configs",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_delegate_attr_values_record",
                        column: x => x.record_id,
                        principalTable: "delegate_attr_records",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "attachments",
                columns: table => new
                {
                    uuid = table.Column<Guid>(type: "uuid", nullable: false),
                    file_blob = table.Column<uint>(type: "oid", nullable: false),
                    file_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    file_size = table.Column<long>(type: "bigint", nullable: false),
                    file_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    target_id = table.Column<Guid>(type: "uuid", nullable: true),
                    target_type = table.Column<AttachmentTargetType>(type: "public.attachmenttargettype", nullable: true),
                    message_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("attachments_pkey", x => x.uuid);
                    table.CheckConstraint("chk_attachments_file_name_not_blank", "btrim(file_name) <> ''");
                    table.CheckConstraint("chk_attachments_file_size_non_negative", "file_size >= 0");
                    table.CheckConstraint("chk_attachments_file_type_not_blank", "btrim(file_type) <> ''");
                    table.CheckConstraint("chk_attachments_message_target_consistency", "message_id is null or (target_type = 'MESSAGE' and target_id is not null)");
                    table.CheckConstraint("chk_attachments_target_pair", "(target_type is null and target_id is null) or (target_type = 'ANNOUNCEMENT' and target_id is null) or (target_type is not null and target_id is not null)");
                    table.ForeignKey(
                        name: "fk_attachments_message",
                        column: x => x.message_id,
                        principalTable: "messages",
                        principalColumn: "uuid");
                });

            migrationBuilder.CreateTable(
                name: "message_receivers",
                columns: table => new
                {
                    message_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    readable_at = table.Column<DateTime>(type: "timestamp(6) without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("message_receivers_pkey", x => new { x.message_id, x.user_id });
                    table.ForeignKey(
                        name: "fk_message_receivers_message",
                        column: x => x.message_id,
                        principalTable: "messages",
                        principalColumn: "uuid");
                    table.ForeignKey(
                        name: "fk_message_receivers_user",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "uuid",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_attachment_message_id",
                table: "attachments",
                column: "message_id");

            migrationBuilder.CreateIndex(
                name: "idx_attachment_target",
                table: "attachments",
                columns: new[] { "target_type", "target_id" });

            migrationBuilder.CreateIndex(
                name: "idx_audit_logs_action_type",
                table: "audit_logs",
                column: "action_type");

            migrationBuilder.CreateIndex(
                name: "idx_audit_logs_actor_uuid",
                table: "audit_logs",
                column: "actor_uuid");

            migrationBuilder.CreateIndex(
                name: "idx_audit_logs_event_time",
                table: "audit_logs",
                column: "event_time",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "idx_audit_logs_success",
                table: "audit_logs",
                column: "success");

            migrationBuilder.CreateIndex(
                name: "idx_delegate_attr_configs_conference_enabled_sort",
                table: "delegate_attr_configs",
                columns: new[] { "conference_id", "enabled", "sort_order", "id" });

            migrationBuilder.CreateIndex(
                name: "idx_delegate_attr_configs_conference_sort",
                table: "delegate_attr_configs",
                columns: new[] { "conference_id", "sort_order", "id" });

            migrationBuilder.CreateIndex(
                name: "uk_delegate_attr_config_conference_key",
                table: "delegate_attr_configs",
                columns: new[] { "conference_id", "attr_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_delegate_attr_records_conference",
                table: "delegate_attr_records",
                column: "conference_id");

            migrationBuilder.CreateIndex(
                name: "idx_delegate_attr_records_delegate_conference",
                table: "delegate_attr_records",
                columns: new[] { "delegate_id", "conference_id", "created_at", "id" },
                descending: new[] { false, false, true, true });

            migrationBuilder.CreateIndex(
                name: "idx_delegate_attr_values_attr_config",
                table: "delegate_attr_values",
                column: "attr_config_id");

            migrationBuilder.CreateIndex(
                name: "uk_delegate_attr_value_record_config",
                table: "delegate_attr_values",
                columns: new[] { "record_id", "attr_config_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_instructions_conference_query",
                table: "instructions",
                columns: new[] { "conference_id", "status", "instruction_type", "submit_real_time", "uuid" },
                descending: new[] { false, false, false, true, true });

            migrationBuilder.CreateIndex(
                name: "idx_instructions_reviewed_by",
                table: "instructions",
                column: "reviewed_by");

            migrationBuilder.CreateIndex(
                name: "idx_instructions_submitter_status_time",
                table: "instructions",
                columns: new[] { "submitter_id", "status", "submit_real_time", "uuid" },
                descending: new[] { false, false, true, true });

            migrationBuilder.CreateIndex(
                name: "idx_message_receivers_user_readable",
                table: "message_receivers",
                columns: new[] { "user_id", "readable_at" });

            migrationBuilder.CreateIndex(
                name: "idx_messages_conference_public_time",
                table: "messages",
                columns: new[] { "conference_id", "is_secret", "publish_real_time" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "idx_messages_conference_sender",
                table: "messages",
                columns: new[] { "conference_id", "sender_id" });

            migrationBuilder.CreateIndex(
                name: "idx_messages_secret_lookup",
                table: "messages",
                columns: new[] { "is_secret", "publish_real_time" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_messages_sender_id",
                table: "messages",
                column: "sender_id");

            migrationBuilder.CreateIndex(
                name: "idx_round_conference_current",
                table: "rounds",
                columns: new[] { "conference_id", "is_current" });

            migrationBuilder.CreateIndex(
                name: "idx_round_conference_updated_at",
                table: "rounds",
                columns: new[] { "conference_id", "updated_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "idx_round_end_at",
                table: "rounds",
                column: "end_at");

            migrationBuilder.CreateIndex(
                name: "idx_round_expired_current",
                table: "rounds",
                columns: new[] { "status", "end_at" },
                filter: "is_current");

            migrationBuilder.CreateIndex(
                name: "IX_rounds_next_round_id",
                table: "rounds",
                column: "next_round_id");

            migrationBuilder.CreateIndex(
                name: "uk_rounds_one_current_per_conference",
                table: "rounds",
                column: "conference_id",
                unique: true,
                filter: "is_current");

            migrationBuilder.CreateIndex(
                name: "idx_time_anchors_conference_current",
                table: "time_anchors",
                columns: new[] { "conference_id", "is_current" });

            migrationBuilder.CreateIndex(
                name: "idx_time_anchors_conference_id",
                table: "time_anchors",
                columns: new[] { "conference_id", "id" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "uk_time_anchors_one_current_per_conference",
                table: "time_anchors",
                column: "conference_id",
                unique: true,
                filter: "is_current");

            migrationBuilder.CreateIndex(
                name: "idx_user_group_members_user_uuid",
                table: "user_group_members",
                column: "user_uuid");

            migrationBuilder.CreateIndex(
                name: "uk_user_groups_group_name",
                table: "user_groups",
                column: "group_name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_users_conference_id",
                table: "users",
                column: "conference_id");

            migrationBuilder.CreateIndex(
                name: "idx_users_role",
                table: "users",
                column: "role");

            migrationBuilder.CreateIndex(
                name: "uk_users_name",
                table: "users",
                column: "name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "attachments");

            migrationBuilder.DropTable(
                name: "audit_logs");

            migrationBuilder.DropTable(
                name: "delegate_attr_values");

            migrationBuilder.DropTable(
                name: "instructions");

            migrationBuilder.DropTable(
                name: "message_receivers");

            migrationBuilder.DropTable(
                name: "rounds");

            migrationBuilder.DropTable(
                name: "system_configs");

            migrationBuilder.DropTable(
                name: "time_anchors");

            migrationBuilder.DropTable(
                name: "user_group_members");

            migrationBuilder.DropTable(
                name: "delegate_attr_configs");

            migrationBuilder.DropTable(
                name: "delegate_attr_records");

            migrationBuilder.DropTable(
                name: "messages");

            migrationBuilder.DropTable(
                name: "user_groups");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "conferences");
        }
    }
}
