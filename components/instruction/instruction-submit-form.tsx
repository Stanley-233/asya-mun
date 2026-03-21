'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useCreate2 } from '@/lib/api/endpoints/指令管理/指令管理'
import type { InstructionCreateRequestInstructionType } from '@/lib/api/endpoints/asyaBackendAPI.schemas'
import { toast } from 'react-toastify'
import { INSTRUCTION_TYPE_LABELS } from './instruction-utils'

const instructionTypes: InstructionCreateRequestInstructionType[] = [
  'MILITARY',
  'DIPLOMACY',
  'INTERNAL',
  'OTHER',
]

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
  const [title, setTitle] = useState('')
  const [instructionType, setInstructionType] = useState<InstructionCreateRequestInstructionType>('MILITARY')
  const [content, setContent] = useState('')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (disabled) return

    if (!title.trim() || !content.trim()) {
      toast.error('请完整填写标题和内容')
      return
    }

    createInstruction(
      {
        data: {
          title: title.trim(),
          instructionType,
          content: content.trim(),
        },
      },
      {
        onSuccess: () => {
          toast.success('指令提交成功')
          setTitle('')
          setInstructionType('MILITARY')
          setContent('')
          onSuccess?.()
        },
        onError: error => {
          console.error('Failed to create instruction:', error)
          toast.error('指令提交失败，请稍后重试')
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
            <Label htmlFor="instruction-title">标题</Label>
            <Input
              id="instruction-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="请输入指令标题"
              disabled={disabled || isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instruction-type">指令类型</Label>
            <Select
              value={instructionType}
              onValueChange={value => setInstructionType(value as InstructionCreateRequestInstructionType)}
              disabled={disabled || isPending}
            >
              <SelectTrigger id="instruction-type" className="w-full">
                <SelectValue placeholder="请选择指令类型" />
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

          <div className="space-y-2">
            <Label htmlFor="instruction-content">指令内容</Label>
            <Textarea
              id="instruction-content"
              value={content}
              onChange={event => setContent(event.target.value)}
              placeholder="请输入具体指令内容"
              rows={8}
              disabled={disabled || isPending}
            />
          </div>

          <Button type="submit" className="w-full" disabled={disabled || isPending}>
            {isPending ? '提交中...' : '提交指令'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
