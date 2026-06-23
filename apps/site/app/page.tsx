import { APP_NAME } from "@mind-wiki/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

const navItems = ["周报", "轨迹", "提供方", "因果链"];

export default function Home() {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <div className="px-2 py-2 text-xs font-medium text-muted-foreground">研究导航</div>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item}>
                  <SidebarMenuButton>{item}</SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <main className="min-h-svh">
          <header className="flex h-14 items-center gap-3 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="text-sm font-medium">{APP_NAME}</div>
          </header>
          <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-6">
            <div className="flex flex-col gap-3">
              <Badge variant="secondary" className="w-fit">公开站点 · 仅批准内容</Badge>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-normal">AI 进展周报索引</h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                为 AI 历史、进展、轨迹、提供方与因果链准备的中文研究驾驶舱基础壳。
              </p>
            </div>
            <Tabs defaultValue="briefs" className="w-full">
              <TabsList>
                <TabsTrigger value="briefs">周报</TabsTrigger>
                <TabsTrigger value="sources">来源</TabsTrigger>
              </TabsList>
              <TabsContent value="briefs">
                <Card>
                  <CardHeader>
                    <CardTitle>静态发布边界</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
                    <p>公开站点只读取已批准内容；本地策展状态、抽取产物、无效草稿、运行日志和凭据不进入静态产物。</p>
                    <div>
                      <Button size="sm">查看占位索引</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="sources">
                <Card>
                  <CardHeader>
                    <CardTitle>来源意识</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    后续内容层会把证据、信心和因果关系放在同一套视觉语言中。
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </section>
        </main>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
