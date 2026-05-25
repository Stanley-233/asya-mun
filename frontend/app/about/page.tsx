'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import Markdown, { type Components } from 'react-markdown'
import pkg from '../../package.json'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink } from 'lucide-react'
import { siteAssets, siteBrand, siteLicense, siteLinks } from '@/assets'

const version = pkg.version

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mt-8 mb-3 border-b pb-2 text-2xl font-bold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-8 mb-3 border-b pb-2 text-xl font-bold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 mb-2 text-base font-semibold">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-4 mb-1 text-sm font-semibold">{children}</h4>
  ),
  ul: ({ children }) => (
    <ul className="my-3 ml-5 list-disc space-y-1 marker:text-muted-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 ml-5 list-decimal space-y-1 marker:text-muted-foreground">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-sm leading-relaxed">{children}</li>
  ),
  p: ({ children }) => (
    <p className="my-2 text-sm leading-relaxed">{children}</p>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg bg-muted p-3 text-sm">{children}</pre>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-primary underline underline-offset-4 hover:text-primary/80" target="_blank" rel="noreferrer">{children}</a>
  ),
  hr: () => <hr className="my-6 border-border" />,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-muted-foreground/40 pl-4 text-sm italic text-muted-foreground">{children}</blockquote>
  ),
}

export default function AboutPage() {
  const [changelog, setChangelog] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(siteAssets.changelog)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load changelog')
        return res.text()
      })
      .then((text) => {
        setChangelog(text)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-primary/15 bg-card/70 p-5 shadow-[0_12px_32px_rgba(184,132,52,0.08)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-white p-2 shadow-[0_10px_24px_rgba(184,132,52,0.12)]">
              <Image
                src={siteAssets.logo.src}
                alt={siteAssets.logo.alt}
                fill
                sizes="80px"
                className="object-contain p-1"
                priority
              />
            </div>
            <div>
              <h1 className="mb-2 text-3xl font-bold">{siteBrand.fullNameWithColon}</h1>
              <p className="text-muted-foreground">项目信息与版本变更记录</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>项目信息</CardTitle>
            <CardDescription>
              {siteBrand.fullNameEn}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="mb-1 text-xs text-muted-foreground">当前版本</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-sm">
                    v{version}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="mb-1 text-xs text-muted-foreground">许可证</p>
                <p className="text-sm font-medium">{siteLicense.name}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="mb-1 text-xs text-muted-foreground">技术栈</p>
                <p className="text-sm font-medium">Next.js + Spring Boot</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="mb-1 text-xs text-muted-foreground">开源仓库</p>
                <a
                  href={siteLinks.repository}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                >
                  GitHub
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>版本变更记录</CardTitle>
            <CardDescription>所有版本的功能变更与修复记录</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex min-h-32 items-center justify-center">
                <p className="text-sm text-muted-foreground">加载中...</p>
              </div>
            ) : error ? (
              <div className="flex min-h-32 items-center justify-center">
                <p className="text-sm text-muted-foreground">暂无版本变更记录</p>
              </div>
            ) : (
              <div className="space-y-1">
                <Markdown components={markdownComponents}>{changelog}</Markdown>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
