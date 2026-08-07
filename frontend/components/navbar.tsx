"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  Command,
  Dices,
  FileText,
  Info,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MessagesSquare,
  Settings,
  Puzzle,
  ShieldCheck,
  Swords,
  Timer,
  UsersRound,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useState } from "react"
import { siteAssets, siteBrand } from "@/assets"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/contexts/auth-context"
import { ProfileDialog } from "@/components/profile-dialog"

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

type NavGroup = {
  label: string
  icon: LucideIcon
  items: NavItem[]
}

const ROLE_LABELS: Record<string, string> = {
  SYS_ADMIN: "系统管理员",
  DH: "主席团指导",
  DM: "主席团成员",
  DELEGATE: "代表",
}

const collapsedTooltipClassName =
  "pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-sidebar-foreground px-2 py-1 text-xs font-medium text-sidebar opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function getRoleLabel(role?: string | null, isAuthenticated?: boolean) {
  if (!role) return isAuthenticated ? "用户" : "访客"
  return ROLE_LABELS[role] ?? role
}

function getDisplayName(user?: { displayName?: string | null; name?: string | null } | null) {
  return user?.displayName?.trim() || user?.name || "访客"
}

function BrandLogo({ size = "size-12" }: { size?: string }) {
  return (
    <div className={cn("relative shrink-0", size)}>
      <Image
        src={siteAssets.logo.src}
        alt={siteAssets.logo.alt}
        fill
        sizes="56px"
        className="object-contain"
        priority
      />
    </div>
  )
}

function UserPanel({
  collapsed = false,
  showLogout,
  onLogout,
  onClick,
}: {
  collapsed?: boolean
  showLogout: boolean
  onLogout: () => void
  onClick?: () => void
}) {
  const { user, isAuthenticated } = useAuth()
  const displayName = getDisplayName(user)
  const role = getRoleLabel(user?.role, isAuthenticated)

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      className={cn(
        "group relative flex items-center gap-2 rounded-2xl border border-sidebar-border/70 bg-white/70 p-2 text-sidebar-foreground shadow-sm transition-all duration-300 ease-out",
        collapsed && "justify-center rounded-xl px-2 hover:-translate-y-0.5 hover:bg-white hover:shadow-md hover:ring-2 hover:ring-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
        onClick && "cursor-pointer hover:bg-white/90 hover:border-primary/20",
      )}
      title={collapsed ? `${displayName} · ${role}，点击查看个人信息` : onClick ? "查看个人信息" : undefined}
      aria-label={collapsed ? `${displayName} · ${role}，点击查看个人信息` : undefined}
    >
      {collapsed && (
        <span className={collapsedTooltipClassName}>
          {displayName}
        </span>
      )}
      {!collapsed && (
        <div className="flex min-w-0 flex-1 items-center gap-2.5 transition-all duration-300 ease-out">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CircleUserRound className="size-4.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-5">{displayName}</p>
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">{role}</p>
          </div>
        </div>
      )}
      {showLogout && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onLogout()
          }}
          title="退出"
          className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-destructive/15 hover:shadow-sm hover:ring-2 hover:ring-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/25"
          aria-label="退出"
        >
          <LogOut className="size-4" />
        </button>
      )}
    </div>
  )
}

function buildNavGroups({
  isAuthenticated,
  isLoading,
  isSysAdmin,
  canManageConference,
  isDelegate,
}: {
  isAuthenticated: boolean
  isLoading: boolean
  isSysAdmin: boolean
  canManageConference: boolean
  isDelegate: boolean
}): NavGroup[] {
  const delegateItems: NavItem[] = [
    ...(isAuthenticated ? [{ href: "/progress", label: "会议", icon: Timer }] : []),
    ...(isDelegate ? [{ href: "/status", label: "我的状态", icon: Activity }] : []),
    ...(isDelegate ? [{ href: "/my-instructions", label: "我的指令", icon: ClipboardList }] : []),
    ...(isDelegate ? [{ href: "/my-messages", label: "我的非对称", icon: Mail }] : []),
    ...(isLoading
      ? []
      : !isAuthenticated
        ? [{ href: "/login", label: "登录", icon: LogIn }]
        : []),
  ]

  const academyItems: NavItem[] = isLoading
    ? []
    : [
        ...(canManageConference
          ? [
              { href: "/conference-info", label: "会议信息", icon: UsersRound },
              { href: "/conference-progress", label: "会议进程", icon: Timer },
              { href: "/status-manage", label: "代表状态", icon: ShieldCheck },
              { href: "/asymsg", label: "非对称消息", icon: MessagesSquare },
              { href: "/instructions", label: "代表指令", icon: FileText },
            ]
          : []),
      ]

  const dlcItems: NavItem[] = isLoading
    ? []
    : isAuthenticated
      ? [
          { href: "/dlc/dice", label: "骰娘", icon: Dices },
          { href: "/dlc/medieval-strategy", label: "中世纪战略", icon: Swords },
          { href: "/dlc/rppi-calculator", label: "投射能力计算", icon: Calculator },
        ]
      : []

  const systemItems: NavItem[] = isLoading
    ? []
    : [
        ...(isSysAdmin ? [{ href: "/admin", label: "系统管理", icon: Settings }] : []),
        ...(isSysAdmin ? [{ href: "/audit-logs", label: "日志", icon: ClipboardList }] : []),
        { href: "/about", label: "关于", icon: Info },
      ]

  return [
    { label: "代表", icon: LayoutDashboard, items: delegateItems },
    { label: "学团", icon: Command, items: academyItems },
    { label: "DLC", icon: Puzzle, items: dlcItems },
    { label: "系统", icon: Settings, items: systemItems },
  ].filter((group) => group.items.length > 0)
}

function NavigationGroups({
  groups,
  pathname,
  collapsed = false,
  closedGroups,
  onToggleGroup,
  onNavigate,
}: {
  groups: NavGroup[]
  pathname: string
  collapsed?: boolean
  closedGroups: string[]
  onToggleGroup: (label: string) => void
  onNavigate?: () => void
}) {
  return (
    <div className={cn("flex flex-1 flex-col gap-2.5 transition-all duration-300 ease-out", collapsed && "items-center gap-2")}>
      {groups.map((group) => {
        const groupClosed = closedGroups.includes(group.label)

        return (
          <section key={group.label} className={cn("w-full transition-all duration-300 ease-out", collapsed && "flex flex-col items-center")}>
            <button
              type="button"
              onClick={() => onToggleGroup(group.label)}
              className={cn(
                "group relative mb-0.5 flex h-5 w-full items-center gap-2 rounded-lg px-3 text-left text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-all duration-300 ease-out hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/30",
                collapsed && "mb-0.5 size-7 justify-center px-0 hover:-translate-y-0.5 hover:shadow-sm hover:ring-2 hover:ring-primary/15"
              )}
              title={collapsed ? group.label : undefined}
              aria-expanded={!groupClosed}
              aria-label={collapsed ? `${group.label}${groupClosed ? "，点击展开" : "，点击折叠"}` : undefined}
            >
              {collapsed && (
                <span className={collapsedTooltipClassName}>
                  {group.label}
                </span>
              )}
              <group.icon className="size-3.5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate transition-opacity duration-200">{group.label}</span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 shrink-0 transition-transform duration-200",
                      groupClosed && "-rotate-90"
                    )}
                  />
                </>
              )}
              {collapsed && <span className="sr-only">{group.label}</span>}
            </button>
            {!groupClosed && (
              <div>
                {group.items.map((item) => {
                  const active = isActivePath(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      className={cn(
                        "group relative flex h-9 items-center gap-2.5 rounded-xl px-3 text-[0.92rem] font-semibold text-muted-foreground transition-all duration-300 ease-out hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/30",
                        active && "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
                        collapsed && "size-10 justify-center px-0 hover:-translate-y-0.5 hover:shadow-md hover:ring-2 hover:ring-primary/15",
                        !collapsed && "hover:translate-x-0.5"
                      )}
                    >
                      {collapsed && (
                        <span className={collapsedTooltipClassName}>
                          {item.label}
                        </span>
                      )}
                      <item.icon
                        className={cn(
                          "size-4.5 shrink-0 stroke-[1.9] transition-colors",
                          active ? "text-sidebar-accent-foreground" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                        )}
                      />
                      {!collapsed && <span className="truncate transition-opacity duration-200">{item.label}</span>}
                      {collapsed && <span className="sr-only">{item.label}</span>}
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

export function Navbar() {
  const pathname = usePathname()
  const { user, isAuthenticated, isSysAdmin, canManageConference, logout, isLoading } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [closedGroups, setClosedGroups] = useState<string[]>([])
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const isDelegate = user?.role === "DELEGATE"
  const displayName = getDisplayName(user)
  const role = getRoleLabel(user?.role, isAuthenticated)
  const groups = buildNavGroups({
    isAuthenticated,
    isLoading,
    isSysAdmin,
    canManageConference,
    isDelegate,
  })
  const toggleGroup = (label: string) => {
    setClosedGroups((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
    )
  }

  const openProfileDialog = () => setProfileDialogOpen(true)

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-sidebar-border bg-sidebar/95 px-4 backdrop-blur md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="打开菜单">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-[300px] flex-col border-sidebar-border bg-sidebar p-0 sm:w-[340px]">
            <SheetHeader className="border-b border-sidebar-border px-5 py-5 text-left">
              <SheetTitle className="flex items-center gap-3">
                <BrandLogo />
                <span className="flex flex-col">
                  <span className="text-xs font-bold uppercase tracking-[0.32em] text-muted-foreground">{siteBrand.systemLabel}</span>
                  <span className="mt-1 text-2xl font-black tracking-tight text-sidebar-foreground">{siteBrand.appLabel}</span>
                </span>
              </SheetTitle>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
              <NavigationGroups
                groups={groups}
                pathname={pathname}
                closedGroups={closedGroups}
                onToggleGroup={toggleGroup}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
            <div className="border-t border-sidebar-border p-4">
              <UserPanel showLogout={isAuthenticated && !isLoading} onLogout={logout} onClick={isAuthenticated ? openProfileDialog : undefined} />
            </div>
          </SheetContent>
        </Sheet>
        <Link href="/progress" className="flex items-center gap-2.5">
          <BrandLogo size="size-11" />
          <span className="flex flex-col">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.26em] text-muted-foreground">{siteBrand.name}</span>
            <span className="text-base font-black leading-5 text-sidebar-foreground">{siteBrand.appLabel}</span>
          </span>
        </Link>
        <div className="size-8" aria-hidden="true" />
      </header>

      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar/95 text-sidebar-foreground shadow-[8px_0_30px_rgb(15_23_42/0.04)] backdrop-blur transition-[width] duration-300 ease-out md:flex",
          collapsed ? "w-[76px]" : "w-[280px]"
        )}
      >
        <div className={cn("flex h-22 items-start justify-between border-b border-sidebar-border px-5 py-5 transition-all duration-300 ease-out", collapsed && "items-center justify-center px-3")}>
          <Link href="/progress" className={cn("flex min-w-0 items-center gap-3", collapsed && "sr-only")}>
            <BrandLogo />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.32em] text-muted-foreground">{siteBrand.systemLabel}</p>
              <p className="mt-1 text-2xl font-black tracking-tight text-sidebar-foreground">{siteBrand.appLabel}</p>
            </div>
          </Link>
          {collapsed && (
            <button
              type="button"
              onClick={isAuthenticated ? openProfileDialog : undefined}
              className="group relative flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary/15 hover:shadow-md hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              title={`${displayName} · ${role}，点击查看个人信息`}
              aria-label={`${displayName} · ${role}，点击查看个人信息`}
            >
              <span className={collapsedTooltipClassName}>
                {displayName}
              </span>
              <CircleUserRound className="size-5" />
            </button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed((value) => !value)}
            className={cn(
              "group relative rounded-xl text-muted-foreground transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-sidebar-accent hover:text-sidebar-foreground hover:shadow-sm hover:ring-2 hover:ring-primary/15 focus-visible:ring-2 focus-visible:ring-primary/25",
              collapsed && "absolute left-11 top-5 size-7 rounded-full border bg-sidebar shadow-sm hover:bg-sidebar-accent"
            )}
            aria-label={collapsed ? "展开侧栏" : "折叠侧栏"}
            title={collapsed ? "展开侧栏" : "折叠侧栏"}
          >
            <span className={collapsedTooltipClassName}>
              {collapsed ? "展开侧栏" : "折叠侧栏"}
            </span>
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 transition-all duration-300 ease-out">
          <NavigationGroups
            groups={groups}
            pathname={pathname}
            collapsed={collapsed}
            closedGroups={closedGroups}
            onToggleGroup={toggleGroup}
          />
        </nav>

        {(!collapsed || (isAuthenticated && !isLoading)) && (
          <div className={cn("border-t border-sidebar-border p-3 transition-all duration-300 ease-out", collapsed && "px-2")}>
            <UserPanel collapsed={collapsed} showLogout={isAuthenticated && !isLoading} onLogout={logout} onClick={isAuthenticated ? openProfileDialog : undefined} />
          </div>
        )}
      </aside>

      <ProfileDialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />
    </>
  )
}
