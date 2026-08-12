'use client'

import { useEffect, useState } from 'react'
import { Dices, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface DiceTerm {
  raw: string
  sign: 1 | -1
  type: 'dice'
  count: number
  sides: number
  rolls: number[]
  total: number
}

interface NumberTerm {
  raw: string
  sign: 1 | -1
  type: 'number'
  value: number
  total: number
}

type Term = DiceTerm | NumberTerm

type SuccessLevel = 'critical' | 'extreme' | 'hard' | 'success' | 'failure' | 'fumble'

interface RollResult {
  id: string
  timestamp: number
  terms: Term[]
  grandTotal: number
  targetRate: number | null
  rateRoll: number | null
  successLevel: SuccessLevel | null
}

const SUCCESS_LEVEL_LABELS: Record<SuccessLevel, string> = {
  critical: '大成功',
  extreme: '极难成功',
  hard: '困难成功',
  success: '成功',
  failure: '失败',
  fumble: '大失败',
}

const SUCCESS_LEVEL_STYLES: Record<SuccessLevel, string> = {
  critical: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  extreme: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  hard: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  failure: 'bg-red-500/10 text-red-700 dark:text-red-400',
  fumble: 'bg-red-700/15 text-red-800 dark:text-red-300',
}

// COC 7 版简化规则：1 大成功；目标<50 时 96-100 大失败，目标≥50 时 100 大失败；
// 骰值 ≤ 目标/5 极难成功，≤ 目标/2 困难成功，≤ 目标 成功，其余失败
function judgeSuccessLevel(roll: number, target: number): SuccessLevel {
  if (roll === 1) return 'critical'
  if (target < 50 ? roll >= 96 : roll === 100) return 'fumble'
  if (roll <= Math.floor(target / 5)) return 'extreme'
  if (roll <= Math.floor(target / 2)) return 'hard'
  if (roll <= target) return 'success'
  return 'failure'
}

const HISTORY_STORAGE_KEY = 'asya-dice-roller-history'
const MAX_HISTORY_COUNT = 100

function loadHistoryFromStorage(): RollResult[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, MAX_HISTORY_COUNT)
  } catch {
    return []
  }
}

function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

function normalizeExpression(expression: string): string {
  return expression
    .replace(/\s*([+-])\s*/g, '$1')
    .replace(/\s+/g, '+')
}

function parseDiceExpression(expression: string): { terms: Term[]; error?: string } {
  const normalized = normalizeExpression(expression)
  if (!normalized) {
    return { terms: [], error: '请输入骰子表达式' }
  }

  const withSign = /^[+-]/.test(normalized) ? normalized : `+${normalized}`
  const matches = [...withSign.matchAll(/([+-])(\d*d\d+|\d+)/gi)]

  let matchedLength = 0
  for (const match of matches) {
    matchedLength += match[0].length
  }

  if (matchedLength !== withSign.length) {
    return { terms: [], error: `无法解析 "${expression}"，请使用如 1d6+2、1d4+1d5+12d12 的格式` }
  }

  const terms: Term[] = []
  for (const match of matches) {
    const sign = match[1] === '+' ? 1 : -1
    const raw = match[2]

    const diceMatch = raw.match(/^(\d*)d(\d+)$/i)
    if (diceMatch) {
      const count = diceMatch[1] === '' ? 1 : Math.max(1, parseInt(diceMatch[1], 10))
      const sides = Math.max(1, parseInt(diceMatch[2], 10))
      const rolls = Array.from({ length: count }, () => rollDie(sides))
      const total = rolls.reduce((sum, value) => sum + value, 0)
      terms.push({
        raw,
        sign,
        type: 'dice',
        count,
        sides,
        rolls,
        total,
      })
    } else {
      const value = parseInt(raw, 10)
      terms.push({
        raw,
        sign,
        type: 'number',
        value,
        total: value,
      })
    }
  }

  return { terms }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function renderSign(term: Term, index: number): string {
  if (index === 0) {
    return term.sign > 0 ? '' : '-'
  }
  return term.sign > 0 ? '+' : '-'
}

const PRESETS = ['1d3', '1d6', '1d20', '1d100']

export function DiceRoller() {
  const [expression, setExpression] = useState('1d6')
  const [targetRateRaw, setTargetRateRaw] = useState('')
  const [history, setHistory] = useState<RollResult[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 挂载后从 localStorage 恢复历史记录（避免 SSR hydration 不一致）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadHistoryFromStorage())
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_COUNT)))
    } catch {
      // 存储失败（如隐私模式）时静默忽略，不影响掷骰功能
    }
  }, [history])

  const handleRoll = () => {
    setError(null)

    const trimmed = expression.trim()
    if (!trimmed) {
      setError('请输入骰子表达式')
      return
    }

    const parsed = parseDiceExpression(trimmed)
    if (parsed.error) {
      setError(parsed.error)
      return
    }

    const grandTotal = parsed.terms.reduce((sum, term) => sum + term.total * term.sign, 0)

    let targetRate: number | null = null
    let rateRoll: number | null = null
    let successLevel: SuccessLevel | null = null

    const trimmedRate = targetRateRaw.trim()
    if (trimmedRate) {
      const rate = parseInt(trimmedRate, 10)
      if (!Number.isNaN(rate) && rate >= 1 && rate <= 100) {
        targetRate = rate
        rateRoll = rollDie(100)
        successLevel = judgeSuccessLevel(rateRoll, rate)
      }
    }

    const result: RollResult = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      terms: parsed.terms,
      grandTotal,
      targetRate,
      rateRoll,
      successLevel,
    }

    setHistory((prev) => [result, ...prev].slice(0, MAX_HISTORY_COUNT))
  }

  const clearHistory = () => setHistory([])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>掷骰</CardTitle>
          <CardDescription>支持任意组合，如 1d6+2、1d4+1d5+12d12、1d3 1d6</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="dice-expression">骰子表达式</Label>
              <Input
                id="dice-expression"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder="例如：1d4+1d5+12d12"
                onKeyDown={(e) => { if (e.key === 'Enter') handleRoll() }}
              />
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setExpression(preset)}
                    className="rounded-md border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="target-rate">成功率判定（可选，1-100）</Label>
              <Input
                id="target-rate"
                type="number"
                min={1}
                max={100}
                value={targetRateRaw}
                onChange={(e) => setTargetRateRaw(e.target.value)}
                placeholder="例如：50"
                onKeyDown={(e) => { if (e.key === 'Enter') handleRoll() }}
              />
              <p className="text-xs text-muted-foreground">
                填写后额外投掷 1d100 按 COC 7 版规则判定：骰值=1 大成功；≤目标/5 极难成功；≤目标/2 困难成功；≤目标 成功；目标&lt;50 时 96-100 大失败，目标≥50 时 100 大失败；其余失败
              </p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-2">
            <Button onClick={handleRoll}>
              <Dices className="mr-2 size-4" />
              掷骰
            </Button>
            <Button variant="outline" onClick={clearHistory} disabled={history.length === 0}>
              <Trash2 className="mr-2 size-4" />
              清空历史
            </Button>
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>历史结果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {history.map((result) => (
              <div key={result.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatTime(result.timestamp)}</span>
                  <span className="font-semibold text-foreground">总计：{result.grandTotal}</span>
                </div>
                <div className="space-y-1">
                  {result.terms.map((term, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-x-2 text-sm">
                      <span className="text-muted-foreground">{renderSign(term, index)}</span>
                      {term.type === 'dice' ? (
                        <>
                          <span className="font-medium">{term.raw}</span>
                          <span className="text-muted-foreground">
                            [{term.rolls.join(' + ')}]
                            {' = '}
                            <span className="font-semibold text-foreground">{term.total}</span>
                          </span>
                        </>
                      ) : (
                        <span className="font-medium">{term.value}</span>
                      )}
                    </div>
                  ))}
                </div>
                {result.targetRate !== null && result.rateRoll !== null && result.successLevel !== null && (
                  <div
                    className={cn(
                      'mt-2 flex items-center gap-2 rounded-md px-2 py-1 text-sm',
                      SUCCESS_LEVEL_STYLES[result.successLevel]
                    )}
                  >
                    <span>1d100 = {result.rateRoll}</span>
                    <span>/ 目标 {result.targetRate}</span>
                    <span className="font-semibold">{SUCCESS_LEVEL_LABELS[result.successLevel]}</span>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
