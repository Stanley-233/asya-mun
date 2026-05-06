"use client"

import { useEffect } from "react"
import { ReactNode } from "react"

export default function Template({ children }: { children: ReactNode }) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <>
      {children}
    </>
  )
}
