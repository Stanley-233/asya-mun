import { BookOpenCheck, Network, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SystemNote = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const authSystemNotes: SystemNote[] = [
  {
    title: "联动推演",
    description: "以更清晰的节奏组织议程、角色和事件流，让推演链路保持连贯。",
    icon: BookOpenCheck,
  },
  {
    title: "流程协同",
    description: "把指令分发、状态反馈和非对称消息整理成统一节拍。",
    icon: Network,
  },
  {
    title: "信息整合",
    description: "集中呈现关键状态与互动信号，帮助主持团队快速响应。",
    icon: ShieldCheck,
  },
];
