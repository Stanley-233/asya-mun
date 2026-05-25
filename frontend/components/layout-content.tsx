'use client'

import { usePathname } from "next/navigation"
import { siteBrand, siteLicense, siteLinks } from "@/assets"
import { Navbar } from "@/components/navbar"

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
        <p>{siteBrand.fullNameWithDash}</p>
        <p className="mt-1">
          Licensed under {siteLicense.name} · 开源仓库：
          {' '}
          <a href={siteLinks.repository} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-foreground">
            {siteLinks.repository}
          </a>
        </p>
        <p className="mt-1 text-xs">{siteLicense.footerNotice}</p>
      </footer>
    </div>
  )
}
