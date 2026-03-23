'use client'

import { useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type RepresentativeSide = 'none' | 'attacker' | 'defender'
export type CombatResultCode = 'AE' | 'AR' | 'NE' | 'DR' | 'EX' | 'HX' | 'DE'

interface CalculationResult {
  attackSum: number
  defenseSum: number
  ratio: number
  roll: number
  columnIndex: number
  rowIndex: number
  code: CombatResultCode
}

const RATIO_COLUMN_LABELS = ['<0.5', '[0.5,1.5)', '[1.5,2)', '[2,2.5)', '[2.5,3)', '[3,3.5)', '>=3.5']

const RESULT_TABLE: CombatResultCode[][] = [
  ['AE', 'AR', 'AR', 'AR', 'NE', 'DR', 'EX'],
  ['AE', 'AR', 'NE', 'NE', 'DR', 'EX', 'HX'],
  ['AR', 'NE', 'NE', 'DR', 'DR', 'HX', 'DE'],
  ['AR', 'DR', 'DR', 'DR', 'EX', 'HX', 'DE'],
  ['NE', 'DR', 'DR', 'EX', 'HX', 'DE', 'DE'],
  ['NE', 'EX', 'EX', 'HX', 'DE', 'DE', 'DE'],
]

function getRatioColumnIndex(ratio: number) {
  if (ratio < 0.5) return 0
  if (ratio < 1.5) return 1
  if (ratio < 2) return 2
  if (ratio < 2.5) return 3
  if (ratio < 3) return 4
  if (ratio < 3.5) return 5
  return 6
}

function clampColumnIndex(index: number) {
  return Math.max(0, Math.min(6, index))
}

function parsePositiveInteger(raw: string) {
  const value = raw.trim()
  if (!/^\d+$/.test(value)) return null

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function parseBatchValues(raw: string) {
  const tokens = raw
    .split(/[，,]/)
    .map(token => token.trim())
    .filter(Boolean)

  if (tokens.length === 0) return { values: [] as number[], invalidToken: null as string | null }

  const values: number[] = []

  for (const token of tokens) {
    const parsed = parsePositiveInteger(token)
    if (parsed === null) {
      return { values: [] as number[], invalidToken: token }
    }
    values.push(parsed)
  }

  return { values, invalidToken: null as string | null }
}

interface ValueListSectionProps {
  title: string
  singleValue: string
  batchValue: string
  values: number[]
  onSingleValueChange: (value: string) => void
  onBatchValueChange: (value: string) => void
  onAddSingle: () => void
  onAddBatch: () => void
  onRemoveItem: (index: number) => void
}

function ValueListSection({
  title,
  singleValue,
  batchValue,
  values,
  onSingleValueChange,
  onBatchValueChange,
  onAddSingle,
  onAddBatch,
  onRemoveItem,
}: ValueListSectionProps) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium">{title}</h3>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input value={singleValue} onChange={event => onSingleValueChange(event.target.value)} placeholder="逐项添加（正整数）" />
        <Button type="button" variant="outline" onClick={onAddSingle}>
          添加
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input
          value={batchValue}
          onChange={event => onBatchValueChange(event.target.value)}
          placeholder="逗号批量输入，例如 3,5,7"
        />
        <Button type="button" variant="outline" onClick={onAddBatch}>
          批量导入
        </Button>
      </div>

      <div className="rounded-md border p-3">
        {values.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无数据</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {values.map((value, index) => (
              <div key={`${value}-${index}`} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm">
                <span>{value}</span>
                <button
                  type="button"
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  onClick={() => onRemoveItem(index)}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function QuickCalculator() {
  const [attackerValues, setAttackerValues] = useState<number[]>([])
  const [defenderValues, setDefenderValues] = useState<number[]>([])

  const [attackerSingleInput, setAttackerSingleInput] = useState('')
  const [defenderSingleInput, setDefenderSingleInput] = useState('')

  const [attackerBatchInput, setAttackerBatchInput] = useState('')
  const [defenderBatchInput, setDefenderBatchInput] = useState('')

  const [representativeSide, setRepresentativeSide] = useState<RepresentativeSide>('none')
  const [result, setResult] = useState<CalculationResult | null>(null)

  const attackSum = useMemo(() => attackerValues.reduce((sum, value) => sum + value, 0), [attackerValues])
  const defenseSum = useMemo(() => defenderValues.reduce((sum, value) => sum + value, 0), [defenderValues])

  const addSingleValue = (side: 'attacker' | 'defender') => {
    const value = side === 'attacker' ? attackerSingleInput : defenderSingleInput
    const parsed = parsePositiveInteger(value)

    if (parsed === null) {
      toast.warning('请输入正整数')
      return
    }

    if (side === 'attacker') {
      setAttackerValues(prev => [...prev, parsed])
      setAttackerSingleInput('')
      return
    }

    setDefenderValues(prev => [...prev, parsed])
    setDefenderSingleInput('')
  }

  const addBatchValues = (side: 'attacker' | 'defender') => {
    const value = side === 'attacker' ? attackerBatchInput : defenderBatchInput
    const parsed = parseBatchValues(value)

    if (parsed.invalidToken) {
      toast.warning(`批量输入包含无效值：${parsed.invalidToken}`)
      return
    }

    if (parsed.values.length === 0) {
      toast.warning('请先输入批量数值')
      return
    }

    if (side === 'attacker') {
      setAttackerValues(prev => [...prev, ...parsed.values])
      setAttackerBatchInput('')
      return
    }

    setDefenderValues(prev => [...prev, ...parsed.values])
    setDefenderBatchInput('')
  }

  const removeValue = (side: 'attacker' | 'defender', index: number) => {
    if (side === 'attacker') {
      setAttackerValues(prev => prev.filter((_, currentIndex) => currentIndex !== index))
      return
    }

    setDefenderValues(prev => prev.filter((_, currentIndex) => currentIndex !== index))
  }

  const handleRollAndCalculate = () => {
    if (defenseSum <= 0) {
      toast.warning('防守方总防御必须大于 0 才能计算')
      return
    }

    const roll = Math.floor(Math.random() * 6) + 1
    const ratio = attackSum / defenseSum

    let columnIndex = getRatioColumnIndex(ratio)
    if (representativeSide === 'attacker') {
      columnIndex = clampColumnIndex(columnIndex + 1)
    } else if (representativeSide === 'defender') {
      columnIndex = clampColumnIndex(columnIndex - 1)
    }

    const rowIndex = roll - 1
    const code = RESULT_TABLE[rowIndex][columnIndex]

    setResult({
      attackSum,
      defenseSum,
      ratio,
      roll,
      columnIndex,
      rowIndex,
      code,
    })
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">快捷计算</h3>
        <p className="text-sm text-muted-foreground">录入攻防列表、选择代表方并掷骰后，自动命中结果矩阵。</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ValueListSection
          title="进攻方攻击力"
          singleValue={attackerSingleInput}
          batchValue={attackerBatchInput}
          values={attackerValues}
          onSingleValueChange={setAttackerSingleInput}
          onBatchValueChange={setAttackerBatchInput}
          onAddSingle={() => addSingleValue('attacker')}
          onAddBatch={() => addBatchValues('attacker')}
          onRemoveItem={index => removeValue('attacker', index)}
        />
        <ValueListSection
          title="防守方防御力"
          singleValue={defenderSingleInput}
          batchValue={defenderBatchInput}
          values={defenderValues}
          onSingleValueChange={setDefenderSingleInput}
          onBatchValueChange={setDefenderBatchInput}
          onAddSingle={() => addSingleValue('defender')}
          onAddBatch={() => addBatchValues('defender')}
          onRemoveItem={index => removeValue('defender', index)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">计算设置</CardTitle>
          <CardDescription>代表方会将比值列朝有利方向移动一列。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>代表方</Label>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="representative-side"
                  checked={representativeSide === 'none'}
                  onChange={() => setRepresentativeSide('none')}
                />
                <span>无代表</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="representative-side"
                  checked={representativeSide === 'attacker'}
                  onChange={() => setRepresentativeSide('attacker')}
                />
                <span>进攻方代表</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="representative-side"
                  checked={representativeSide === 'defender'}
                  onChange={() => setRepresentativeSide('defender')}
                />
                <span>防守方代表</span>
              </label>
            </div>
          </div>

          <Button type="button" onClick={handleRollAndCalculate}>
            掷骰并计算
          </Button>

          <div className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            <p>
              <span className="text-muted-foreground">进攻总和：</span>
              <span>{result?.attackSum ?? attackSum}</span>
            </p>
            <p>
              <span className="text-muted-foreground">防守总和：</span>
              <span>{result?.defenseSum ?? defenseSum}</span>
            </p>
            <p>
              <span className="text-muted-foreground">A:D 比值：</span>
              <span>{result ? result.ratio.toFixed(3) : defenseSum > 0 ? (attackSum / defenseSum).toFixed(3) : '-'}</span>
            </p>
            <p>
              <span className="text-muted-foreground">骰值 / 结果：</span>
              <span>{result ? `${result.roll} / ${result.code}` : '-'}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="max-w-full overflow-x-auto rounded-lg border">
        <table className="min-w-[880px] text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium whitespace-nowrap">骰值</th>
              {RATIO_COLUMN_LABELS.map((label, columnIndex) => (
                <th
                  key={label}
                  className={cn(
                    'px-3 py-2 text-left font-medium whitespace-nowrap',
                    result?.columnIndex === columnIndex ? 'bg-primary/15 text-primary' : undefined,
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RESULT_TABLE.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="border-t">
                <td
                  className={cn(
                    'px-3 py-2 font-medium whitespace-nowrap',
                    result?.rowIndex === rowIndex ? 'bg-primary/15 text-primary' : undefined,
                  )}
                >
                  {rowIndex + 1}
                </td>
                {row.map((code, columnIndex) => {
                  const isHit = result?.rowIndex === rowIndex && result.columnIndex === columnIndex
                  return (
                    <td
                      key={`${rowIndex}-${columnIndex}`}
                      className={cn(
                        'px-3 py-2 whitespace-nowrap',
                        isHit ? 'bg-primary font-semibold text-primary-foreground' : undefined,
                      )}
                    >
                      {code}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
