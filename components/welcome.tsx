import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiExample } from "@/lib/api/example-usage"

export function WelcomeComponent() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center space-y-4">
            <CardTitle className="text-5xl font-bold tracking-tight">
              Asya
            </CardTitle>
            <CardDescription className="text-xl">
              模拟联合国联动系统
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              欢迎使用 Asya 系统，一个专为模拟联合国活动设计的现代化联动平台。
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>后端连接状态</CardTitle>
            <CardDescription>
              实时检测与后端 API 的连接状态
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApiExample />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">关于 Asya</CardTitle>
            <CardDescription className="text-lg">
              模拟联合国联动系统
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Asya 是一个专为模拟联合国活动设计的现代化联动平台，旨在提升会议效率和参与体验。
            </p>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">主要功能</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>实时会议管理</li>
                <li>代表信息追踪</li>
                <li>文件共享与协作</li>
                <li>投票与决议系统</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
