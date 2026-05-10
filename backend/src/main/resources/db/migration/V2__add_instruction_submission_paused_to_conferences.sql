-- 在conferences表中添加指令提交暂停字段
ALTER TABLE public.conferences 
ADD COLUMN instruction_submission_paused BOOLEAN NOT NULL DEFAULT false;

-- 删除system_configs中的全局指令提交暂停配置（功能已迁移到conferences表）
DELETE FROM public.system_configs WHERE config_key = 'INSTRUCTION_SUBMISSION_PAUSED';
