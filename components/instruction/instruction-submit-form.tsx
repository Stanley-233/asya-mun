'use client'

import { useMemo, useState } from 'react'
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

type StructuredInstructionType = Extract<InstructionCreateRequestInstructionType, 'MILITARY' | 'DIPLOMACY'>
type MilitaryCategoryKey = '1' | '2' | '3' | '4'
type DiplomacyCategoryKey = '1' | '2' | '3'

type StructuredCategoryKey = MilitaryCategoryKey | DiplomacyCategoryKey

type StructuredRowsByType = Record<StructuredInstructionType, Record<string, Record<string, string>[]>>
type StructuredCategoryByType = Record<StructuredInstructionType, StructuredCategoryKey | ''>
type StructuredSelectedActionsByType = Record<StructuredInstructionType, string[]>

interface ActionFieldTemplate {
  id: string
  label: string
  multiline?: boolean
}

interface StructuredActionTemplate {
  id: string
  label: string
  description?: string
  fields: ActionFieldTemplate[]
  renderSentence: (row: Record<string, string>) => string
}

interface StructuredCategoryTemplate {
  key: StructuredCategoryKey
  label: string
  actions: StructuredActionTemplate[]
}

interface StructuredTypeTemplate {
  instructionType: StructuredInstructionType
  categories: StructuredCategoryTemplate[]
}

const MILITARY_TEMPLATE: StructuredTypeTemplate = {
  instructionType: 'MILITARY',
  categories: [
    {
      key: '1',
      label: '1.行动',
      actions: [
        {
          id: 'military-follow-legion',
          label: '跟随军团',
          fields: [
            { id: 'currentNode', label: '当前节点' },
            { id: 'targetLegion', label: 'X军团' },
          ],
          renderSentence: row =>
            `本回合起跟随/脱离同在【${row.currentNode}】的【${row.targetLegion}】行动。`,
        },
      ],
    },
    {
      key: '2',
      label: '2.移动与交战',
      actions: [
        {
          id: 'military-follow-move',
          label: '跟随移动',
          fields: [
            { id: 'subject', label: 'X军团/X个算子' },
            { id: 'fromNode', label: '当前节点/出发地点' },
            { id: 'toNode', label: '目标节点' },
            { id: 'mission', label: '进攻/驻防' },
          ],
          renderSentence: row =>
            `【${row.subject}】从【${row.fromNode}】前往【${row.toNode}】，执行【${row.mission}】。`,
        },
        {
          id: 'military-remote-command',
          label: '远程指挥',
          fields: [
            { id: 'subject', label: 'X军团/X个算子' },
            { id: 'viaNodes', label: '途经的所有节点' },
            { id: 'toNode', label: '目标节点' },
            { id: 'mission', label: '进攻/驻防' },
          ],
          renderSentence: row =>
            `【${row.subject}】经【${row.viaNodes}】前往【${row.toNode}】，执行【${row.mission}】。`,
        },
        {
          id: 'military-joint-operation',
          label: '协同联军',
          fields: [
            { id: 'subject', label: 'X军团/X算子' },
            { id: 'allyLegion', label: '盟友军团名' },
          ],
          renderSentence: row =>
            `【${row.subject}】协同跟随主导方【${row.allyLegion}】行动。`,
        },
        {
          id: 'military-boarding-landing',
          label: '上船下船',
          fields: [
            { id: 'landSubject', label: '陆军X军团/X个算子' },
            { id: 'fromNode', label: '当前节点（上船）' },
            { id: 'seaArea', label: '海域（登陆出发海域）' },
            { id: 'toNode', label: '目标节点（登陆地）' },
          ],
          renderSentence: row =>
            `【${row.landSubject}】从【${row.fromNode}】上船 / 乘船陆军自【${row.seaArea}】登陆【${row.toNode}】。`,
        },
      ],
    },
    {
      key: '3',
      label: '3.编组与拆分',
      actions: [
        {
          id: 'military-build-legion',
          label: '组建',
          fields: [
            { id: 'node', label: '某节点' },
            { id: 'operators', label: 'X个算子' },
            { id: 'newLegion', label: 'X军团' },
          ],
          renderSentence: row =>
            `将位于【${row.node}】的【${row.operators}】组成【${row.newLegion}】。`,
        },
        {
          id: 'military-absorb-legion',
          label: '吸收',
          fields: [
            { id: 'node', label: '某节点' },
            { id: 'source', label: 'X个算子/X军团' },
            { id: 'targetLegion', label: '军团Y' },
          ],
          renderSentence: row =>
            `将位于【${row.node}】的【${row.source}】合并进入【${row.targetLegion}】。`,
        },
        {
          id: 'military-split-legion',
          label: '军团拆分',
          fields: [
            { id: 'legion', label: '军团X' },
            { id: 'operators', label: 'X个算子' },
          ],
          renderSentence: row =>
            `【${row.legion}】拆分出【${row.operators}】驻守原地。`,
        },
      ],
    },
    {
      key: '4',
      label: '4.补员与其他',
      actions: [
        {
          id: 'military-homeland-recruit',
          label: '本土/封地招募',
          fields: [
            { id: 'region', label: '本土城市/封建主领地' },
            { id: 'troopType', label: '直属/封建主部队' },
          ],
          renderSentence: row =>
            `在【${row.region}】招募【${row.troopType}】。`,
        },
        {
          id: 'military-local-recruit',
          label: '就地募兵',
          fields: [
            { id: 'node', label: '当前所在节点' },
            { id: 'troopType', label: '本地部队描述' },
          ],
          renderSentence: row =>
            `在【${row.node}】直接招募【${row.troopType}】。`,
        },
        {
          id: 'military-other-operation',
          label: '其他',
          fields: [{ id: 'content', label: '其他希望进行的操作', multiline: true }],
          renderSentence: row => `其他操作：${row.content}`,
        },
      ],
    },
  ],
}

const DIPLOMACY_TEMPLATE: StructuredTypeTemplate = {
  instructionType: 'DIPLOMACY',
  categories: [
    {
      key: '1',
      label: '1.谈判与会晤（参与谈判的所有各方均需提交）',
      actions: [
        {
          id: 'diplomacy-land-travel',
          label: '陆地前往',
          fields: [
            { id: 'representative', label: '代表本人 / 代表的特使' },
            { id: 'army', label: 'X个算子 / 不携带军队' },
            { id: 'targetCity', label: '目标城市名称' },
            { id: 'cityArea', label: '市内 / 市郊' },
          ],
          renderSentence: row =>
            `【${row.representative}】率领【${row.army}】，前往【${row.targetCity}】的【${row.cityArea}】进行谈判。`,
        },
        {
          id: 'diplomacy-sea-travel',
          label: '跨海前往',
          fields: [
            { id: 'representative', label: '代表本人 / 代表的特使' },
            { id: 'landUnits', label: 'X个算子' },
            { id: 'navalUnits', label: 'X个海军算子' },
            { id: 'targetCity', label: '目标城市名称' },
            { id: 'cityArea', label: '市内 / 市郊' },
            { id: 'targetPort', label: '目标港口名称' },
          ],
          renderSentence: row =>
            `【${row.representative}】率领【${row.landUnits}】，携带【${row.navalUnits}】渡海，前往【${row.targetCity}】的【${row.cityArea}】进行谈判，随行海军随后停泊在【${row.targetPort}】。`,
        },
      ],
    },
    {
      key: '2',
      label: '2.签署协议/声明（发表协议/声明的所有各方均需提交）',
      actions: [
        {
          id: 'diplomacy-public-declaration',
          label: '发布公开声明',
          fields: [
            { id: 'parties', label: '缔约方A、缔约方B...' },
            { id: 'content', label: '声明/协议内容', multiline: true },
          ],
          renderSentence: row =>
            `本方/本方与【${row.parties}】共同签订公开协议/发表声明，内容如下：${row.content}`,
        },
        {
          id: 'diplomacy-secret-treaty',
          label: '缔结秘密条约',
          fields: [
            { id: 'parties', label: '密约方A' },
            { id: 'content', label: '秘密协定内容', multiline: true },
          ],
          renderSentence: row =>
            `本方与【${row.parties}】达成秘密协定，内容如下：${row.content}`,
        },
      ],
    },
    {
      key: '3',
      label: '3.特殊行动',
      actions: [
        {
          id: 'diplomacy-assassination',
          label: '阿萨辛刺杀',
          description: '仅限马穆鲁克苏丹拜巴尔，全局限2次，不可同回合使用',
          fields: [
            { id: 'targetCity', label: '目标城市名称' },
            { id: 'targetRepresentative', label: '目标代表名称' },
          ],
          renderSentence: row =>
            `动用阿萨辛，对位于【${row.targetCity}】的【${row.targetRepresentative}】发动刺杀行动。`,
        },
      ],
    },
  ],
}

const STRUCTURED_TEMPLATES: Record<StructuredInstructionType, StructuredTypeTemplate> = {
  MILITARY: MILITARY_TEMPLATE,
  DIPLOMACY: DIPLOMACY_TEMPLATE,
}

function isStructuredType(type: InstructionCreateRequestInstructionType): type is StructuredInstructionType {
  return type === 'MILITARY' || type === 'DIPLOMACY'
}

function getStructuredCategory(
  template: StructuredTypeTemplate,
  key: StructuredCategoryKey | '',
) {
  return template.categories.find(category => category.key === key)
}

function createEmptyRow(action: StructuredActionTemplate) {
  const row: Record<string, string> = {}
  for (const field of action.fields) {
    row[field.id] = ''
  }
  return row
}

function buildStructuredContent(
  categoryLabel: string,
  orderedSelectedActions: StructuredActionTemplate[],
  rowsByAction: Record<string, Record<string, string>[]>,
) {
  const actionSections = orderedSelectedActions.map(action => {
    const rows = rowsByAction[action.id] || []
    const lines = rows.map(row => action.renderSentence(row).trim())
    return `[${action.label}]\n${lines.join('\n')}`
  })
  return `【${categoryLabel}】\n${actionSections.join('\n')}`.trim()
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
  const [title, setTitle] = useState('')
  const [instructionType, setInstructionType] = useState<InstructionCreateRequestInstructionType>('MILITARY')
  const [content, setContent] = useState('')
  const [structuredCategoryByType, setStructuredCategoryByType] = useState<StructuredCategoryByType>({
    MILITARY: '',
    DIPLOMACY: '',
  })
  const [structuredSelectedActionsByType, setStructuredSelectedActionsByType] =
    useState<StructuredSelectedActionsByType>({
      MILITARY: [],
      DIPLOMACY: [],
    })
  const [structuredRowsByType, setStructuredRowsByType] = useState<StructuredRowsByType>({
    MILITARY: {},
    DIPLOMACY: {},
  })

  const currentTemplate = isStructuredType(instructionType)
    ? STRUCTURED_TEMPLATES[instructionType]
    : null

  const currentCategoryKey = isStructuredType(instructionType)
    ? structuredCategoryByType[instructionType]
    : ''

  const currentCategory = useMemo(() => {
    if (!currentTemplate) return undefined
    return getStructuredCategory(currentTemplate, currentCategoryKey)
  }, [currentTemplate, currentCategoryKey])

  const selectedActionIds = isStructuredType(instructionType)
    ? structuredSelectedActionsByType[instructionType]
    : []

  const rowsByAction = isStructuredType(instructionType) ? structuredRowsByType[instructionType] : {}

  const orderedSelectedActions = useMemo(() => {
    if (!currentCategory) return [] as StructuredActionTemplate[]
    return currentCategory.actions.filter(action => selectedActionIds.includes(action.id))
  }, [currentCategory, selectedActionIds])

  const handleInstructionTypeChange = (value: InstructionCreateRequestInstructionType) => {
    setInstructionType(value)
  }

  const handleStructuredCategoryChange = (
    type: StructuredInstructionType,
    nextCategoryKey: StructuredCategoryKey,
  ) => {
    setStructuredCategoryByType(prev => ({
      ...prev,
      [type]: nextCategoryKey,
    }))

    setStructuredSelectedActionsByType(prev => ({
      ...prev,
      [type]: [],
    }))
  }

  const toggleStructuredAction = (type: StructuredInstructionType, action: StructuredActionTemplate, checked: boolean) => {
    setStructuredSelectedActionsByType(prev => {
      const current = prev[type]
      if (checked) {
        if (current.includes(action.id)) return prev
        return {
          ...prev,
          [type]: [...current, action.id],
        }
      }

      return {
        ...prev,
        [type]: current.filter(actionId => actionId !== action.id),
      }
    })

    setStructuredRowsByType(prev => {
      const typeRows = prev[type]
      if (checked) {
        if (typeRows[action.id] && typeRows[action.id].length > 0) {
          return prev
        }
        return {
          ...prev,
          [type]: {
            ...typeRows,
            [action.id]: [createEmptyRow(action)],
          },
        }
      }

      const { [action.id]: _removed, ...restTypeRows } = typeRows
      return {
        ...prev,
        [type]: restTypeRows,
      }
    })
  }

  const handleRowFieldChange = (
    type: StructuredInstructionType,
    actionId: string,
    rowIndex: number,
    fieldId: string,
    value: string,
  ) => {
    setStructuredRowsByType(prev => {
      const rows = prev[type][actionId] || []
      return {
        ...prev,
        [type]: {
          ...prev[type],
          [actionId]: rows.map((row, index) => {
            if (index !== rowIndex) return row
            return {
              ...row,
              [fieldId]: value,
            }
          }),
        },
      }
    })
  }

  const addActionRow = (type: StructuredInstructionType, action: StructuredActionTemplate) => {
    setStructuredRowsByType(prev => {
      const rows = prev[type][action.id] || []
      return {
        ...prev,
        [type]: {
          ...prev[type],
          [action.id]: [...rows, createEmptyRow(action)],
        },
      }
    })
  }

  const removeActionRow = (type: StructuredInstructionType, actionId: string, rowIndex: number) => {
    setStructuredRowsByType(prev => {
      const rows = prev[type][actionId] || []
      if (rows.length <= 1) return prev
      return {
        ...prev,
        [type]: {
          ...prev[type],
          [actionId]: rows.filter((_, index) => index !== rowIndex),
        },
      }
    })
  }

  const resetForm = () => {
    setTitle('')
    setInstructionType('MILITARY')
    setContent('')
    setStructuredCategoryByType({
      MILITARY: '',
      DIPLOMACY: '',
    })
    setStructuredSelectedActionsByType({
      MILITARY: [],
      DIPLOMACY: [],
    })
    setStructuredRowsByType({
      MILITARY: {},
      DIPLOMACY: {},
    })
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (disabled) return

    if (!title.trim()) {
      toast.error('请填写标题')
      return
    }

    let finalContent = ''

    if (isStructuredType(instructionType)) {
      const template = STRUCTURED_TEMPLATES[instructionType]
      const selectedCategoryKey = structuredCategoryByType[instructionType]
      const selectedCategory = getStructuredCategory(template, selectedCategoryKey)

      if (!selectedCategory) {
        toast.error('请选择一级分类')
        return
      }

      const selectedActions = template.categories
        .flatMap(category => category.actions)
        .filter(action => structuredSelectedActionsByType[instructionType].includes(action.id))

      const orderedActions = selectedCategory.actions.filter(action =>
        structuredSelectedActionsByType[instructionType].includes(action.id),
      )

      if (selectedActions.length === 0 || orderedActions.length === 0) {
        toast.error('请至少勾选一个二级行动')
        return
      }

      const actionRows = structuredRowsByType[instructionType]
      for (const action of orderedActions) {
        const rows = actionRows[action.id] || []
        if (rows.length === 0) {
          toast.error(`「${action.label}」至少需要一条记录`)
          return
        }

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          const row = rows[rowIndex]
          for (const field of action.fields) {
            if (!String(row[field.id] || '').trim()) {
              toast.error(`请填写「${action.label}」第${rowIndex + 1}条的「${field.label}」`)
              return
            }
          }
        }
      }

      finalContent = buildStructuredContent(selectedCategory.label, orderedActions, actionRows)
    } else {
      if (!content.trim()) {
        toast.error('请完整填写标题和内容')
        return
      }
      finalContent = content.trim()
    }

    createInstruction(
      {
        data: {
          title: title.trim(),
          instructionType,
          content: finalContent,
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
              placeholder="标题格式：【军事/内政/外交-会期数.份数】摘要，如【军事1.1】后勤保障"
              disabled={disabled || isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instruction-type">指令类型</Label>
            <Select
              value={instructionType}
              onValueChange={value => handleInstructionTypeChange(value as InstructionCreateRequestInstructionType)}
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

          {currentTemplate ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="structured-category">一级分类</Label>
                <Select
                  value={currentCategoryKey}
                  onValueChange={value =>
                    handleStructuredCategoryChange(currentTemplate.instructionType, value as StructuredCategoryKey)
                  }
                  disabled={disabled || isPending}
                >
                  <SelectTrigger id="structured-category" className="w-full">
                    <SelectValue placeholder="请选择一级分类" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {currentTemplate.categories.map(category => (
                      <SelectItem key={category.key} value={category.key}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentCategory && (
                <div className="space-y-2">
                  <Label>二级行动（可多选）</Label>
                  <div className="space-y-2 rounded-lg border p-3">
                    {currentCategory.actions.map(action => (
                      <label key={action.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedActionIds.includes(action.id)}
                          onChange={event =>
                            toggleStructuredAction(
                              currentTemplate.instructionType,
                              action,
                              event.target.checked,
                            )
                          }
                          disabled={disabled || isPending}
                          className="h-4 w-4 rounded border-input"
                        />
                        <span>{action.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {orderedSelectedActions.map(action => {
                const rows = rowsByAction[action.id] || []
                return (
                  <div key={action.id} className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">[{action.label}]</p>
                        {action.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addActionRow(currentTemplate.instructionType, action)}
                        disabled={disabled || isPending}
                      >
                        新增一条
                      </Button>
                    </div>

                    {rows.map((row, rowIndex) => (
                      <div key={`${action.id}-${rowIndex}`} className="space-y-2 rounded-md border bg-muted/20 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">第 {rowIndex + 1} 条</p>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              removeActionRow(currentTemplate.instructionType, action.id, rowIndex)
                            }
                            disabled={disabled || isPending || rows.length <= 1}
                          >
                            删除
                          </Button>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                          {action.fields.map(field => (
                            <div
                              key={`${action.id}-${rowIndex}-${field.id}`}
                              className={field.multiline ? 'space-y-1 md:col-span-2' : 'space-y-1'}
                            >
                              <Label htmlFor={`${action.id}-${rowIndex}-${field.id}`}>{field.label}</Label>
                              {field.multiline ? (
                                <Textarea
                                  id={`${action.id}-${rowIndex}-${field.id}`}
                                  value={row[field.id] || ''}
                                  onChange={event =>
                                    handleRowFieldChange(
                                      currentTemplate.instructionType,
                                      action.id,
                                      rowIndex,
                                      field.id,
                                      event.target.value,
                                    )
                                  }
                                  rows={4}
                                  placeholder={`请输入${field.label}`}
                                  disabled={disabled || isPending}
                                />
                              ) : (
                                <Input
                                  id={`${action.id}-${rowIndex}-${field.id}`}
                                  value={row[field.id] || ''}
                                  onChange={event =>
                                    handleRowFieldChange(
                                      currentTemplate.instructionType,
                                      action.id,
                                      rowIndex,
                                      field.id,
                                      event.target.value,
                                    )
                                  }
                                  placeholder={`请输入${field.label}`}
                                  disabled={disabled || isPending}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </>
          ) : (
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
          )}

          <Button type="submit" className="w-full" disabled={disabled || isPending}>
            {isPending ? '提交中...' : '提交指令'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
