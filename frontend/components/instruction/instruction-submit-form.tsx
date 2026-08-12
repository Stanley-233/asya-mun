'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCreate2 } from '@/lib/api/hooks/instruction'
import type { InstructionCreateRequestInstructionType } from '@/lib/api/generated'
import { toast } from 'react-toastify'
import { useAuth } from '@/lib/contexts/auth-context'
import { INSTRUCTION_TYPE_LABELS } from './instruction-utils'

const instructionTypes: InstructionCreateRequestInstructionType[] = [
  'MILITARY',
  'DIPLOMACY',
  'ECONOMY',
  'INTERNAL',
  'OTHER',
]
// 指令字数上限已放开，如需恢复请取消以下注释并恢复各输入框的 maxLength / limitInstructionInput 调用
// const INSTRUCTION_INPUT_MAX_CHARS = 1500

const SECRECY_OPTIONS = ['公开', '保密'] as const

// function limitInstructionInput(value: string) {
//   return Array.from(value).slice(0, INSTRUCTION_INPUT_MAX_CHARS).join('')
// }

// function getInstructionInputLength(value: string) {
//   return Array.from(value).length
// }

function getInstructionSubmitErrorMessage(error: unknown) {
  const fallbackMessage = '指令提交失败，请稍后重试'
  const responseMessage =
    error &&
    typeof error === 'object' &&
    'response' in error &&
    (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
  const directMessage =
    error &&
    typeof error === 'object' &&
    'message' in error &&
    (error as { message?: unknown }).message
  const message = typeof responseMessage === 'string'
    ? responseMessage
    : typeof directMessage === 'string'
      ? directMessage
      : ''

  if (message.includes('Instruction submission is paused')) {
    return '当前会议已暂停指令提交，请等待主席团指导恢复。'
  }

  return message.trim() || fallbackMessage
}

function getUserDrafterName(user?: { displayName?: string | null; name?: string | null }) {
  const displayName = user?.displayName?.trim()
  const name = user?.name?.trim() || ''
  return displayName ? `${displayName}（${name}）` : name
}

interface InstructionSubmitFormProps {
  disabled?: boolean
  disabledReason?: string
  onSuccess?: () => void
}

export function InstructionSubmitForm({
  disabled = false,
  disabledReason,
  onSuccess,
}: InstructionSubmitFormProps) {
  const { mutate: createInstruction, isPending } = useCreate2()
  const { user } = useAuth()

  const [country, setCountry] = useState('')
  const [meetingUnit, setMeetingUnit] = useState('')
  const [instructionType, setInstructionType] = useState<InstructionCreateRequestInstructionType>('MILITARY')
  const [drafter, setDrafter] = useState(() => getUserDrafterName(user ?? undefined))
  const [situationUpdate, setSituationUpdate] = useState('')
  const [target, setTarget] = useState('')
  const [secrecy, setSecrecy] = useState<string>('保密')
  const [content, setContent] = useState('')
  const [purpose, setPurpose] = useState('')

  const defaultDrafter = useMemo(() => getUserDrafterName(user ?? undefined), [user])

  const title = useMemo(() => {
    const countryName = country.trim()
    const unit = meetingUnit.trim()
    if (!countryName && !unit) return ''
    return `【${countryName}】第 ${unit} 会议单元`
  }, [country, meetingUnit])

  const assembledContent = useMemo(() => {
    const lines = [
      `起草人：${drafter.trim()}`,
      `对应局势更新：${situationUpdate.trim() || '无'}`,
      `指令类型：${INSTRUCTION_TYPE_LABELS[instructionType]}`,
      `指令对象：${target.trim()}`,
      `保密程度：${secrecy}`,
      `指令内容：${content.trim()}`,
      `行动目的：${purpose.trim()}`,
    ]
    return lines.join('\n')
  }, [drafter, situationUpdate, instructionType, target, secrecy, content, purpose])

  const resetForm = () => {
    setCountry('')
    setMeetingUnit('')
    setInstructionType('MILITARY')
    setDrafter(defaultDrafter)
    setSituationUpdate('')
    setTarget('')
    setSecrecy('保密')
    setContent('')
    setPurpose('')
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (disabled) return

    if (!title.trim()) {
      toast.error('请填写国家与会议单元序号')
      return
    }

    if (!drafter.trim()) {
      toast.error('请填写起草人')
      return
    }

    if (!target.trim()) {
      toast.error('请填写指令对象')
      return
    }

    if (!content.trim()) {
      toast.error('请填写指令内容')
      return
    }

    createInstruction(
      {
        data: {
          title: title.trim(),
          instructionType,
          content: assembledContent,
        },
      },
      {
        onSuccess: () => {
          toast.success('指令提交成功')
          resetForm()
          onSuccess?.()
        },
        onError: error => {
          console.error('Failed to create instruction:', error)
          toast.error(getInstructionSubmitErrorMessage(error))
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>代表提交指令</CardTitle>
        <CardDescription>提交后不可修改，请确认内容无误后再提交</CardDescription>
      </CardHeader>
      <CardContent>
        {disabled && (
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
            {disabledReason || '当前无法提交指令'}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>指令分类</Label>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-6 px-2 text-sm">
                PJMUN
              </Badge>
              <span className="text-sm text-muted-foreground">当前会议分类标签，自动显示</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>标题</Label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Input
                  id="instruction-country"
                  value={country}
                  onChange={event => setCountry(event.target.value)}
                  placeholder="国家，如“德国”"
                  disabled={disabled || isPending}
                  // maxLength={INSTRUCTION_INPUT_MAX_CHARS}
                />
              </div>
              <div className="space-y-2">
                <Input
                  id="instruction-meeting-unit"
                  type="number"
                  min={1}
                  step={1}
                  value={meetingUnit}
                  onChange={event => setMeetingUnit(event.target.value)}
                  placeholder="会议单元序号，如“1”"
                  disabled={disabled || isPending}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              标题将自动生成为：{title || '【国家】第 X 会议单元'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instruction-type">一级分类</Label>
            <Select
              value={instructionType}
              onValueChange={value => setInstructionType(value as InstructionCreateRequestInstructionType)}
              disabled={disabled || isPending}
            >
              <SelectTrigger id="instruction-type" className="w-full">
                <SelectValue placeholder="请选择一级分类" />
              </SelectTrigger>
              <SelectContent align="start">
                {instructionTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {INSTRUCTION_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="instruction-drafter">起草人</Label>
              <Input
                id="instruction-drafter"
                value={drafter}
                onChange={event => setDrafter(event.target.value)}
                placeholder="席位名+人名，默认为当前账号"
                disabled={disabled || isPending}
                // maxLength={INSTRUCTION_INPUT_MAX_CHARS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instruction-secrecy">保密程度</Label>
              <Select
                value={secrecy}
                onValueChange={setSecrecy}
                disabled={disabled || isPending}
              >
                <SelectTrigger id="instruction-secrecy" className="w-full">
                  <SelectValue placeholder="请选择保密程度" />
                </SelectTrigger>
                <SelectContent align="start">
                  {SECRECY_OPTIONS.map(option => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instruction-situation-update">对应局势更新</Label>
            <Input
              id="instruction-situation-update"
              value={situationUpdate}
              onChange={event => setSituationUpdate(event.target.value)}
              placeholder="如【局势更新 3.1】；若为主动采取的行动，请留空或填写“无”"
              disabled={disabled || isPending}
              // maxLength={INSTRUCTION_INPUT_MAX_CHARS}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instruction-target">指令对象</Label>
            <Input
              id="instruction-target"
              value={target}
              onChange={event => setTarget(event.target.value)}
              placeholder="请输入指令对象，如“驻西班牙德军第 88 轰炸飞行大队”"
              disabled={disabled || isPending}
              // maxLength={INSTRUCTION_INPUT_MAX_CHARS}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instruction-content">指令内容</Label>
            <Textarea
              id="instruction-content"
              value={content}
              onChange={event => setContent(event.target.value)}
              placeholder="请输入具体指令内容"
              rows={8}
              disabled={disabled || isPending}
              // maxLength={INSTRUCTION_INPUT_MAX_CHARS}
            />
            {/* <p className="text-right text-xs text-muted-foreground">
              {getInstructionInputLength(content)}/{INSTRUCTION_INPUT_MAX_CHARS}
            </p> */}
          </div>

          <div className="space-y-2">
            <Label htmlFor="instruction-purpose">行动目的</Label>
            <Textarea
              id="instruction-purpose"
              value={purpose}
              onChange={event => setPurpose(event.target.value)}
              placeholder="请输入行动目的"
              rows={4}
              disabled={disabled || isPending}
              // maxLength={INSTRUCTION_INPUT_MAX_CHARS}
            />
            {/* <p className="text-right text-xs text-muted-foreground">
              {getInstructionInputLength(purpose)}/{INSTRUCTION_INPUT_MAX_CHARS}
            </p> */}
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">提交内容预览</p>
            <pre className="mt-2 whitespace-pre-wrap text-sm break-all">{assembledContent}</pre>
          </div>

          <Button type="submit" className="w-full" disabled={disabled || isPending}>
            {isPending ? '提交中...' : '提交指令'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
