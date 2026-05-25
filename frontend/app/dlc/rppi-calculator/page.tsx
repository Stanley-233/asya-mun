'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Calculator, Plus, Trash2, Play } from 'lucide-react'
import { toast } from 'react-toastify'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/contexts/auth-context'
import { buildLoginRedirect } from '@/lib/auth/return-to'
import { cn } from '@/lib/utils'

declare global {
  interface Window {
    Module?: {
      ccall?: (ident: string, returnType: string, argTypes: string[], args: unknown[]) => string
      onRuntimeInitialized?: () => void
    }
  }
}

interface Country {
  name: string
  distance: number
  baseCount: number
  indicators: number[]
}

interface WasmResult {
  rppi: number
  basicProjectionScore: number
  geographicFriction: number
  militaryBaseScore: number
  economicBaseScore: number
  softBaseScore: number
  militaryRegionalScore: number
  economicRegionalScore: number
  softRegionalScore: number
  attentionScore: number
  brettonScore: number
  err?: string
}

interface ComputedEntry {
  index: number
  name: string
  result: WasmResult
}

interface AutoRanges {
  minValues: number[]
  maxValues: number[]
  tradeShareMin: number
  tradeShareMax: number
  investmentShareMin: number
  investmentShareMax: number
  brettonMin: number
  brettonMax: number
}

const METRIC_COLUMNS = [
  { key: 'distance', label: '距离', type: 'country' as const },
  { key: 'baseCount', label: '基地数量', type: 'country' as const },
  { key: 'indicator_1', label: 'x1 军费', type: 'indicator' as const, index: 0 },
  { key: 'indicator_2', label: 'x2 军队', type: 'indicator' as const, index: 1 },
  { key: 'indicator_3', label: 'x3 GDP', type: 'indicator' as const, index: 2 },
  { key: 'indicator_4', label: 'x4 SPI', type: 'indicator' as const, index: 3 },
  { key: 'indicator_5', label: 'x5 UN', type: 'indicator' as const, index: 4 },
  { key: 'indicator_6', label: 'x6 IMF', type: 'indicator' as const, index: 5 },
  { key: 'indicator_7', label: 'x7 WB', type: 'indicator' as const, index: 6 },
  { key: 'indicator_8', label: 'x8 武器', type: 'indicator' as const, index: 7 },
  { key: 'indicator_9', label: 'x9 军事行动', type: 'indicator' as const, index: 8 },
  { key: 'indicator_10', label: 'x10 贸易额', type: 'indicator' as const, index: 9 },
  { key: 'indicator_11', label: 'x11 援助贷款', type: 'indicator' as const, index: 10 },
  { key: 'indicator_12', label: 'x12 留学人数', type: 'indicator' as const, index: 11 },
  { key: 'indicator_13', label: 'x13 全球贸易', type: 'indicator' as const, index: 12 },
  { key: 'indicator_14', label: 'x14 区域投资', type: 'indicator' as const, index: 13 },
  { key: 'indicator_15', label: 'x15 对外投资', type: 'indicator' as const, index: 14 },
]

const INDICATOR_LABELS = METRIC_COLUMNS.filter((c) => c.type === 'indicator').map((c) => c.label)

const BLANK_COUNTRY: Country = {
  name: '',
  distance: 0,
  baseCount: 0,
  indicators: new Array(15).fill(0),
}

function numberFormat(value: number) {
  return Number.isFinite(value) ? value.toFixed(6) : '-'
}

function toNumber(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalize(value: number, min: number, max: number) {
  if (max <= min) return 0
  return Math.max(0, Math.min(1, (value - min) / (max - min)))
}

function computeAutoRanges(countries: Country[]): AutoRanges {
  const indicatorValues: number[][] = Array.from({ length: 15 }, () => [])
  const tradeShares: number[] = []
  const investmentShares: number[] = []
  const brettonScores: number[] = []

  for (const country of countries) {
    for (let i = 0; i < 15; i++) {
      indicatorValues[i].push(country.indicators[i] ?? 0)
    }
    const tradeShare =
      country.indicators[12] === 0 ? 0 : country.indicators[9] / country.indicators[12]
    const investmentShare =
      country.indicators[14] === 0 ? 0 : country.indicators[13] / country.indicators[14]
    tradeShares.push(tradeShare)
    investmentShares.push(investmentShare)
  }

  const minValues = indicatorValues.map((v) => Math.min(...v))
  const maxValues = indicatorValues.map((v) => Math.max(...v))

  for (const country of countries) {
    const imfNorm = normalize(country.indicators[5], minValues[5], maxValues[5])
    const wbNorm = normalize(country.indicators[6], minValues[6], maxValues[6])
    brettonScores.push((imfNorm + wbNorm) * 50)
  }

  return {
    minValues,
    maxValues,
    tradeShareMin: Math.min(...tradeShares),
    tradeShareMax: Math.max(...tradeShares),
    investmentShareMin: Math.min(...investmentShares),
    investmentShareMax: Math.max(...investmentShares),
    brettonMin: Math.min(...brettonScores),
    brettonMax: Math.max(...brettonScores),
  }
}

function buildPayload(country: Country, ranges: AutoRanges): string {
  const values: number[] = [country.distance, country.baseCount]
  for (const v of country.indicators) values.push(v)
  for (const v of ranges.minValues) values.push(v)
  for (const v of ranges.maxValues) values.push(v)
  values.push(
    ranges.tradeShareMin,
    ranges.tradeShareMax,
    ranges.investmentShareMin,
    ranges.investmentShareMax,
    ranges.brettonMin,
    ranges.brettonMax,
  )
  return values.join(';')
}

export default function RppiCalculatorPage() {
  const router = useRouter()
  const { isLoading, isAuthenticated } = useAuth()

  const [countries, setCountries] = useState<Country[]>([])
  const [computed, setComputed] = useState<ComputedEntry[]>([])
  const [selectedDetail, setSelectedDetail] = useState<ComputedEntry | null>(null)
  const [log, setLog] = useState(() => (typeof window !== 'undefined' && window.Module?.ccall ? 'WASM 已就绪。' : '等待初始化'))
  const [wasmReady, setWasmReady] = useState(() => typeof window !== 'undefined' && !!window.Module?.ccall)
  const [wasmError, setWasmError] = useState<string | null>(null)
  const scriptRef = useRef<HTMLScriptElement | null>(null)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push(buildLoginRedirect())
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (wasmReady) return

    const existing = document.querySelector('script[src="/wasm/asya_wasm.js"]')
    if (existing) {
      const check = setInterval(() => {
        if (window.Module?.ccall) {
          setWasmReady(true)
          setLog('WASM 已就绪。')
          clearInterval(check)
        }
      }, 200)
      return () => clearInterval(check)
    }

    window.Module = {
      onRuntimeInitialized() {
        setWasmReady(true)
        setLog('WASM 已就绪，可以开始计算。')
      },
    }

    const script = document.createElement('script')
    script.src = '/wasm/asya_wasm.js'
    script.async = true
    script.onerror = () => setWasmError('WASM 脚本加载失败')
    scriptRef.current = script
    document.body.appendChild(script)

    return () => {
      if (scriptRef.current) {
        document.body.removeChild(scriptRef.current)
        scriptRef.current = null
      }
    }
  }, [wasmReady])

  const handleAddCountry = useCallback(() => {
    setCountries((prev) => [...prev, { ...BLANK_COUNTRY, indicators: [...BLANK_COUNTRY.indicators] }])
    setComputed([])
    setSelectedDetail(null)
    toast.success('已新增一行国家数据')
  }, [])

  const handleRemoveCountry = useCallback((index: number) => {
    setCountries((prev) => prev.filter((_, i) => i !== index))
    setComputed([])
    setSelectedDetail(null)
    toast.info('国家行已删除，请重新计算。')
  }, [])

  const handleCellChange = useCallback((rowIndex: number, key: string, value: string) => {
    setCountries((prev) => {
      const next = [...prev]
      const country = { ...next[rowIndex] }

      if (key === 'name') {
        country.name = value
      } else if (key === 'distance') {
        country.distance = toNumber(value)
      } else if (key === 'baseCount') {
        country.baseCount = toNumber(value)
      } else if (key.startsWith('indicator_')) {
        const idx = Number.parseInt(key.split('_')[1], 10) - 1
        const indicators = [...country.indicators]
        indicators[idx] = toNumber(value)
        country.indicators = indicators
      }

      next[rowIndex] = country
      return next
    })
  }, [])

  const handleCalculate = useCallback(() => {
    if (!window.Module?.ccall) {
      toast.error('WASM 未就绪')
      return
    }
    if (countries.length === 0) {
      toast.warning('请先添加国家')
      return
    }

    const ranges = computeAutoRanges(countries)
    const entries: ComputedEntry[] = []

    for (let i = 0; i < countries.length; i++) {
      const country = countries[i]
      const payload = buildPayload(country, ranges)
      const raw = window.Module.ccall('process_input', 'string', ['string'], [payload])
      const result: WasmResult = JSON.parse(raw)

      if (result.err) {
        toast.error(`${country.name || `国家 ${i + 1}`} 计算失败: ${result.err}`)
        return
      }

      entries.push({ index: i, name: country.name, result })
    }

    entries.sort((a, b) => b.result.rppi - a.result.rppi)
    setComputed(entries)
    setSelectedDetail(entries[0] ?? null)
    setLog(
      JSON.stringify({ countryCount: countries.length, ranges, results: entries }, null, 2),
    )
    toast.success('计算完成')
  }, [countries])

  const ranges = countries.length > 0 ? computeAutoRanges(countries) : null

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-lg text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Calculator className="size-5" />
              </div>
              <div>
                <CardTitle>RPPI 计算器</CardTitle>
                <CardDescription>
                  DLC 扩展内容 - 按国家录入原始数据
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={handleAddCountry}>
                <Plus className="mr-1.5 size-3.5" />
                新增国家
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCalculate}
                disabled={!wasmReady || countries.length === 0}
              >
                <Play className="mr-1.5 size-3.5" />
                计算全部国家
              </Button>
              <Badge variant={wasmReady ? 'default' : wasmError ? 'destructive' : 'secondary'}>
                {wasmReady ? 'WASM 已就绪' : wasmError ?? 'WASM 加载中...'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>国家原始信息</CardTitle>
            <CardDescription>每一行输入一个国家。</CardDescription>
          </CardHeader>
          <CardContent>
            {countries.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                请先添加国家
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-[1960px] text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="sticky left-0 z-10 bg-muted/40 px-2 py-2 text-center font-medium">#</th>
                      <th className="px-2 py-2 text-left font-medium whitespace-nowrap">国家名称</th>
                      {METRIC_COLUMNS.map((col) => (
                        <th key={col.key} className="px-2 py-2 text-left font-medium whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-center font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countries.map((country, rowIndex) => (
                      <tr key={rowIndex} className="border-t hover:bg-muted/20">
                        <td className="sticky left-0 z-10 bg-card px-2 py-1 text-center text-muted-foreground">
                          {rowIndex + 1}
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="text"
                            className="h-7 w-full min-w-0 border-0 bg-transparent px-1.5 text-xs font-medium focus-visible:ring-0"
                            value={country.name}
                            onChange={(e) => handleCellChange(rowIndex, 'name', e.target.value)}
                            placeholder="国家名称"
                          />
                        </td>
                        {METRIC_COLUMNS.map((col) => {
                          const value =
                            col.type === 'country'
                              ? col.key === 'distance'
                                ? country.distance
                                : country.baseCount
                              : country.indicators[col.index!]
                          return (
                            <td key={col.key} className="px-1 py-1">
                              <Input
                                type="number"
                                step="any"
                                className="h-7 w-full min-w-0 border-0 bg-transparent px-1.5 text-xs focus-visible:ring-0"
                                value={value}
                                onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                              />
                            </td>
                          )
                        })}
                        <td className="px-2 py-1 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleRemoveCountry(rowIndex)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>归一化边界</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">指标</th>
                        <th className="px-2 py-1.5 text-left font-medium">最小值</th>
                        <th className="px-2 py-1.5 text-left font-medium">最大值</th>
                      </tr>
                    </thead>
                    <tbody>
                      {INDICATOR_LABELS.map((label, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1.5">{label}</td>
                          <td className="px-2 py-1.5 font-mono">
                            {ranges ? numberFormat(ranges.minValues[i]) : '-'}
                          </td>
                          <td className="px-2 py-1.5 font-mono">
                            {ranges ? numberFormat(ranges.maxValues[i]) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>派生区间</CardTitle>
              </CardHeader>
              <CardContent>
                {ranges ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { label: '贸易占比最小值', value: ranges.tradeShareMin },
                      { label: '贸易占比最大值', value: ranges.tradeShareMax },
                      { label: '投资占比最小值', value: ranges.investmentShareMin },
                      { label: '投资占比最大值', value: ranges.investmentShareMax },
                      { label: 'Bretton 指数最小值', value: ranges.brettonMin },
                      { label: 'Bretton 指数最大值', value: ranges.brettonMax },
                    ].map((item) => (
                      <div key={item.label} className="rounded-md border p-2">
                        <p className="text-[0.68rem] text-muted-foreground">{item.label}</p>
                        <p className="font-mono text-sm">{numberFormat(item.value)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">无国家数据</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>计算结果表</CardTitle>
              </CardHeader>
              <CardContent>
                {computed.length === 0 ? (
                  <p className="text-sm text-muted-foreground">等待执行</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">国家</th>
                          <th className="px-2 py-1.5 text-left font-medium">RPPI</th>
                          <th className="px-2 py-1.5 text-left font-medium">BRPPI</th>
                          <th className="px-2 py-1.5 text-left font-medium">地理摩擦</th>
                          <th className="px-2 py-1.5 text-left font-medium">区域注意力</th>
                        </tr>
                      </thead>
                      <tbody>
                        {computed.map((entry, i) => (
                          <tr
                            key={i}
                            className={cn(
                              'cursor-pointer border-t hover:bg-muted/20',
                              selectedDetail?.index === entry.index && 'bg-primary/5',
                            )}
                            onClick={() => setSelectedDetail(entry)}
                          >
                            <td className="px-2 py-1.5">
                              {entry.name || `国家 ${entry.index + 1}`}
                            </td>
                            <td className="px-2 py-1.5 font-mono">
                              {numberFormat(entry.result.rppi)}
                            </td>
                            <td className="px-2 py-1.5 font-mono">
                              {numberFormat(entry.result.basicProjectionScore)}
                            </td>
                            <td className="px-2 py-1.5 font-mono">
                              {numberFormat(entry.result.geographicFriction)}
                            </td>
                            <td className="px-2 py-1.5 font-mono">
                              {numberFormat(entry.result.attentionScore)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedDetail && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    详细结果 - {selectedDetail.name || `国家 ${selectedDetail.index + 1}`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { label: 'RPPI', value: selectedDetail.result.rppi },
                      { label: 'BRPPI', value: selectedDetail.result.basicProjectionScore },
                      { label: '地理摩擦系数', value: selectedDetail.result.geographicFriction },
                      { label: '军事基盘能力', value: selectedDetail.result.militaryBaseScore },
                      { label: '经济基盘能力', value: selectedDetail.result.economicBaseScore },
                      { label: '软实力基盘能力', value: selectedDetail.result.softBaseScore },
                      { label: '军事区域投入', value: selectedDetail.result.militaryRegionalScore },
                      { label: '经济区域投入', value: selectedDetail.result.economicRegionalScore },
                      {
                        label: '软实力区域投入',
                        value: selectedDetail.result.softRegionalScore,
                      },
                      { label: '区域注意力系数', value: selectedDetail.result.attentionScore },
                      { label: 'Bretton 指数', value: selectedDetail.result.brettonScore },
                    ].map((item) => (
                      <div key={item.label} className="rounded-md border p-2">
                        <p className="text-[0.68rem] text-muted-foreground">{item.label}</p>
                        <p className="font-mono text-sm">{numberFormat(item.value)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>计算日志</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                  {log}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
