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
}

export function TermsDialog({ trigger, variant = 'outline' }: TermsDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant={variant} size="sm" className="gap-2">
            <FileText className="h-4 w-4" />
            使用条款
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="!max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl">使用条款与服务协议</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">
              Copyright © 2026 Stanley. All Rights Reserved.
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="overflow-y-auto pr-2 space-y-4 text-sm flex-1">
          <p className="text-foreground">
            欢迎使用本系统！本系统为独立开发者 Stanley (下简称开发者)自主设计与研发的模拟联合国危机联动系统。在使用或访问本系统前，您必须知悉并同意以下条款：
          </p>

          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-base mb-2 text-foreground">1. 严禁恶意攻击与滥用</h3>
              <p className="text-muted-foreground leading-relaxed">
                本项目为个人维护，服务器资源及承载能力有限。严禁任何个人或组织对本站进行任何形式的渗透测试、漏洞扫描、DDoS 攻击、高频恶意请求或接口穷举。
                网站已开启全局访问日志审计与异常行为监控，一切试图破坏系统可用性、探底系统逻辑或窃取数据的行为，系统将自动拦截封禁，开发者保留追究其法律责任及向相关服务商举报的权利。
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-base mb-2 text-foreground">2. 知识产权与业务逻辑保护</h3>
              <div className="space-y-2 text-muted-foreground leading-relaxed">
                <p>
                  <strong>2.1</strong> 本网站的全部前端源代码、UI 设计、页面交互布局、专有功能名称及原创文案，其著作权均绝对归开发者所有。未经明确书面许可，严禁任何人以任何形式复制、扒取、盗用或框架嵌套本站的代码与设计。
                </p>
                <p>
                  <strong>2.2</strong> 本系统的危机推演功能、时间轴流动算法等业务逻辑功能为开发者独创成果。未经开发者书面明确授权，严禁对本系统的业务逻辑进行逆向推导，或将本系统的核心机制包装后作为独立产品二次发布。
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-base mb-2 text-foreground">3. 所有权归属与宣传限制</h3>
              <div className="space-y-2 text-muted-foreground leading-relaxed">
                <p>
                  <strong>3.1</strong> 任何将本项目应用于特定模拟联合国会议、社团活动或公司场景的行为，均仅属开发者以个人身份开展的<strong>"非独占、临时且可撤销"</strong>的软件封闭测试。该行为绝不应被解释为开发者将本系统的所有权、知识产权、衍生权或商业运营权转让、排他性授权或附属给相关组织。
                </p>
                <p>
                  <strong>3.2</strong> 未经本人明确书面许可，任何组织和个人不得通过隐瞒、篡改等方式掩盖开发者的独立所有者身份；严禁将本系统包装为该组织的"自有成果"、"内部系统"或"联合研发项目"。
                </p>
                <p>
                  <strong>3.3</strong> 未经授权，任何会议主办方不得将本系统作为核心卖点用于招揽代表或商业营销。在经许可的公开宣传中，必须明确标示本推演系统由 Stanley 研发并提供技术测试支持，不得产生任何所有权混淆。
                </p>
                <p>
                  <strong>3.4</strong> 开发者独占性地拥有本系统的完整知识产权，并完全保留在未来将本系统整体或部分进行商业化运营、排他性授权或完整所有权转让的权利。
                </p>
                <p>
                  <strong>3.5</strong> 开发者有权在不预先通知的情况下，随时终止对任何当前"非商业测试方/会议方"的免费授权及技术支持，并要求其立即停止使用本系统，且无需对原测试使用方承担任何违约或连带责任。
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground italic">
              使用本系统即表示您已阅读、理解并同意遵守以上全部条款。如有疑问，请联系开发者 Stanley (acc_stanley@foxmail.com)。
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setOpen(false)}>
            我已阅读并同意
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
