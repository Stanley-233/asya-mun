'use client'

import { useEffect } from 'react'

export default function LoginPage() {
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const returnTo = searchParams.get('returnTo')
    const target = returnTo ? `/?returnTo=${encodeURIComponent(returnTo)}` : '/'
    window.location.replace(target)
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-white text-slate-700">
      <p className="text-sm font-semibold tracking-[0.18em] text-slate-400 uppercase">ASYA</p>
    </main>
  )
}
