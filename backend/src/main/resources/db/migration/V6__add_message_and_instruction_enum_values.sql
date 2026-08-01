-- 新增消息类型：备忘录、议定书、修正案、声明
alter type public.messagetype add value if not exists 'MEMORANDUM';
alter type public.messagetype add value if not exists 'PROTOCOL';
alter type public.messagetype add value if not exists 'AMENDMENT';
alter type public.messagetype add value if not exists 'DECLARATION';

-- 新增指令类型：经济
alter type public.instructiontype add value if not exists 'ECONOMY';
