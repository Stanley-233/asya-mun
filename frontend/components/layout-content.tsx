'use client'

import { Navbar } from "@/components/navbar"

export function LayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-muted/20 px-4 py-4 text-center text-sm text-muted-foreground">
        ASYA - 非对称联动推演自动化系统 | Copyright © 2026 Stanley. All Rights Reserved.
      </footer>
    </div>
  )
}
