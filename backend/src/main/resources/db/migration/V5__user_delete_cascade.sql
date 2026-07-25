-- 删除用户时级联清理相关表的引用
-- 用户的 all 引用都改为安全删除策略：join 表/仅属于被删用户的从表使用 ON DELETE CASCADE；
-- 可空的外键（messages.sender_id、instructions.reviewed_by）使用 ON DELETE SET NULL
ALTER TABLE public.user_group_members
    DROP CONSTRAINT IF EXISTS fk_user_group_members_user;

ALTER TABLE public.user_group_members
    ADD CONSTRAINT fk_user_group_members_user
        FOREIGN KEY (user_uuid) REFERENCES public.users (uuid)
        ON DELETE CASCADE;

ALTER TABLE public.message_receivers
    DROP CONSTRAINT IF EXISTS fk_message_receivers_user;

ALTER TABLE public.message_receivers
    ADD CONSTRAINT fk_message_receivers_user
        FOREIGN KEY (user_id) REFERENCES public.users (uuid)
        ON DELETE CASCADE;

ALTER TABLE public.messages
    DROP CONSTRAINT IF EXISTS fk_messages_sender;

ALTER TABLE public.messages
    ADD CONSTRAINT fk_messages_sender
        FOREIGN KEY (sender_id) REFERENCES public.users (uuid)
        ON DELETE SET NULL;

ALTER TABLE public.instructions
    DROP CONSTRAINT IF EXISTS fk_instructions_reviewed_by;

ALTER TABLE public.instructions
    ADD CONSTRAINT fk_instructions_reviewed_by
        FOREIGN KEY (reviewed_by) REFERENCES public.users (uuid)
        ON DELETE SET NULL;

ALTER TABLE public.instructions
    DROP CONSTRAINT IF EXISTS fk_instructions_submitter;

ALTER TABLE public.instructions
    ADD CONSTRAINT fk_instructions_submitter
        FOREIGN KEY (submitter_id) REFERENCES public.users (uuid)
        ON DELETE CASCADE;

ALTER TABLE public.delegate_attr_records
    DROP CONSTRAINT IF EXISTS fk_delegate_attr_records_delegate;

ALTER TABLE public.delegate_attr_records
    ADD CONSTRAINT fk_delegate_attr_records_delegate
        FOREIGN KEY (delegate_id) REFERENCES public.users (uuid)
        ON DELETE CASCADE;