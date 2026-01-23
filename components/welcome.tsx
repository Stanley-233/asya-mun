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
      </div>
    </div>
  )
}
