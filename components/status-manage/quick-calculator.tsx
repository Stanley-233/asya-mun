'use client'

import { useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type RepresentativeSide = 'none' | 'attacker' | 'defender'
export type CombatResultCode = 'AE' | 'DE' | 'AL' | 'DL' | 'AA' | 'DA' | 'BL' | 'AR' | 'DR'
type SupplyLevel = 'full' | 'normal' | 'lost'

interface CombatUnit {
  attack: number
  defense: number
  order: number
}

interface LossOutcome {
  removeCount: number
  retreat: boolean
}

interface RemovalUnit extends CombatUnit {
  side: 'attacker' | 'defender'
}

interface CalculationResult {
  attackSum: number
  defenseSum: number
  ratioRaw: number
  baseColumnIndex: number
  shift: number
  roll: number
  columnIndex: number
  rowIndex: number
  code: CombatResultCode
  attackerLoss: LossOutcome
  defenderLoss: LossOutcome
  attackerRemoved: RemovalUnit[]
  defenderRemoved: RemovalUnit[]
}

interface NavalResult {
  probability: number
  triggerRoll: number
  occurred: boolean
  initiativeShift: number
  initiativeSide: RepresentativeSide
  calculation: CalculationResult | null
}

const RATIO_COLUMN_LABELS = ['<=0.5', '[0.5,1.5)', '[1.5,2)', '[2,3)', '[3,4)', '>=4']

const RESULT_TABLE: CombatResultCode[][] = [
  ['AE', 'AL', 'AR', 'DA', 'DA', 'BL'],
  ['AL', 'AR', 'DA', 'BL', 'AA', 'AA'],
  ['AR', 'DA', 'BL', 'AA', 'AA', 'DR'],
  ['DA', 'BL', 'AA', 'AA', 'DR', 'DL'],
  ['BL', 'AA', 'DR', 'DR', 'DL', 'DE'],
  ['AA', 'DR', 'DL', 'DL', 'DE', 'DE'],
]

function getRatioColumnIndexByRange(ratioRaw: number) {
  if (!Number.isFinite(ratioRaw)) return 5
  if (ratioRaw < 0.5) return 0
  if (ratioRaw < 1.5) return 1
  if (ratioRaw < 2) return 2
  if (ratioRaw < 3) return 3
  if (ratioRaw < 4) return 4
  return 5
}

function getSupplyRank(level: SupplyLevel) {
  if (level === 'lost') return 0
  if (level === 'normal') return 1
  return 2
}

function getShiftDirectionByRepresentativeSide(side: RepresentativeSide) {
  if (side === 'attacker') return 1
  if (side === 'defender') return -1
  return 0
}

function getSupplyShift(attackerSupply: SupplyLevel, defenderSupply: SupplyLevel) {
  let shift = 0
  const attackerRank = getSupplyRank(attackerSupply)
  const defenderRank = getSupplyRank(defenderSupply)

  if (attackerRank > defenderRank) shift += 1
  if (attackerRank < defenderRank) shift -= 1

  if (attackerSupply === 'lost') shift -= 1
  if (defenderSupply === 'lost') shift += 1

  return shift
}

function clampColumnIndex(index: number) {
  return Math.max(0, Math.min(5, index))
}

function parseNonNegativeInteger(raw: string) {
  const value = raw.trim()
  if (!/^\d+$/.test(value)) return null

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}

function parseUnits(raw: string) {
  const tokens = raw
    .split(/[，,]/)
    .map(token => token.trim())
    .filter(Boolean)

  if (tokens.length === 0) return { values: [] as CombatUnit[], invalidToken: null as string | null }

  const values: CombatUnit[] = []
  for (const [index, token] of tokens.entries()) {
    const parts = token.split('-').map(part => part.trim())
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return { values: [] as CombatUnit[], invalidToken: token }
    }

    const attack = parseNonNegativeInteger(parts[0])
    const defense = parseNonNegativeInteger(parts[1])
    if (attack === null || defense === null) {
      return { values: [] as CombatUnit[], invalidToken: token }
    }

    values.push({
      attack,
      defense,
      order: index + 1,
    })
  }

  return { values, invalidToken: null as string | null }
}

function pickUnitsForRemoval(units: CombatUnit[], removeCount: number, side: 'attacker' | 'defender') {
  if (removeCount <= 0 || units.length === 0) return [] as RemovalUnit[]

  const count = Math.min(removeCount, units.length)
  const ranked = units
    .map(unit => ({ ...unit, seed: Math.random() }))
    .sort((a, b) => a.attack - b.attack || a.seed - b.seed)
    .slice(0, count)

  return ranked.map(unit => ({
    attack: unit.attack,
    defense: unit.defense,
    order: unit.order,
    side,
  }))
}

function ceilDivision(total: number, divisor: number) {
  if (total <= 0) return 0
  let result = total / divisor
  let floor = Math.floor(result)
  let remain = result - floor
  if (remain > 0.35) floor += 1
  return floor
}

function getLossByCode(code: CombatResultCode, attackerTotal: number, defenderTotal: number) {
  let attackerLoss: LossOutcome = { removeCount: 0, retreat: false }
  let defenderLoss: LossOutcome = { removeCount: 0, retreat: false }

  if (code === 'AE') attackerLoss = { removeCount: attackerTotal, retreat: false }
  if (code === 'DE') defenderLoss = { removeCount: defenderTotal, retreat: false }

  if (code === 'AL') attackerLoss = { removeCount: ceilDivision(attackerTotal, 2), retreat: true }
  if (code === 'DL') defenderLoss = { removeCount: ceilDivision(defenderTotal, 2), retreat: true }

  if (code === 'AA') {
    attackerLoss = { removeCount: ceilDivision(attackerTotal, 6), retreat: false }
    defenderLoss = { removeCount: ceilDivision(defenderTotal, 3), retreat: false }
  }

  if (code === 'DA') {
    attackerLoss = { removeCount: ceilDivision(attackerTotal, 3), retreat: false }
    defenderLoss = { removeCount: ceilDivision(defenderTotal, 6), retreat: false }
  }

  if (code === 'BL') {
    attackerLoss = { removeCount: ceilDivision(attackerTotal, 3), retreat: false }
    defenderLoss = { removeCount: ceilDivision(defenderTotal, 3), retreat: false }
  }

  if (code === 'AR') attackerLoss = { removeCount: 1, retreat: true }
  if (code === 'DR') defenderLoss = { removeCount: 1, retreat: true }

  return {
    attackerLoss: { ...attackerLoss, removeCount: Math.min(attackerTotal, attackerLoss.removeCount) },
    defenderLoss: { ...defenderLoss, removeCount: Math.min(defenderTotal, defenderLoss.removeCount) },
  }
}

function getResultDescription(code: CombatResultCode) {
  if (code === 'AE') return '攻方全歼'
  if (code === 'DE') return '守方全歼'
  if (code === 'AL') return '攻方溃退'
  if (code === 'DL') return '守方溃退'
  if (code === 'AA') return '攻方有利'
  if (code === 'DA') return '守方有利'
  if (code === 'BL') return '拉锯'
  if (code === 'AR') return '攻方撤退'
  return '守方撤退'
}

function calculateCombat(attackerUnits: CombatUnit[], defenderUnits: CombatUnit[], shift: number): CalculationResult {
  const attackSum = attackerUnits.reduce((sum, unit) => sum + unit.attack, 0)
  const defenseSum = defenderUnits.reduce((sum, unit) => sum + unit.defense, 0)
  const ratioRaw = defenseSum === 0 ? Number.POSITIVE_INFINITY : attackSum / defenseSum
  const baseColumnIndex = getRatioColumnIndexByRange(ratioRaw)
  const columnIndex = clampColumnIndex(baseColumnIndex + shift)

  const roll = Math.floor(Math.random() * 6) + 1
  const rowIndex = roll - 1
  const code = RESULT_TABLE[rowIndex][columnIndex]
  const { attackerLoss, defenderLoss } = getLossByCode(code, attackerUnits.length, defenderUnits.length)

  return {
    attackSum,
    defenseSum,
    ratioRaw,
    baseColumnIndex,
    shift,
    roll,
    columnIndex,
    rowIndex,
    code,
    attackerLoss,
    defenderLoss,
    attackerRemoved: pickUnitsForRemoval(attackerUnits, attackerLoss.removeCount, 'attacker'),
    defenderRemoved: pickUnitsForRemoval(defenderUnits, defenderLoss.removeCount, 'defender'),
  }
}

function UnitList({
  title,
  units,
}: {
  title: string
  units: CombatUnit[]
}) {
  return (
    <div className="rounded-md border p-2">
      <p className="mb-1 text-xs text-muted-foreground">{title}</p>
      {units.length === 0 ? (
        <p className="text-xs text-muted-foreground">暂无算子</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {units.map(unit => (
            <span key={`${title}-${unit.order}-${unit.attack}-${unit.defense}`} className="rounded bg-muted px-2 py-0.5 text-xs">
              #{unit.order} {unit.attack}-{unit.defense}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function RemovalList({
  title,
  removed,
}: {
  title: string
  removed: RemovalUnit[]
}) {
  return (
    <div className="rounded-md border p-2">
      <p className="mb-1 text-xs text-muted-foreground">{title}</p>
      {removed.length === 0 ? (
        <p className="text-xs text-muted-foreground">无需移除</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {removed.map((unit, index) => (
            <span key={`${title}-${unit.side}-${unit.order}-${index}`} className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
              #{unit.order} {unit.attack}-{unit.defense}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function QuickCalculator() {
  const [attackerInput, setAttackerInput] = useState('')
  const [defenderInput, setDefenderInput] = useState('')
  const [attackerUnits, setAttackerUnits] = useState<CombatUnit[]>([])
  const [defenderUnits, setDefenderUnits] = useState<CombatUnit[]>([])
  const [representativeSide, setRepresentativeSide] = useState<RepresentativeSide>('none')
  const [defenderCityAdvantage, setDefenderCityAdvantage] = useState(false)
  const [attackerLandingArmyDisadvantage, setAttackerLandingArmyDisadvantage] = useState(false)
  const [attackerSupply, setAttackerSupply] = useState<SupplyLevel>('normal')
  const [defenderSupply, setDefenderSupply] = useState<SupplyLevel>('normal')
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [enableNaval, setEnableNaval] = useState(false)
  const [attackerSeekNaval, setAttackerSeekNaval] = useState(false)
  const [defenderSeekNaval, setDefenderSeekNaval] = useState(false)
  const [navalProbabilityInput, setNavalProbabilityInput] = useState('50')
  const [navalResult, setNavalResult] = useState<NavalResult | null>(null)

  const attackSum = useMemo(() => attackerUnits.reduce((sum, unit) => sum + unit.attack, 0), [attackerUnits])
  const defenseSum = useMemo(() => defenderUnits.reduce((sum, unit) => sum + unit.defense, 0), [defenderUnits])

  const currentRatioRaw = defenseSum === 0 ? (attackSum > 0 ? Number.POSITIVE_INFINITY : 0) : attackSum / defenseSum
  const currentBaseColumnIndex = getRatioColumnIndexByRange(currentRatioRaw)

  const handleParseInputs = () => {
    const attackerParsed = parseUnits(attackerInput)
    if (attackerParsed.invalidToken) {
      toast.warning(`攻方输入包含无效值：${attackerParsed.invalidToken}`)
      return null
    }

    const defenderParsed = parseUnits(defenderInput)
    if (defenderParsed.invalidToken) {
      toast.warning(`守方输入包含无效值：${defenderParsed.invalidToken}`)
      return null
    }

    if (attackerParsed.values.length === 0 || defenderParsed.values.length === 0) {
      toast.warning('攻守双方都需要至少 1 个算子')
      return null
    }

    setAttackerUnits(attackerParsed.values)
    setDefenderUnits(defenderParsed.values)

    return {
      attacker: attackerParsed.values,
      defender: defenderParsed.values,
    }
  }

  const handleRollAndCalculate = () => {
    const parsed = handleParseInputs()
    if (!parsed) return

    const nextAttackSum = parsed.attacker.reduce((sum, unit) => sum + unit.attack, 0)
    const nextDefenseSum = parsed.defender.reduce((sum, unit) => sum + unit.defense, 0)
    if (nextDefenseSum === 0 && nextAttackSum === 0) {
      toast.warning('攻守总战力同时为 0，无法计算')
      return
    }

    const representativeShift = getShiftDirectionByRepresentativeSide(representativeSide)
    const cityShift = defenderCityAdvantage ? -1 : 0
    const landingArmyShift = attackerLandingArmyDisadvantage ? -1 : 0
    const supplyShift = getSupplyShift(attackerSupply, defenderSupply)
    const shift = representativeShift + cityShift + landingArmyShift + supplyShift

    setResult(calculateCombat(parsed.attacker, parsed.defender, shift))
  }

  const handleRollNaval = () => {
    const parsed = handleParseInputs()
    if (!parsed) return

    const nextAttackSum = parsed.attacker.reduce((sum, unit) => sum + unit.attack, 0)
    const nextDefenseSum = parsed.defender.reduce((sum, unit) => sum + unit.defense, 0)
    if (nextDefenseSum === 0 && nextAttackSum === 0) {
      toast.warning('攻守总战力同时为 0，无法进行海战判定')
      return
    }

    const probability = Number(navalProbabilityInput.trim())
    if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
      toast.warning('海战发生概率需输入 0-100 的数字')
      return
    }

    const triggerRoll = Math.random() * 100
    const occurred = triggerRoll < probability

    let initiativeShift = 0
    let initiativeSide: RepresentativeSide = 'none'
    if (attackerSeekNaval !== defenderSeekNaval) {
      initiativeShift = attackerSeekNaval ? 1 : -1
      initiativeSide = attackerSeekNaval ? 'attacker' : 'defender'
    }

    setNavalResult({
      probability,
      triggerRoll,
      occurred,
      initiativeShift,
      initiativeSide,
      calculation: occurred ? calculateCombat(parsed.attacker, parsed.defender, initiativeShift) : null,
    })
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">快捷战斗计算器</h3>
        <p className="text-xs text-muted-foreground">输入格式：攻方 `5-3,2-1`；守方 `4-2,1-1`。支持 `0-1`、`1-0`。计算按攻方攻击力/守方防御力求和，移除按攻击力最低优先。</p>
      </div>

      <div className="grid gap-2 xl:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1">
          <Label className="text-xs">攻方算子（攻-防）</Label>
          <Input value={attackerInput} onChange={event => setAttackerInput(event.target.value)} placeholder="例如 5-3,2-1" className="h-8" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">守方算子（攻-防）</Label>
          <Input value={defenderInput} onChange={event => setDefenderInput(event.target.value)} placeholder="例如 4-2,1-1" className="h-8" />
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={handleRollAndCalculate} className="h-8 w-full xl:w-auto">
            掷骰并计算
          </Button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
        <div className="space-y-2 rounded-md border p-2">
          <Label className="text-xs">代表受益方</Label>
          <div className="flex flex-wrap gap-2 text-xs">
            <label className="flex items-center gap-1">
              <input type="radio" name="representative-side" checked={representativeSide === 'none'} onChange={() => setRepresentativeSide('none')} />
              <span>无</span>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="representative-side"
                checked={representativeSide === 'attacker'}
                onChange={() => setRepresentativeSide('attacker')}
              />
              <span>攻方</span>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="representative-side"
                checked={representativeSide === 'defender'}
                onChange={() => setRepresentativeSide('defender')}
              />
              <span>守方</span>
            </label>
          </div>
        </div>

        <div className="space-y-2 rounded-md border p-2">
          <Label className="text-xs">守城优势</Label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={defenderCityAdvantage}
              onChange={event => setDefenderCityAdvantage(event.target.checked)}
            />
            <span>本次守城优势生效</span>
          </label>
        </div>

        <div className="space-y-2 rounded-md border p-2">
          <Label className="text-xs">下船陆军劣势</Label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={attackerLandingArmyDisadvantage}
              onChange={event => setAttackerLandingArmyDisadvantage(event.target.checked)}
            />
            <span>攻方下船陆军劣势</span>
          </label>
        </div>

        <div className="space-y-1 rounded-md border p-2">
          <Label className="text-xs">攻方补给</Label>
          <select value={attackerSupply} onChange={event => setAttackerSupply(event.target.value as SupplyLevel)} className="h-8 w-full rounded border px-2 text-xs">
            <option value="full">充足补给</option>
            <option value="normal">一般补给</option>
            <option value="lost">丧失补给</option>
          </select>
        </div>

        <div className="space-y-1 rounded-md border p-2">
          <Label className="text-xs">守方补给</Label>
          <select value={defenderSupply} onChange={event => setDefenderSupply(event.target.value as SupplyLevel)} className="h-8 w-full rounded border px-2 text-xs">
            <option value="full">充足补给</option>
            <option value="normal">一般补给</option>
            <option value="lost">丧失补给</option>
          </select>
        </div>

        <div className="space-y-2 rounded-md border p-2 text-xs">
          <p className="text-muted-foreground">预览战力比</p>
          <p>
            原始值：{Number.isFinite(currentRatioRaw) ? currentRatioRaw.toFixed(3) : '∞'} / 区间：{RATIO_COLUMN_LABELS[currentBaseColumnIndex]}
          </p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <UnitList title="攻方算子明细" units={attackerUnits} />
        <UnitList title="守方算子明细" units={defenderUnits} />
      </div>

      <Card>
        <CardContent className="space-y-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={enableNaval}
              onChange={event => {
                const checked = event.target.checked
                setEnableNaval(checked)
                if (!checked) setNavalResult(null)
              }}
            />
            <span>启用海战配置（默认关闭）</span>
          </label>

          {enableNaval ? (
            <div className="space-y-2">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <label className="flex items-center gap-2 rounded-md border p-2 text-xs">
                  <input type="checkbox" checked={attackerSeekNaval} onChange={event => setAttackerSeekNaval(event.target.checked)} />
                  <span>攻方寻敌接战</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border p-2 text-xs">
                  <input type="checkbox" checked={defenderSeekNaval} onChange={event => setDefenderSeekNaval(event.target.checked)} />
                  <span>守方寻敌接战</span>
                </label>
                <div className="flex gap-2 rounded-md border p-2 items-center">
                  <Label className="text-xs whitespace-nowrap">海战发生概率（0-100）</Label>
                  <Input
                    value={navalProbabilityInput}
                    onChange={event => setNavalProbabilityInput(event.target.value)}
                    className="h-8 w-24"
                    placeholder="例如 50"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="button" onClick={handleRollNaval} className="h-8 w-full">
                    海战判定并结算
                  </Button>
                </div>
              </div>

              {navalResult ? (
                <div className="space-y-2 rounded-md border p-2">
                  <div className="grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-6">
                    <p className="rounded border p-2">
                      <span className="text-muted-foreground">发生概率：</span>
                      <span>{navalResult.probability.toFixed(1)}%</span>
                    </p>
                    <p className="rounded border p-2">
                      <span className="text-muted-foreground">随机值：</span>
                      <span>{navalResult.triggerRoll.toFixed(1)}%</span>
                    </p>
                    <p className="rounded border p-2">
                      <span className="text-muted-foreground">是否发生：</span>
                      <span>{navalResult.occurred ? '发生海战' : '未发生海战'}</span>
                    </p>
                    <p className="rounded border p-2">
                      <span className="text-muted-foreground">先手方：</span>
                      <span>
                        {navalResult.initiativeSide === 'none'
                          ? '无'
                          : navalResult.initiativeSide === 'attacker'
                            ? '攻方'
                            : '守方'}
                      </span>
                    </p>
                    <p className="rounded border p-2">
                      <span className="text-muted-foreground">海战偏移：</span>
                      <span>{navalResult.initiativeShift > 0 ? `+${navalResult.initiativeShift}` : navalResult.initiativeShift}</span>
                    </p>
                    <p className="rounded border p-2">
                      <span className="text-muted-foreground">海战结果：</span>
                      <span>{navalResult.calculation ? `${navalResult.calculation.roll} / ${navalResult.calculation.code}` : '-'}</span>
                    </p>
                  </div>

                  {navalResult.calculation ? (
                    <>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="rounded-md border p-2 text-xs">
                          <p className="mb-1 text-muted-foreground">海战攻方战损</p>
                          <p>需移除：{navalResult.calculation.attackerLoss.removeCount} 个</p>
                          <p>后撤：{navalResult.calculation.attackerLoss.retreat ? '是' : '否'}</p>
                        </div>
                        <div className="rounded-md border p-2 text-xs">
                          <p className="mb-1 text-muted-foreground">海战守方战损</p>
                          <p>需移除：{navalResult.calculation.defenderLoss.removeCount} 个</p>
                          <p>后撤：{navalResult.calculation.defenderLoss.retreat ? '是' : '否'}</p>
                        </div>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <RemovalList title="海战攻方应移除算子（按攻击力低优先）" removed={navalResult.calculation.attackerRemoved} />
                        <RemovalList title="海战守方应移除算子（按攻击力低优先）" removed={navalResult.calculation.defenderRemoved} />
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">结算结果</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-2 text-xs md:grid-cols-3 xl:grid-cols-6">
            <p className="rounded border p-2">
              <span className="text-muted-foreground">攻方总战力：</span>
              <span>{result?.attackSum ?? attackSum}</span>
            </p>
            <p className="rounded border p-2">
              <span className="text-muted-foreground">守方总战力：</span>
              <span>{result?.defenseSum ?? defenseSum}</span>
            </p>
            <p className="rounded border p-2">
              <span className="text-muted-foreground">基础列：</span>
              <span>{result ? RATIO_COLUMN_LABELS[result.baseColumnIndex] : '-'}</span>
            </p>
            <p className="rounded border p-2">
              <span className="text-muted-foreground">总偏移：</span>
              <span>{result ? `${result.shift > 0 ? '+' : ''}${result.shift}` : '-'}</span>
            </p>
            <p className="rounded border p-2">
              <span className="text-muted-foreground">骰值 / 结果：</span>
              <span>{result ? `${result.roll} / ${result.code}` : '-'}</span>
            </p>
            <p className="rounded border p-2">
              <span className="text-muted-foreground">描述：</span>
              <span>{result ? getResultDescription(result.code) : '-'}</span>
            </p>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-md border p-2 text-xs">
              <p className="mb-1 text-muted-foreground">攻方战损</p>
              <p>需移除：{result?.attackerLoss.removeCount ?? 0} 个</p>
              <p>后撤：{result?.attackerLoss.retreat ? '是' : '否'}</p>
            </div>
            <div className="rounded-md border p-2 text-xs">
              <p className="mb-1 text-muted-foreground">守方战损</p>
              <p>需移除：{result?.defenderLoss.removeCount ?? 0} 个</p>
              <p>后撤：{result?.defenderLoss.retreat ? '是' : '否'}</p>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <RemovalList title="攻方应移除算子（按攻击力低优先）" removed={result?.attackerRemoved ?? []} />
            <RemovalList title="守方应移除算子（按攻击力低优先）" removed={result?.defenderRemoved ?? []} />
          </div>
        </CardContent>
      </Card>

      <div className="max-w-full overflow-x-auto rounded-lg border">
        <table className="min-w-[760px] text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-1 text-left font-medium whitespace-nowrap">骰值</th>
              {RATIO_COLUMN_LABELS.map((label, columnIndex) => (
                <th
                  key={label}
                  className={cn(
                    'px-2 py-1 text-left font-medium whitespace-nowrap',
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
                <td className={cn('px-2 py-1 font-medium whitespace-nowrap', result?.rowIndex === rowIndex ? 'bg-primary/15 text-primary' : undefined)}>
                  {rowIndex + 1}
                </td>
                {row.map((code, columnIndex) => {
                  const isHit = result?.rowIndex === rowIndex && result.columnIndex === columnIndex
                  return (
                    <td
                      key={`${rowIndex}-${columnIndex}`}
                      className={cn('px-2 py-1 whitespace-nowrap', isHit ? 'bg-primary font-semibold text-primary-foreground' : undefined)}
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
