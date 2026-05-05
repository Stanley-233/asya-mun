'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiExample } from "@/lib/api/example-usage"
import { useEffect, useState } from "react"
import { ChevronDown, Orbit, Radar, Workflow } from "lucide-react"
import { TermsDialog } from "@/components/terms-dialog"
import { motion, useReducedMotion } from "framer-motion"

const capabilityCards = [
  {
    icon: Orbit,
    eyebrow: "Scenario Engine",
    title: "联动推演",
    description: "以更清晰的节奏组织议程、角色和事件流，让推演链路从设定到执行都保持连贯。",
  },
  {
    icon: Workflow,
    eyebrow: "Coordination Layer",
    title: "流程协同",
    description: "把多端操作、指令分发和状态反馈整理成统一节拍，减少人工切换带来的割裂感。",
  },
  {
    icon: Radar,
    eyebrow: "Intel Surface",
    title: "信息整合",
    description: "集中呈现关键状态与互动信号，让主持团队更快捕捉变化并做出响应。",
  },
]

export function WelcomeComponent() {
  const [showScrollHint, setShowScrollHint] = useState(true)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    // 确保页面刷新后滚动到顶部
    window.scrollTo(0, 0)

    const handleScroll = () => {
      if (window.scrollY > 100) {
        setShowScrollHint(false)
      } else {
        setShowScrollHint(true)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToLogin = () => {
    document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  const containerTransition = shouldReduceMotion
    ? { duration: 0.01 }
    : { staggerChildren: 0.14, delayChildren: 0.12 }

  const itemVariant = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 20,
      filter: shouldReduceMotion ? "none" : "blur(8px)",
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.7,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
  }

  const cardVariant = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 28,
    },
    visible: (delay = 0) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.65,
        delay: shouldReduceMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    }),
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(250,247,241,0.92)_32%,_rgba(244,239,230,0.82)_60%,_rgba(255,255,255,0.96)_100%)]">
      <div className="asya-grid pointer-events-none absolute inset-0 opacity-55" />
      <div className="asya-noise pointer-events-none absolute inset-0 opacity-40" />
      <div className="asya-glow pointer-events-none absolute left-1/2 top-0 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/3 opacity-85" />
      <div className="asya-glow pointer-events-none left-[8%] top-[24%] hidden h-64 w-64 opacity-60 md:absolute md:block" style={{ animationDelay: "-4s" }} />
      <div className="asya-glow pointer-events-none right-[6%] top-[60%] hidden h-72 w-72 opacity-50 md:absolute md:block" style={{ animationDelay: "-8s" }} />

      {/* Hero Section */}
      <section className="relative flex min-h-screen items-center justify-center px-4 pb-24 pt-24">
        <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center">
          <div className="asya-orb h-32 w-32 rounded-full opacity-70" />
        </div>

        <motion.div
          className="relative mx-auto flex w-full max-w-6xl flex-col items-center text-center"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: containerTransition,
            },
          }}
        >
          {/* <motion.div
            variants={itemVariant}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-4 py-2 text-xs font-medium tracking-[0.24em] text-primary/80 uppercase shadow-[0_10px_30px_rgba(184,132,52,0.08)] backdrop-blur-md"
          >
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_16px_rgba(184,132,52,0.7)]" />
            Asymmetric Command Surface
          </motion.div> */}

          <motion.div variants={itemVariant} className="space-y-6">
            <h1 className="bg-gradient-to-b from-primary via-[color:rgba(184,132,52,0.88)] to-[color:rgba(111,78,27,0.68)] bg-clip-text text-[4.5rem] font-black tracking-[-0.12em] text-transparent drop-shadow-[0_18px_48px_rgba(155,109,35,0.18)] sm:text-[6.5rem] md:text-[8.75rem] lg:text-[10rem]">
              ASYA
            </h1>
            <div className="space-y-3">
              <p className="mx-auto max-w-4xl text-lg font-light tracking-[0.14em] text-foreground/88 uppercase sm:text-xl md:text-2xl">
                <span className="font-bold text-foreground">A</span>symmetric{' '}
                <span className="font-bold text-foreground">SY</span>nergy{' '}
                <span className="font-bold text-foreground">A</span>utomation System
              </p>
              <p className="text-base font-light tracking-[0.22em] text-muted-foreground/90 sm:text-lg md:text-xl">
                非对称联动推演自动化系统
              </p>
            </div>
          </motion.div>

          <motion.div variants={itemVariant} className="mt-8 flex justify-center">
            <div className="h-px w-40 bg-gradient-to-r from-transparent via-primary/80 to-transparent shadow-[0_0_24px_rgba(184,132,52,0.35)]" />
          </motion.div>

          <motion.p
            variants={itemVariant}
            className="mt-8 max-w-3xl text-pretty text-base leading-8 text-muted-foreground sm:text-lg md:text-xl"
          >
            用于模拟联合国联动体系的一站式解决方案
          </motion.p>

          <motion.div
            variants={itemVariant}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <TermsDialog variant="ghost" />
            <div className="rounded-full border border-border/70 bg-background/65 px-4 py-2 text-sm text-muted-foreground shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur-md">
              Unified orchestration for Model UN coordination
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll Hint */}
        {showScrollHint && (
          <motion.button
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.85, duration: shouldReduceMotion ? 0.01 : 0.6 }}
            onClick={scrollToLogin}
            className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 rounded-full border border-border/60 bg-background/55 px-5 py-3 text-muted-foreground shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-md transition-all duration-300 hover:border-primary/40 hover:text-primary"
          >
            <span className="text-xs tracking-[0.22em] uppercase">Scroll to explore</span>
            <motion.span
              animate={shouldReduceMotion ? undefined : { y: [0, 5, 0], opacity: [0.9, 1, 0.9] }}
              transition={shouldReduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronDown className="h-5 w-5" />
            </motion.span>
          </motion.button>
        )}
      </section>

      {/* Login Section */}
      <section id="login-section" className="relative px-4 pb-24 pt-10 sm:pb-28">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={cardVariant}
            custom={0.08}
          >
            <Card className="asya-panel min-h-full border-primary/20 bg-card/58 py-0 shadow-[0_22px_70px_rgba(142,99,30,0.12)] backdrop-blur-xl">
              <CardHeader className="border-b border-border/60 px-6 py-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_30px_rgba(184,132,52,0.16)]">
                    <Radar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium tracking-[0.24em] text-primary/75 uppercase">System Monitor</p>
                    <CardTitle className="mt-1 text-2xl font-semibold">系统状态</CardTitle>
                  </div>
                </div>
                <CardDescription className="max-w-lg text-sm leading-7">
                  检查后端 API 连通情况与响应状态，作为进入系统前的实时观察面板。
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 py-6">
                <ApiExample />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            className="space-y-5"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={{
              hidden: {},
              visible: {
                transition: shouldReduceMotion ? { duration: 0.01 } : { staggerChildren: 0.12 },
              },
            }}
          >
            <motion.div variants={cardVariant} custom={0.14} className="px-1 pb-2 pt-2">
              <p className="text-xs font-medium tracking-[0.24em] text-primary/75 uppercase">Capability Highlights</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">为复杂联动准备的一体化工作台</h2>
              {/* <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
                首页不仅展示品牌，也快速说明这套系统在联动推演中的价值重心，让用户在进入前就能感受到节奏、控制与信息密度。
              </p> */}
            </motion.div>

            {capabilityCards.map(({ icon: Icon, eyebrow, title, description }, index) => (
              <motion.div key={title} variants={cardVariant} custom={0.2 + index * 0.1}>
                <Card className="asya-panel border-border/70 bg-background/62 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1">
                  <CardHeader className="px-6 py-5">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/18 bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium tracking-[0.22em] text-primary/70 uppercase">{eyebrow}</p>
                        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
                        <CardDescription className="text-sm leading-7 text-muted-foreground">
                          {description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </div>
  )
}


export default function Page() {
  return <WelcomeComponent />
}
