'use client'

import { Navbar } from "@/components/navbar"

export function LayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  )
}
