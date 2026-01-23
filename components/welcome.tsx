import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function WelcomeComponent() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <Card className="border-2">
          <CardHeader className="text-center space-y-4 pb-8">
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
      </div>
    </div>
  )
}
