'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { FileText } from 'lucide-react'

interface TermsDialogProps {
  trigger?: React.ReactNode
  variant?: 'default' | 'outline' | 'ghost' | 'link'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
  confirmLabel?: string
}

const REPOSITORY_URL = 'https://www.github.com/Stanley-233/asya-mun'
const CONTACT_EMAIL = 'acc_stanley@foxmail.com'

export function TermsDialog({
  trigger,
  variant = 'outline',
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  confirmLabel = '我已阅读并同意',
}: TermsDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen

  const handleOpenChange = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      {showTrigger && (
        <AlertDialogTrigger asChild>
          {trigger || (
            <Button variant={variant} size="sm" className="gap-2">
              <FileText className="h-4 w-4" />
              使用条款
            </Button>
          )}
        </AlertDialogTrigger>
      )}
      <AlertDialogContent className="!max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl">授权与使用说明</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              本说明依据仓库当前 README 中的许可证与官方服务条款整理，用于帮助用户快速理解 ASYA 的授权与服务边界。
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="overflow-y-auto pr-2 space-y-4 text-sm flex-1">
          <p className="text-foreground">
            ASYA 是一款面向模拟联合国联动体系的一站式解决方案。其源代码基于
            {' '}
            <strong>PolyForm Shield License 1.0.0</strong>
            {' '}
            授权。
          </p>

          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-base mb-2 text-foreground">1. 授权范围</h3>
              <div className="space-y-2 text-muted-foreground leading-relaxed">
                <p>你可以在 PolyForm Shield License 的条款下使用、学习、复制、修改和再分发本项目的源代码。</p>
                <p>你可以将软件用于个人、学习、研究或非竞争性目的，也可以分发原始版本或修改后的版本。</p>
                <p>
                  但是，你不得使用本软件提供与 ASYA 或其开发者任何产品相竞争的产品或服务。具体竞争定义请参阅许可证全文。
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-base mb-2 text-foreground">2. 竞争限制与额外授权</h3>
              <div className="space-y-2 text-muted-foreground leading-relaxed">
                <p>
                  如果你的使用场景涉及提供与 ASYA 竞争的产品或服务，应联系开发者获取额外授权。
                </p>
                <p>
                  ASYA 的名称、Logo、视觉标识、域名及其他品牌资产，除非另有明确说明，不随许可证自动授权；未经许可，不得据此暗示官方认可、合作关系或授权关系。
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-base mb-2 text-foreground">3. 官方服务使用与合规提示</h3>
              <div className="space-y-2 text-muted-foreground leading-relaxed">
                <p>
                  由开发者本人部署、维护或直接提供的 ASYA 官方在线服务、测试实例、演示环境及技术支持服务，还适用 README 中的"免责声明与官方服务使用条款"。
                </p>
                <p>
                  官方服务严禁恶意攻击、漏洞扫描、DDoS、高频恶意请求、接口穷举、批量爬取、绕过访问控制以及其他破坏系统可用性或数据安全的行为。
                </p>
                <p>
                  官方在线服务、演示环境或测试实例可能存在功能变更、数据重置、服务中断、接口调整或其他不可预期错误。用于正式会议、社团活动或商业场景前，请自行完成测试、备份与风险评估。
                </p>
                <p>
                  本说明旨在帮助你理解授权与合规边界；如与 PolyForm Shield License 正文或仓库 README 存在冲突，应以许可证正文和仓库声明为准。
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <p className="text-xs text-muted-foreground italic">
              竞争性产品授权或官方服务相关问题，可联系开发者：
              {' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
            <p className="text-xs text-muted-foreground">
              开源仓库：
              {' '}
              <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
                {REPOSITORY_URL}
              </a>
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction onClick={() => handleOpenChange(false)}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
