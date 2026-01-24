"use client"

import Link from "next/link"
import { Menu, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useAuth } from "@/lib/contexts/auth-context"

export function Navbar() {
  const { isAuthenticated, isSysAdmin, canManageConference, logout, isLoading } = useAuth()

  const baseMenuItems = [
    { href: "/", label: "主页" }
  ]

  // 根据登录状态动态添加菜单项
  const menuItems = [
    ...baseMenuItems,
    ...(isLoading 
      ? [] 
      : isAuthenticated 
        ? [
            { href: "/profile", label: "个人信息" },
            ...(canManageConference ? [{ href: "/conference", label: "会议管理" }] : []),
            ...(isSysAdmin ? [{ href: "/admin", label: "系统管理" }] : []),
          ]
        : [{ href: "/login", label: "登录" }]
    ),
  ]

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Mobile Menu - Left Side */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">打开菜单</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[250px] sm:w-[300px]">
              <SheetHeader>
                <SheetTitle>Asya</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-6">
                {menuItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-sm font-medium transition-colors hover:text-primary"
                  >
                    {item.label}
                  </Link>
                ))}
                {isAuthenticated && !isLoading && (
                  <button
                    onClick={logout}
                    className="text-sm font-medium text-red-600 transition-colors hover:text-red-700 text-left"
                  >
                    退出登录
                  </button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Logo - Center on mobile, left on desktop */}
        <Link href="/" className="text-xl font-bold md:order-first">
          Asya
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-6">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
          {isAuthenticated && !isLoading && (
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 mr-2" />
              退出
            </Button>
          )}
        </div>

        {/* Empty space for mobile layout balance */}
        <div className="md:hidden w-10"></div>
      </div>
    </nav>
  )
}
