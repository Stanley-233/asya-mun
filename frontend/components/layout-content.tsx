'use client'

import { usePathname } from "next/navigation"
import { Navbar } from "@/components/navbar"

const REPOSITORY_URL = 'https://www.github.com/Stanley-233/asya-mun'

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthEntryPage = pathname === '/' || pathname === '/login'

  if (!isAuthEntryPage) {
    return (
      <div className="min-h-screen bg-background md:flex">
        <Navbar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-muted/20 px-4 py-4 text-center text-sm text-muted-foreground">
        <p>ASYA - 非对称联动推演自动化系统</p>
        <p className="mt-1">
          Licensed under PolyForm Shield 1.0.0 · 开源仓库：
          {' '}
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">
            {REPOSITORY_URL}
          </a>
        </p>
        <p className="mt-1 text-xs">竞争性产品使用请联系开发者获取额外授权。</p>
      </footer>
    </div>
  )
}
