import type { Metadata } from "next";

export const siteBrand = {
  name: "ASYA",
  systemLabel: "ASYA SYSTEM",
  appLabel: "ASYA 系统",
  fullNameZh: "非对称联动推演自动化系统",
  fullNameWithDash: "ASYA - 非对称联动推演自动化系统",
  fullNameWithColon: "ASYA：非对称联动推演自动化系统",
  fullNameEn: "Asymmetric SYnergy Automation System",
  summary: "模拟联合国联动体系的一站式解决方案，连接会议节奏、学团代表交互、信息流转。",
  acronymSegments: [
    { emphasis: "A", text: "symmetric" },
    { emphasis: "SY", text: "nergy" },
    { emphasis: "A", text: "utomation System" },
  ],
} as const;

export const siteAssets = {
  logo: {
    src: "/asya-logo.png",
    alt: "ASYA 标志",
  },
  icons: {
    iconPng: "/icon.png",
    appleTouch: "/asya-logo.png",
  },
  changelog: "/VERSION_CHANGELOG.md",
} as const;

export const siteLinks = {
  repository: "https://www.github.com/Stanley-233/asya-mun",
  contactEmail: "acc_stanley@foxmail.com",
} as const;

export const siteLicense = {
  name: "PolyForm Shield 1.0.0",
  footerNotice: "竞争性产品使用请联系开发者获取额外授权。",
} as const;

export const siteMetadataIcons: Metadata["icons"] = {
  icon: [
    { url: siteAssets.icons.iconPng, type: "image/png" },
    { url: siteAssets.logo.src, type: "image/png" },
  ],
  shortcut: siteAssets.icons.iconPng,
  apple: siteAssets.icons.appleTouch,
};
