'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/lib/contexts/auth-context'
import { parseApiPayload } from '@/lib/api/response-utils'
import { useGetUsers } from '@/lib/api/endpoints/会议管理/会议管理'
import {
  getListConfigsQueryKey,
  getListMyRecordsQueryKey,
  useCreateConfig,
  useCreateRecord,
  useDeleteRecord,
  useListConfigs,
  useQueryForManagement,
  useUpdateConfig,
  useUpdateRecord,
} from '@/lib/api/endpoints/代表属性管理/代表属性管理'
import type {
  DelegateAttrConfigCreateRequestAttrType,
  UserInfoResponse,
} from '@/lib/api/endpoints/asyaBackendAPI.schemas'
import {
  buildDelegateAttrUpsertValues,
  formatDelegateAttrUpdatedAt,
  getDelegateAttrDisplayValue,
  normalizeDelegateAttrPage,
  parseDelegateAttrConfigs,
  parseDelegateAttrRecordPage,
  toRecordFormValues,
  type DelegateAttrColumnViewModel,
  type DelegateAttrFilterFormValue,
  type DelegateAttrRecordRowViewModel,
  type NormalizedPage,
} from '@/lib/delegate-attr/utils'

const PAGE_SIZE = 10
const ATTR_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/

const EMPTY_PAGE: NormalizedPage<DelegateAttrRecordRowViewModel> = normalizeDelegateAttrPage(undefined)

type ActiveTab = 'records' | 'configs'
type RecordDialogMode = 'create' | 'edit'

interface ConfigFormState {
  attrKey: string
  attrLabel: string
  attrType: DelegateAttrConfigCreateRequestAttrType
  sortOrder: string
  enabled: boolean
}

export default function StatusManagePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isLoading: authLoading, isAuthenticated, canManageConference } = useAuth()

  const [activeTab, setActiveTab] = useState<ActiveTab>('records')
  const [currentPage, setCurrentPage] = useState(0)

  const [filterDelegateIds, setFilterDelegateIds] = useState<string[]>([])
  const [filterAttrValues, setFilterAttrValues] = useState<Record<string, DelegateAttrFilterFormValue>>({})

  const [appliedDelegateIds, setAppliedDelegateIds] = useState<string[]>([])
  const [appliedAttrValues, setAppliedAttrValues] = useState<Record<string, DelegateAttrFilterFormValue>>({})

  const [recordPage, setRecordPage] = useState<NormalizedPage<DelegateAttrRecordRowViewModel>>(EMPTY_PAGE)

  const [recordDialogOpen, setRecordDialogOpen] = useState(false)
  const [recordDialogMode, setRecordDialogMode] = useState<RecordDialogMode>('create')
  const [editingRecord, setEditingRecord] = useState<DelegateAttrRecordRowViewModel | null>(null)
  const [recordDelegateId, setRecordDelegateId] = useState<string>('')
  const [recordFormValues, setRecordFormValues] = useState<Record<string, string>>({})

  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<DelegateAttrColumnViewModel | null>(null)
  const [configForm, setConfigForm] = useState<ConfigFormState>({
    attrKey: '',
    attrLabel: '',
    attrType: 'TEXT',
    sortOrder: '0',
    enabled: true,
  })

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [recordToDelete, setRecordToDelete] = useState<DelegateAttrRecordRowViewModel | null>(null)

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !canManageConference)) {
      router.push('/')
    }
  }, [authLoading, isAuthenticated, canManageConference, router])

  const { data: usersData } = useGetUsers({
    query: {
      enabled: isAuthenticated && canManageConference,
    },
  })

  const delegateUsers = useMemo(() => {
    const parsed = parseApiPayload<UserInfoResponse[]>(usersData) || []
    return parsed.filter(user => user.role === 'DELEGATE')
  }, [usersData])
  const delegateUserMap = useMemo(
    () => new Map(delegateUsers.map(user => [user.uuid, user])),
    [delegateUsers],
  )

  const getDelegateDisplayLabel = useCallback(
    (delegateId: string, fallbackName: string) => {
      const matched = delegateUserMap.get(delegateId)
      if (!matched) return fallbackName

      const seatName = (matched.displayName?.trim() || matched.name || fallbackName).trim()
      const delegateName = (matched.name || fallbackName).trim()

      return seatName === delegateName ? seatName : `${seatName}（${delegateName}）`
    },
    [delegateUserMap],
  )

  const {
    data: configsData,
    isLoading: configsLoading,
    refetch: refetchConfigs,
  } = useListConfigs({
    query: {
      enabled: isAuthenticated && canManageConference,
    },
  })

  const columns = useMemo(() => parseDelegateAttrConfigs(configsData), [configsData])

  const { mutate: queryForManagement, isPending: queryingRecords } = useQueryForManagement()
  const { mutate: createRecord, isPending: creatingRecord } = useCreateRecord()
  const { mutate: updateRecord, isPending: updatingRecord } = useUpdateRecord()
  const { mutate: deleteRecord, isPending: deletingRecord } = useDeleteRecord()

  const { mutate: createConfig, isPending: creatingConfig } = useCreateConfig()
  const { mutate: updateConfig, isPending: updatingConfig } = useUpdateConfig()

  const loadRecords = useCallback(
    (page: number, delegateIds: string[], attrValues: Record<string, DelegateAttrFilterFormValue>) => {
      const attrFilters: Array<{ attrKey: string; textValue?: string; numberValue?: number }> = []

      for (const column of columns) {
        const formValue = attrValues[column.key]
        if (!formValue) continue

        const textValue = formValue.textValue?.trim()
        const numberRaw = formValue.numberValue?.trim()

        if (column.type === 'TEXT') {
          if (textValue) {
            attrFilters.push({ attrKey: column.key, textValue })
          }
          continue
        }

        if (numberRaw) {
          const numberValue = Number(numberRaw)
          if (!Number.isFinite(numberValue)) {
            toast.warning(`筛选项「${column.label}」必须为数字`)
            return
          }
          attrFilters.push({ attrKey: column.key, numberValue })
        }
      }

      queryForManagement(
        {
          data: {
            delegateIds: delegateIds.length > 0 ? delegateIds : undefined,
            attrFilters: attrFilters.length > 0 ? attrFilters : undefined,
          },
          params: {
            pageable: {
              page,
              size: PAGE_SIZE,
              sort: ['updatedAt,desc'],
            },
          },
        },
        {
          onSuccess: response => {
            const parsed = parseDelegateAttrRecordPage(response)
            setRecordPage(parsed.records)
          },
          onError: () => {
            toast.error('查询记录失败，请稍后重试')
            setRecordPage(EMPTY_PAGE)
          },
        },
      )
    },
    [columns, queryForManagement],
  )

  useEffect(() => {
    if (!isAuthenticated || !canManageConference || configsLoading) return
    loadRecords(currentPage, appliedDelegateIds, appliedAttrValues)
  }, [
    isAuthenticated,
    canManageConference,
    configsLoading,
    currentPage,
    appliedDelegateIds,
    appliedAttrValues,
    loadRecords,
  ])

  const resetRecordForm = useCallback(
    (valuesMap?: DelegateAttrRecordRowViewModel['valuesMap']) => {
      setRecordFormValues(toRecordFormValues(columns, valuesMap))
    },
    [columns],
  )

  const handleSearch = () => {
    setAppliedDelegateIds(filterDelegateIds)
    setAppliedAttrValues(filterAttrValues)
    setCurrentPage(0)
  }

  const handleClearFilters = () => {
    setFilterDelegateIds([])
    setFilterAttrValues({})
    setAppliedDelegateIds([])
    setAppliedAttrValues({})
    setCurrentPage(0)
  }

  const handleOpenCreateRecord = () => {
    setRecordDialogMode('create')
    setEditingRecord(null)
    setRecordDelegateId('')
    resetRecordForm()
    setRecordDialogOpen(true)
  }

  const handleOpenEditRecord = (record: DelegateAttrRecordRowViewModel) => {
    setRecordDialogMode('edit')
    setEditingRecord(record)
    setRecordDelegateId(record.delegateId)
    resetRecordForm(record.valuesMap)
    setRecordDialogOpen(true)
  }

  const handleSubmitRecord = () => {
    const targetDelegateId = recordDialogMode === 'edit' ? editingRecord?.delegateId : recordDelegateId
    if (!targetDelegateId) {
      toast.warning('请选择代表')
      return
    }

    let values
    try {
      values = buildDelegateAttrUpsertValues(columns, recordFormValues)
    } catch (error) {
      toast.warning(error instanceof Error ? error.message : '表单格式错误')
      return
    }

    const onSuccess = () => {
      toast.success(recordDialogMode === 'create' ? '记录创建成功' : '记录更新成功')
      setRecordDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: getListMyRecordsQueryKey() })
      loadRecords(currentPage, appliedDelegateIds, appliedAttrValues)
    }

    const onError = () => {
      toast.error(recordDialogMode === 'create' ? '创建记录失败' : '更新记录失败')
    }

    if (recordDialogMode === 'create') {
      createRecord(
        {
          delegateId: targetDelegateId,
          data: { values },
        },
        { onSuccess, onError },
      )
      return
    }

    if (!editingRecord) return

    updateRecord(
      {
        delegateId: targetDelegateId,
        recordId: editingRecord.recordId,
        data: { values },
      },
      { onSuccess, onError },
    )
  }

  const handleDeleteRecord = () => {
    if (!recordToDelete) return

    deleteRecord(
      {
        delegateId: recordToDelete.delegateId,
        recordId: recordToDelete.recordId,
      },
      {
        onSuccess: () => {
          toast.success('记录删除成功')
          setDeleteDialogOpen(false)
          setRecordToDelete(null)
          queryClient.invalidateQueries({ queryKey: getListMyRecordsQueryKey() })
          loadRecords(currentPage, appliedDelegateIds, appliedAttrValues)
        },
        onError: () => {
          toast.error('删除记录失败')
        },
      },
    )
  }

  const openCreateConfigDialog = () => {
    setEditingConfig(null)
    setConfigForm({
      attrKey: '',
      attrLabel: '',
      attrType: 'TEXT',
      sortOrder: '0',
      enabled: true,
    })
    setConfigDialogOpen(true)
  }

  const openEditConfigDialog = (column: DelegateAttrColumnViewModel) => {
    setEditingConfig(column)
    setConfigForm({
      attrKey: column.key,
      attrLabel: column.label,
      attrType: column.type,
      sortOrder: String(column.sortOrder),
      enabled: column.enabled,
    })
    setConfigDialogOpen(true)
  }

  const handleSubmitConfig = () => {
    const attrKey = configForm.attrKey.trim()
    const attrLabel = configForm.attrLabel.trim()
    const sortOrder = Number(configForm.sortOrder)

    if (!attrKey) {
      toast.warning('attrKey 不能为空')
      return
    }

    if (!ATTR_KEY_REGEX.test(attrKey)) {
      toast.warning('attrKey 仅允许英文、数字和下划线，且不能数字开头')
      return
    }

    if (!attrLabel) {
      toast.warning('属性名称不能为空')
      return
    }

    if (!Number.isInteger(sortOrder)) {
      toast.warning('排序值必须是整数')
      return
    }

    const duplicate = columns.some(column => column.key === attrKey && column.configId !== editingConfig?.configId)
    if (duplicate) {
      toast.warning(`attrKey「${attrKey}」已存在`)
      return
    }

    const refreshAfterSaved = () => {
      queryClient.invalidateQueries({ queryKey: getListConfigsQueryKey() })
      queryClient.invalidateQueries({ queryKey: getListMyRecordsQueryKey() })
      refetchConfigs()
      loadRecords(currentPage, appliedDelegateIds, appliedAttrValues)
      setConfigDialogOpen(false)
    }

    if (!editingConfig) {
      createConfig(
        {
          data: {
            attrKey,
            attrLabel,
            attrType: configForm.attrType,
            sortOrder,
            enabled: configForm.enabled,
          },
        },
        {
          onSuccess: () => {
            toast.success('配置创建成功')
            refreshAfterSaved()
          },
          onError: () => {
            toast.error('配置创建失败')
          },
        },
      )
      return
    }

    updateConfig(
      {
        configId: editingConfig.configId,
        data: {
          attrLabel,
          attrType: configForm.attrType,
          sortOrder,
          enabled: configForm.enabled,
        },
      },
      {
        onSuccess: () => {
          toast.success('配置更新成功')
          refreshAfterSaved()
        },
        onError: () => {
          toast.error('配置更新失败')
        },
      },
    )
  }

  if (authLoading || configsLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-lg text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !canManageConference) {
    return null
  }

  const saveRecordPending = creatingRecord || updatingRecord
  const saveConfigPending = creatingConfig || updatingConfig

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>状态管理</CardTitle>
            <CardDescription>管理代表状态记录与属性配置</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant={activeTab === 'records' ? 'default' : 'outline'} onClick={() => setActiveTab('records')}>
                记录管理
              </Button>
              <Button variant={activeTab === 'configs' ? 'default' : 'outline'} onClick={() => setActiveTab('configs')}>
                配置管理
              </Button>
            </div>
          </CardContent>
        </Card>

        {activeTab === 'records' ? (
          <Card>
            <CardHeader>
              <CardTitle>记录管理</CardTitle>
              <CardDescription>按代表多选与属性筛选分页查询，并可增改删记录</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <Label className="mb-2 block">代表多选</Label>
                  <div className="max-h-44 overflow-y-auto rounded-md border p-2">
                    {delegateUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">暂无可选代表</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {delegateUsers.map(delegate => (
                          <label key={delegate.uuid} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={filterDelegateIds.includes(delegate.uuid)}
                              onChange={event => {
                                setFilterDelegateIds(prev =>
                                  event.target.checked
                                    ? [...prev, delegate.uuid]
                                    : prev.filter(id => id !== delegate.uuid),
                                )
                              }}
                            />
                            <span>{delegate.displayName?.trim() || delegate.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">属性筛选</Label>
                  {columns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无属性配置</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {columns.map(column => (
                        <div key={`filter-${column.key}`} className="space-y-1">
                          <Label>{column.label}</Label>
                          <Input
                            placeholder={column.type === 'NUMBER' ? '输入数字' : '输入文本'}
                            value={
                              column.type === 'NUMBER'
                                ? filterAttrValues[column.key]?.numberValue || ''
                                : filterAttrValues[column.key]?.textValue || ''
                            }
                            onChange={event => {
                              const value = event.target.value
                              setFilterAttrValues(prev => ({
                                ...prev,
                                [column.key]:
                                  column.type === 'NUMBER'
                                    ? { ...(prev[column.key] || {}), numberValue: value }
                                    : { ...(prev[column.key] || {}), textValue: value },
                              }))
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSearch}>查询</Button>
                  <Button variant="outline" onClick={handleClearFilters}>
                    清空筛选
                  </Button>
                  <Button variant="secondary" onClick={handleOpenCreateRecord}>
                    新增记录
                  </Button>
                </div>
              </div>

              <div className="max-w-full overflow-x-auto rounded-lg border">
                <table className="min-w-[1100px] text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium whitespace-nowrap">席位名(代表名)</th>
                      <th className="px-3 py-2 text-left font-medium whitespace-nowrap">更新时间</th>
                      {columns.map(column => (
                        <th key={`header-${column.key}`} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                          {column.label}
                          {!column.enabled ? (
                            <span className="ml-1 text-xs text-muted-foreground">(停用)</span>
                          ) : null}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left font-medium whitespace-nowrap">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queryingRecords ? (
                      <tr>
                        <td className="px-3 py-8 text-center text-muted-foreground" colSpan={columns.length + 3}>
                          加载中...
                        </td>
                      </tr>
                    ) : recordPage.content.length === 0 ? (
                      <tr>
                        <td className="px-3 py-8 text-center text-muted-foreground" colSpan={columns.length + 3}>
                          暂无记录
                        </td>
                      </tr>
                    ) : (
                      recordPage.content.map(record => (
                        <tr key={record.recordId} className="border-t">
                          <td className="px-3 py-2 whitespace-nowrap">
                            {getDelegateDisplayLabel(record.delegateId, record.delegateName)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatDelegateAttrUpdatedAt(record.updatedAt)}</td>
                          {columns.map(column => (
                            <td key={`${record.recordId}-${column.key}`} className="px-3 py-2 whitespace-nowrap">
                              {getDelegateAttrDisplayValue(record.valuesMap[column.key])}
                            </td>
                          ))}
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleOpenEditRecord(record)}>
                                编辑
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setRecordToDelete(record)
                                  setDeleteDialogOpen(true)
                                }}
                              >
                                删除
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {recordPage.totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4">
                  <div className="text-sm text-muted-foreground">
                    第 {currentPage + 1} 页，共 {recordPage.totalPages} 页
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                      disabled={recordPage.isFirstPage || currentPage <= 0}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage(prev => Math.min(Math.max(recordPage.totalPages - 1, 0), prev + 1))
                      }
                      disabled={recordPage.isLastPage}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>配置管理</CardTitle>
              <CardDescription>创建与更新属性配置，影响状态表格与编辑字段</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Button onClick={openCreateConfigDialog}>新增配置</Button>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">attrKey</th>
                      <th className="px-3 py-2 text-left font-medium">名称</th>
                      <th className="px-3 py-2 text-left font-medium">类型</th>
                      <th className="px-3 py-2 text-left font-medium">排序</th>
                      <th className="px-3 py-2 text-left font-medium">启用</th>
                      <th className="px-3 py-2 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.length === 0 ? (
                      <tr>
                        <td className="px-3 py-8 text-center text-muted-foreground" colSpan={6}>
                          暂无配置
                        </td>
                      </tr>
                    ) : (
                      columns.map(column => (
                        <tr key={column.configId} className="border-t">
                          <td className="px-3 py-2 font-mono">{column.key}</td>
                          <td className="px-3 py-2">{column.label}</td>
                          <td className="px-3 py-2">{column.type}</td>
                          <td className="px-3 py-2">{column.sortOrder}</td>
                          <td className="px-3 py-2">{column.enabled ? '是' : '否'}</td>
                          <td className="px-3 py-2">
                            <Button variant="outline" size="sm" onClick={() => openEditConfigDialog(column)}>
                              编辑
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{recordDialogMode === 'create' ? '新增记录' : '编辑记录'}</DialogTitle>
            <DialogDescription>提交时将按整条记录覆盖保存</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {recordDialogMode === 'create' ? (
              <div className="space-y-2">
                <Label>代表</Label>
                <Select value={recordDelegateId} onValueChange={setRecordDelegateId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="请选择代表" />
                  </SelectTrigger>
                  <SelectContent>
                    {delegateUsers.map(delegate => (
                      <SelectItem key={delegate.uuid} value={delegate.uuid}>
                        {delegate.displayName?.trim() || delegate.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <Label>代表</Label>
                <p className="text-sm text-muted-foreground">{editingRecord?.delegateName}</p>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {columns.map(column => (
                <div key={`form-${column.key}`} className="space-y-1">
                  <Label>
                    {column.label}
                    {!column.enabled ? <span className="ml-1 text-xs text-muted-foreground">(停用)</span> : null}
                  </Label>
                  <Input
                    disabled={!column.enabled}
                    placeholder={column.type === 'NUMBER' ? '输入数字' : '输入文本'}
                    value={recordFormValues[column.key] || ''}
                    onChange={event =>
                      setRecordFormValues(prev => ({
                        ...prev,
                        [column.key]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitRecord} disabled={saveRecordPending}>
              {saveRecordPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConfig ? '编辑配置' : '新增配置'}</DialogTitle>
            <DialogDescription>配置保存后将立即影响状态页面的字段定义</DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-3">
            <div className="space-y-1">
              <Label>attrKey</Label>
              <Input
                value={configForm.attrKey}
                disabled={!!editingConfig}
                onChange={event => setConfigForm(prev => ({ ...prev, attrKey: event.target.value }))}
                placeholder="示例: policy_score"
              />
            </div>
            <div className="space-y-1">
              <Label>属性名称</Label>
              <Input
                value={configForm.attrLabel}
                onChange={event => setConfigForm(prev => ({ ...prev, attrLabel: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>属性类型</Label>
              <Select
                value={configForm.attrType}
                onValueChange={value =>
                  setConfigForm(prev => ({ ...prev, attrType: value as DelegateAttrConfigCreateRequestAttrType }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择属性类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEXT">TEXT</SelectItem>
                  <SelectItem value="NUMBER">NUMBER</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>排序值</Label>
              <Input
                value={configForm.sortOrder}
                onChange={event => setConfigForm(prev => ({ ...prev, sortOrder: event.target.value }))}
                placeholder="整数，越小越靠前"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="config-enabled"
                type="checkbox"
                checked={configForm.enabled}
                onChange={event => setConfigForm(prev => ({ ...prev, enabled: event.target.checked }))}
              />
              <Label htmlFor="config-enabled">启用</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitConfig} disabled={saveConfigPending}>
              {saveConfigPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除记录</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复。是否删除 {recordToDelete ? getDelegateDisplayLabel(recordToDelete.delegateId, recordToDelete.delegateName) : ''} 的这条状态记录？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRecord} disabled={deletingRecord}>
              {deletingRecord ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
