"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock,
  ExternalLink,
  GitBranch,
  Library,
  Quote,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  Waypoints
} from "lucide-react";

import type { Confidence, EventType, Trajectory } from "@mind-wiki/core/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { PublicCausalLink, PublicEvent, PublicSiteData, PublicWeek } from "@/lib/public-content";

type SiteView = "week" | "week-detail" | "trajectories" | "providers" | "sources" | "causal-chains";

type PublicSiteProps = {
  data: PublicSiteData;
  view: SiteView;
  selectedWeek?: string;
  selectedTrajectory?: Trajectory;
};

type Filters = {
  trajectory: "all" | Trajectory;
  provider: "all" | string;
  type: "all" | EventType;
  confidence: "all" | Confidence;
  watchlistOnly: boolean;
};

type FilterContext = "week-detail" | "trajectories" | "trajectory-detail";

const trajectoryLabels: Record<Trajectory, string> = {
  llm_architecture: "LLM 架构",
  multimodal_architecture: "多模态",
  provider_releases: "供应商策略",
  commercial_forces: "商业与基础设施"
};

const eventTypeLabels: Record<EventType, string> = {
  architecture: "架构",
  benchmark: "评测",
  business: "商业",
  infra: "基础设施",
  model_release: "模型发布",
  paper: "论文",
  product: "产品",
  regulation: "监管"
};

const confidenceLabels: Record<Confidence, string> = {
  observed: "已观察",
  likely: "可能",
  speculative: "推测"
};

const relationshipLabels: Record<string, string> = {
  accelerated: "加速",
  contradicted: "反证",
  enabled: "促成",
  influenced: "影响",
  pressured: "施压",
  validated: "验证"
};

const sourceTypeLabels: Record<string, string> = {
  analysis: "分析",
  benchmark: "评测",
  blog: "博客",
  company: "公司",
  docs: "文档",
  github: "GitHub",
  news: "新闻",
  other: "其他",
  paper: "论文",
  regulatory: "监管"
};

const trajectoryNarratives: Record<Trajectory, {
  phase: string;
  weeklyRelevance: string;
  nextWatch: string;
}> = {
  llm_architecture: {
    phase: "底座形成 → 规模化 → 成本约束下的新架构搜索",
    weeklyRelevance: "Transformer、GPT-3、H100 与 Mamba 串在一起看，问题从“模型能不能更大”变成“上下文、吞吐和推理成本能不能承受”。",
    nextWatch: "观察混合架构、长上下文和推理优化是否在真实产品负载中改变成本曲线。"
  },
  multimodal_architecture: {
    phase: "图文对齐 → 扩散生成 → 多模态产品化",
    weeklyRelevance: "CLIP、DDPM、Stable Diffusion 与 GPT-4 共同说明：多模态不是多接一个输入，而是表示、生成和产品入口一起变化。",
    nextWatch: "观察视频、音频和可控生成是否从演示走向稳定工作流。"
  },
  provider_releases: {
    phase: "论文发布 → API/产品发布 → 开放权重与平台策略",
    weeklyRelevance: "ChatGPT、GPT-4 与 Llama 2 显示，发布方式本身正在决定生态结构：闭源 API、开放权重、系统卡和开发平台各自塑造不同市场。",
    nextWatch: "观察供应商是否把价格、评测、安全和可部署性作为同等重要的发布信息。"
  },
  commercial_forces: {
    phase: "用户采用 → 资本开支 → 基础设施反推技术路线",
    weeklyRelevance: "ChatGPT 需求、NVIDIA H100 和数据中心收入把商业采用变成技术约束：GPU、网络、推理成本开始影响架构选择。",
    nextWatch: "观察 GPU 供给、云容量和推理单价是否继续改变模型训练和部署优先级。"
  }
};

const navGroups = [
  {
    label: "问题",
    items: [
      { href: "/", label: "本周", icon: CalendarDays },
      { href: "/trajectories", label: "长期趋势", icon: Waypoints },
      { href: "/causal-chains", label: "因果链", icon: GitBranch },
      { href: "/providers", label: "提供方", icon: Library },
      { href: "/sources", label: "来源", icon: BookOpen }
    ]
  }
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(`${value}T00:00:00Z`));
}

function emptyFilters(trajectory: "all" | Trajectory = "all"): Filters {
  return {
    trajectory,
    provider: "all",
    type: "all",
    confidence: "all",
    watchlistOnly: false
  };
}

function filterEvents(events: PublicEvent[], filters: Filters) {
  return events.filter((event) => {
    if (filters.trajectory !== "all" && !event.trajectories.includes(filters.trajectory)) {
      return false;
    }
    if (filters.provider !== "all" && !event.providers.includes(filters.provider)) {
      return false;
    }
    if (filters.type !== "all" && event.type !== filters.type) {
      return false;
    }
    if (filters.confidence !== "all" && event.confidence !== filters.confidence) {
      return false;
    }
    if (filters.watchlistOnly && !event.watchlist) {
      return false;
    }
    return true;
  });
}

function orderedWeekEvents(week: PublicWeek, events: PublicEvent[]) {
  const eventById = new Map(events.map((event) => [event.id, event]));
  const ids = [...week.headlineEventIds, ...week.watchlistEventIds];
  return ids.map((id) => eventById.get(id)).filter((event): event is PublicEvent => Boolean(event));
}

function sourceTypeLabel(sourceType: string) {
  return sourceTypeLabels[sourceType] ?? sourceType;
}

function firstBodyParagraphStartingWith(week: PublicWeek, prefix: string) {
  return week.body.split(/\n{2,}/).find((paragraph) => paragraph.startsWith(prefix));
}

function eventImpactLine(event: PublicEvent) {
  const trajectory = trajectoryLabels[event.primaryTrajectory];
  const provider = event.providers[0] ? `${event.providers[0]} · ` : "";
  return `${provider}${trajectory}：${event.whyItMatters}`;
}

function keyEventsForTrajectory(events: PublicEvent[], trajectory: Trajectory) {
  return events
    .filter((event) => event.trajectories.includes(trajectory))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);
}

export function PublicSite({ data, view, selectedWeek, selectedTrajectory }: PublicSiteProps) {
  const pathname = usePathname();
  const routeTrajectory = selectedTrajectory;
  const [filters, setFilters] = useState<Filters>(() => emptyFilters(routeTrajectory ?? "all"));
  const [activeEvent, setActiveEvent] = useState<PublicEvent | null>(null);
  const week = data.weeks.find((item) => item.weekStart === selectedWeek) ?? data.latestWeek;
  const weekEvents = orderedWeekEvents(week, data.events);
  const scopedEvents = view === "week" || view === "week-detail" ? weekEvents : data.events;
  const visibleFilters = useMemo(
    () => (routeTrajectory ? { ...filters, trajectory: routeTrajectory } : filters),
    [filters, routeTrajectory]
  );
  const filteredEvents = useMemo(() => filterEvents(scopedEvents, visibleFilters), [scopedEvents, visibleFilters]);
  const causalLinks = data.events.flatMap((event) => event.causalLinks);

  useEffect(() => {
    setFilters(emptyFilters(routeTrajectory ?? "all"));
  }, [routeTrajectory]);

  const applyFilters = (nextFilters: Filters) => {
    setFilters(routeTrajectory ? { ...nextFilters, trajectory: routeTrajectory } : nextFilters);
  };
  const clearFilters = () => {
    setFilters(emptyFilters(routeTrajectory ?? "all"));
  };

  return (
    <SidebarProvider>
      <Sidebar className="border-[#ded4bf] bg-[#f2ede4]/75">
        <SidebarContent className="p-3">
          <div className="px-3 pb-5 pt-4">
            <div className="font-serif text-xl font-black italic tracking-tight">AI Progress</div>
            <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Weekly Digest / V1
            </p>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">公开研究导航 · 仅批准内容</p>
          </div>
          {navGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {group.label}
              </SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-medium text-foreground outline-none transition-colors hover:bg-white/80 focus-visible:ring-2 focus-visible:ring-ring",
                          isActive && "bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary"
                        )}
                      >
                        <item.icon
                          className={cn("size-4", isActive ? "text-primary-foreground" : "text-muted-foreground")}
                          aria-hidden="true"
                        />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
          <div className="mx-3 mt-auto rounded-lg border border-[#ded4bf] bg-white/55 p-3">
            <Quote className="mb-2 size-4 text-muted-foreground" aria-hidden="true" />
            <p className="font-serif text-xs italic leading-5 text-muted-foreground">
              帮助个人创业者在 10 分钟内理解 AI 的长期技术与商业趋势。
            </p>
          </div>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="min-h-svh bg-background">
          <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-[#ded4bf] bg-background/90 px-3 backdrop-blur md:px-5">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="min-w-0">
              <div className="truncate font-serif text-sm font-bold italic">AI 进展公开站</div>
              <div className="hidden font-mono text-[11px] text-muted-foreground sm:block">
                {formatDate(week.weekStart)} - {formatDate(week.weekEnd)}
              </div>
            </div>
          </header>
          <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-3 py-5 md:px-6 md:py-7">
            {view === "week" ? (
              <WeekView
                week={week}
                events={weekEvents}
                onOpenEvent={setActiveEvent}
              />
            ) : null}
            {view === "week-detail" ? (
              <WeekDetailView
                week={week}
                events={filteredEvents}
                filters={visibleFilters}
                data={data}
                onFiltersChange={applyFilters}
                onClearFilters={clearFilters}
                onOpenEvent={setActiveEvent}
              />
            ) : null}
            {view === "trajectories" ? (
              <TrajectoriesView
                data={data}
                events={filteredEvents}
                filters={visibleFilters}
                selectedTrajectory={selectedTrajectory}
                onFiltersChange={applyFilters}
                onClearFilters={clearFilters}
                onOpenEvent={setActiveEvent}
              />
            ) : null}
            {view === "providers" ? <ProvidersView data={data} onOpenEvent={setActiveEvent} /> : null}
            {view === "sources" ? <SourcesView data={data} onOpenEvent={setActiveEvent} /> : null}
            {view === "causal-chains" ? (
              <CausalChainsView links={causalLinks} onOpenEvent={setActiveEvent} events={data.events} />
            ) : null}
          </main>
        </div>
      </SidebarInset>
      <EventSheet event={activeEvent} onOpenChange={(open) => !open && setActiveEvent(null)} />
    </SidebarProvider>
  );
}

function WeekView({
  week,
  events,
  onOpenEvent
}: {
  week: PublicWeek;
  events: PublicEvent[];
  onOpenEvent: (event: PublicEvent) => void;
}) {
  const mainLine = firstBodyParagraphStartingWith(week, "本周的主线");
  const headlineEvents = events.filter((event) => week.headlineEventIds.includes(event.id));
  const watchlistEvents = events.filter((event) => week.watchlistEventIds.includes(event.id));

  return (
    <>
      <section className="space-y-5 border-b border-[#ded4bf] pb-6" aria-label="最新周报">
        <div className="space-y-2">
          <Badge variant="secondary" className="w-fit border border-primary bg-transparent font-mono text-[10px] uppercase tracking-[0.18em]">
            最新周报 · {week.weekStart}
          </Badge>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700">
            Weekly Thesis · 本周研判主线
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1fr_0.72fr] lg:items-start">
          <div className="space-y-4">
            <h1 className="max-w-4xl font-serif text-4xl font-black italic leading-tight tracking-normal md:text-5xl">
              本周 AI 发生了什么，它在长期趋势中意味着什么？
            </h1>
            <p className="max-w-3xl font-serif text-base leading-8 text-muted-foreground">{week.thesis}</p>
            {mainLine ? <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{mainLine}</p> : null}
            <Link href={`/weeks/${week.weekStart}`} className="inline-flex min-h-10 items-center gap-1 font-mono text-[11px] font-semibold uppercase text-primary hover:underline">
              打开周报详情 <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          </div>
          <aside className="relative overflow-hidden rounded-xl bg-primary p-6 text-primary-foreground shadow-sm">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground/55">
              Closing Synthesis · 结语前瞻
            </div>
            <p className="mt-3 font-serif text-base italic leading-8 text-primary-foreground/90">{week.closingSynthesis}</p>
            <Quote className="absolute -bottom-5 -right-4 size-24 text-primary-foreground/10" aria-hidden="true" />
          </aside>
        </div>
      </section>
      <section className="space-y-6" aria-label="主线聚焦">
        <div className="flex items-center justify-between border-b border-[#ded4bf] pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="size-3" aria-hidden="true" />
              Main Focus · 主线聚焦
            </div>
            <h2 className="font-serif text-2xl font-black italic">主线聚焦</h2>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">{headlineEvents.length} 个重点事件</Badge>
        </div>
        {headlineEvents.length > 0 ? (
          <EventGrid events={headlineEvents} onOpenEvent={onOpenEvent} />
        ) : (
          <SparseEmpty title="暂无主线事件" description="这期周报还没有绑定可展示的主线事件。" />
        )}
        {watchlistEvents.length > 0 ? (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-2 border-b border-[#ded4bf] pb-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-rose-600">
              <Clock className="size-3" aria-hidden="true" />
              Emerging Watchlist · 长线趋势技术看点
            </div>
            <EventGrid events={watchlistEvents} onOpenEvent={onOpenEvent} />
          </div>
        ) : null}
      </section>
    </>
  );
}

function WeekDetailView({
  week,
  events,
  filters,
  data,
  onFiltersChange,
  onClearFilters,
  onOpenEvent
}: {
  week: PublicWeek;
  events: PublicEvent[];
  filters: Filters;
  data: PublicSiteData;
  onFiltersChange: (filters: Filters) => void;
  onClearFilters: () => void;
  onOpenEvent: (event: PublicEvent) => void;
}) {
  const hasWatchlistEvents = events.some((event) => event.watchlist);

  return (
    <>
      <PageHeading
        eyebrow={`${formatDate(week.weekStart)} - ${formatDate(week.weekEnd)}`}
        title="周报详情"
        description={week.thesis}
      />
      <section className="grid gap-4 lg:grid-cols-[1fr_0.72fr]">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>周报正文</CardTitle>
            <CardDescription>来自 `content/approved/weeks` 的已批准周报内容。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-foreground">
            {week.body.split(/\n{2,}/).map((paragraph) => (
              <p key={paragraph} className="whitespace-pre-wrap">
                {paragraph}
              </p>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>详细综合</CardTitle>
            <CardDescription>把本周事件放回长期趋势的读法。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
            <p>{week.closingSynthesis}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">头条事件 {week.headlineEventIds.length}</Badge>
              <Badge variant="outline">观察清单 {week.watchlistEventIds.length}</Badge>
            </div>
          </CardContent>
        </Card>
      </section>
      <FilterBar
        context="week-detail"
        data={data}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onClearFilters={onClearFilters}
      />
      <section className="space-y-3">
        <div className="flex flex-col gap-1 border-b pb-3">
          <h2 className="text-base font-semibold">周报事件</h2>
          <p className="text-sm text-muted-foreground">保留事件卡片与抽屉，便于从正文回到原始事件证据。</p>
        </div>
        {filters.watchlistOnly && !hasWatchlistEvents ? (
          <SparseEmpty title="本周没有匹配的观察清单" description="这个周报有观察清单条目，但当前筛选组合没有留下任何结果。" />
        ) : events.length === 0 ? (
          <SparseEmpty title="没有匹配筛选的事件" description="换一个轨迹、提供方、事件类型或信心条件，再回到证据列表。" />
        ) : (
          <EventGrid events={events} onOpenEvent={onOpenEvent} />
        )}
      </section>
    </>
  );
}

function TrajectoriesView({
  data,
  events,
  filters,
  selectedTrajectory,
  onFiltersChange,
  onClearFilters,
  onOpenEvent
}: {
  data: PublicSiteData;
  events: PublicEvent[];
  filters: Filters;
  selectedTrajectory?: Trajectory;
  onFiltersChange: (filters: Filters) => void;
  onClearFilters: () => void;
  onOpenEvent: (event: PublicEvent) => void;
}) {
  const visibleTrajectories = selectedTrajectory
    ? data.trajectories.filter((trajectory) => trajectory.id === selectedTrajectory)
    : data.trajectories;

  return (
    <>
      <PageHeading
        eyebrow="长期轨迹"
        title={selectedTrajectory ? trajectoryLabels[selectedTrajectory] : "长期趋势"}
        description="把事件放回架构、模态、供应商策略和商业约束四条线里阅读。"
      />
      {selectedTrajectory ? (
        <TrajectoryContextHeader data={data} selectedTrajectory={selectedTrajectory} />
      ) : null}
      <div className="flex flex-col gap-4" aria-label="轨迹读法列表">
        {visibleTrajectories.map((trajectory) => {
          const narrative = trajectoryNarratives[trajectory.id];
          const keyEvents = keyEventsForTrajectory(data.events, trajectory.id);
          return (
            <section key={`${trajectory.id}-cockpit`} className="rounded-xl border border-[#ded4bf] bg-[#f2ede4]/45 p-5">
              <div className="space-y-2">
                <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-[0.14em]">Track Reading · 轨迹读法</Badge>
                <h2 className="font-serif text-lg font-black italic">{trajectory.title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">{trajectory.primer}</p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-[#ded4bf] bg-white/65 p-3">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">关键历史锚点</div>
                  <p className="mt-1 text-sm leading-6">{narrative.phase}</p>
                </div>
                <div className="rounded-md border border-[#ded4bf] bg-white/65 p-3">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">本周相关性</div>
                  <p className="mt-1 text-sm leading-6">{narrative.weeklyRelevance}</p>
                </div>
                <div className="rounded-md border border-[#ded4bf] bg-white/65 p-3">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">下一步观察</div>
                  <p className="mt-1 text-sm leading-6">{narrative.nextWatch}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="text-xs font-medium text-muted-foreground">锚点事件</div>
                <div className="flex flex-wrap gap-2">
                  {keyEvents.map((event) => (
                    <Badge key={event.id} variant={event.primaryTrajectory === trajectory.id ? "default" : "outline"}>
                      {formatDate(event.date)} · {event.title}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="text-xs font-medium text-muted-foreground">观察问题</div>
                <ul className="space-y-1 text-sm leading-6 text-muted-foreground">
                  {trajectory.watchQuestions.slice(0, 2).map((question) => (
                    <li key={question}>• {question}</li>
                  ))}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
      <FilterBar
        context={selectedTrajectory ? "trajectory-detail" : "trajectories"}
        data={data}
        filters={filters}
        onFiltersChange={onFiltersChange}
        onClearFilters={onClearFilters}
      />
      {events.length === 0 ? (
        <SparseEmpty title="这条轨迹暂时很稀疏" description="当前批准内容还没有覆盖这个筛选组合；公开站点不会展示草稿或本地策展材料。" />
      ) : (
        <TimelineStream events={events} onOpenEvent={onOpenEvent} />
      )}
    </>
  );
}

function TrajectoryContextHeader({
  data,
  selectedTrajectory
}: {
  data: PublicSiteData;
  selectedTrajectory: Trajectory;
}) {
  return (
    <section className="rounded-xl border border-[#ded4bf] bg-white/70 p-4" aria-label="当前轨迹">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            当前轨迹
          </div>
          <h2 className="font-serif text-lg font-black italic">{trajectoryLabels[selectedTrajectory]}</h2>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="切换长期轨迹">
          <Link
            href="/trajectories"
            className="rounded-md border border-[#ded4bf] bg-background px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            全部轨迹
          </Link>
          {data.trajectories.map((trajectory) => {
            const isActive = trajectory.id === selectedTrajectory;
            return (
              <Link
                key={trajectory.id}
                href={`/trajectories/${trajectory.id}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-[#ded4bf] bg-background text-muted-foreground hover:bg-white"
                )}
              >
                {trajectoryLabels[trajectory.id]}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProvidersView({
  data,
  onOpenEvent
}: {
  data: PublicSiteData;
  onOpenEvent: (event: PublicEvent) => void;
}) {
  return (
    <>
      <PageHeading
        eyebrow="提供方"
        title="提供方"
        description="按 OpenAI、NVIDIA、Meta 等提供方查看它们如何通过模型、硬件、开放策略和产品入口改变 AI 进展。"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {data.providers.map((provider) => {
          const events = data.events.filter((event) => event.providers.includes(provider));
          return (
            <section key={provider} className="rounded-xl border border-[#ded4bf] bg-white/80 p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#ece4d5] pb-3">
                <h2 className="flex items-center gap-2 font-serif text-base font-black italic">
                  <Users className="size-4 text-muted-foreground" aria-hidden="true" />
                  {provider}
                </h2>
                <Badge variant="outline" className="font-mono text-[10px]">{events.length} 事件已核准</Badge>
              </div>
              <div className="space-y-2">
                {events.map((event) => (
                  <CompactEventRow key={event.id} event={event} onOpenEvent={onOpenEvent} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function SourcesView({
  data,
  onOpenEvent
}: {
  data: PublicSiteData;
  onOpenEvent: (event: PublicEvent) => void;
}) {
  const eventsWithoutSources = data.events.filter((event) => event.sources.length === 0);

  return (
    <>
      <PageHeading
        eyebrow="来源"
        title="来源"
        description="公开站点把每个判断绑回来源数量与来源类型；缺失来源的内容不会被包装成确定事实。"
      />
      {eventsWithoutSources.length > 0 ? (
        <SparseEmpty title="有事件缺少来源" description="这些事件需要回到策展流程补证据，暂不应作为公共判断。" />
      ) : (
        <SparseEmpty title="没有缺失来源" description="当前批准事件都至少带有一个公开来源；本页只展示已批准来源元数据。" />
      )}
      <div className="space-y-3">
        {data.events.map((event) => (
          <section key={event.id} className="rounded-xl border border-[#ded4bf] bg-white/80 p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <button
                type="button"
                onClick={() => onOpenEvent(event)}
                className="text-left font-serif text-sm font-bold italic text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {event.title}
              </button>
              <Badge variant="outline">来源 {event.sources.length}</Badge>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {event.sources.map((source) => (
                <a
                  key={`${event.id}-${source.url}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start justify-between gap-3 rounded-md border border-[#ded4bf] bg-[#f9f8f6] px-3 py-2 text-sm hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>
                    <span className="block font-medium">{source.title}</span>
                    <span className="text-xs text-muted-foreground">{sourceTypeLabel(source.sourceType)}</span>
                  </span>
                  <ExternalLink className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function CausalChainsView({
  links,
  events,
  onOpenEvent
}: {
  links: PublicCausalLink[];
  events: PublicEvent[];
  onOpenEvent: (event: PublicEvent) => void;
}) {
  const eventById = new Map(events.map((event) => [event.id, event]));

  return (
    <>
      <PageHeading
        eyebrow="因果链"
        title="因果链"
        description="把商业动作、技术压力和架构结果分开看：不是每条新闻都重要，重要的是它改变了哪条约束。"
      />
      <section className="grid gap-3 md:grid-cols-3" aria-label="商业到技术阅读路径">
        <div className="rounded-xl border border-[#ded4bf] bg-[#f2ede4]/45 p-4">
          <Badge variant="secondary" className="font-mono text-[10px]">1 商业动作</Badge>
          <h2 className="mt-2 font-serif text-sm font-bold italic">需求、资本和供应链先动</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">ChatGPT 采用、NVIDIA 收入和 GPU 供给让市场压力变成工程约束。</p>
        </div>
        <div className="rounded-xl border border-[#ded4bf] bg-[#f2ede4]/45 p-4">
          <Badge variant="secondary" className="font-mono text-[10px]">2 技术压力</Badge>
          <h2 className="mt-2 font-serif text-sm font-bold italic">成本、吞吐和可靠性被重新排序</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">当产品变成高频使用，推理成本、集群网络和安全评测会影响研发优先级。</p>
        </div>
        <div className="rounded-xl border border-[#ded4bf] bg-[#f2ede4]/45 p-4">
          <Badge variant="secondary" className="font-mono text-[10px]">3 架构结果</Badge>
          <h2 className="mt-2 font-serif text-sm font-bold italic">模型路线被基础设施反推</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">H100、Mamba、开放权重和多模态系统都可以放回这条约束链里阅读。</p>
        </div>
      </section>
      {links.length === 0 ? (
        <SparseEmpty title="暂无因果链" description="批准内容里还没有可公开展示的因果关系。" />
      ) : (
        <div className="grid gap-3">
          {links.map((link) => {
            const sourceEvent = eventById.get(link.sourceEventId);
            return (
              <section key={`${link.sourceEventId}-${link.targetConcept ?? link.targetEventId}`} className="rounded-xl border border-[#ded4bf] bg-white/85 p-5 shadow-sm">
                <div className="grid gap-3 md:grid-cols-[0.9fr_auto_1.2fr] md:items-center">
                  <button
                    type="button"
                    onClick={() => sourceEvent && onOpenEvent(sourceEvent)}
                    className="rounded-lg border border-[#ded4bf] bg-[#f9f8f6] p-3 text-left outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">来源事件</span>
                    <span className="mt-1 block font-serif text-sm font-bold italic">{link.sourceEventTitle}</span>
                  </button>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground md:flex-col">
                    <ArrowRight className="size-4" aria-hidden="true" />
                    <Badge variant="secondary">{relationshipLabels[link.relationshipType] ?? link.relationshipType}</Badge>
                  </div>
                  <div className="rounded-lg border border-[#ded4bf] bg-[#f9f8f6] p-3">
                    <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">目标</span>
                    <span className="mt-1 block font-serif text-sm font-bold italic">
                      {link.targetEventTitle ?? link.targetConcept}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{link.explanation}</p>
                <p className="mt-2 text-sm font-medium">
                  判断：{link.sourceEventTitle} 正在{relationshipLabels[link.relationshipType] ?? link.relationshipType}
                  {link.targetEventTitle ?? link.targetConcept}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ConfidenceBadge confidence={link.confidence} />
                  <Badge variant="outline">来源 {link.sources.length}</Badge>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function FilterBar({
  context,
  data,
  filters,
  onFiltersChange,
  onClearFilters
}: {
  context: FilterContext;
  data: PublicSiteData;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onClearFilters: () => void;
}) {
  const showTrajectoryFilter = context === "trajectories";
  const labelByContext: Record<FilterContext, string> = {
    "week-detail": "筛选周报事件",
    trajectories: "筛选轨迹事件",
    "trajectory-detail": "筛选当前轨迹事件"
  };
  const activeBadges = [
    showTrajectoryFilter && filters.trajectory !== "all" ? trajectoryLabels[filters.trajectory] : null,
    filters.provider !== "all" ? filters.provider : null,
    filters.type !== "all" ? eventTypeLabels[filters.type] : null,
    filters.confidence !== "all" ? confidenceLabels[filters.confidence] : null,
    filters.watchlistOnly ? "只看观察清单" : null
  ].filter((item): item is string => Boolean(item));

  return (
    <section className="rounded-xl border border-[#ded4bf] bg-white/70 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {labelByContext[context]}
        </div>
        <button
          type="button"
          onClick={onClearFilters}
          className="w-fit font-mono text-[11px] font-semibold uppercase text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          清除筛选
        </button>
      </div>
      <div className={cn("grid gap-3", showTrajectoryFilter ? "xl:grid-cols-[1.4fr_0.75fr_0.75fr_0.75fr_auto]" : "xl:grid-cols-[0.75fr_0.75fr_0.75fr_auto]")}>
        {showTrajectoryFilter ? (
          <ToggleGroup
            type="single"
            value={filters.trajectory}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, trajectory: (value || "all") as Filters["trajectory"] })
            }
            className="flex flex-wrap justify-start"
            aria-label="按长期轨迹筛选"
          >
            <ToggleGroupItem value="all" variant="outline" size="sm">全部轨迹</ToggleGroupItem>
            {data.trajectories.map((trajectory) => (
              <ToggleGroupItem key={trajectory.id} value={trajectory.id} variant="outline" size="sm">
                {trajectoryLabels[trajectory.id]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
        <Select value={filters.provider} onValueChange={(provider) => onFiltersChange({ ...filters, provider })}>
          <SelectTrigger aria-label="按提供方筛选">
            <SelectValue placeholder="提供方" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部提供方</SelectItem>
            {data.providers.map((provider) => (
              <SelectItem key={provider} value={provider}>{provider}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.type} onValueChange={(type) => onFiltersChange({ ...filters, type: type as Filters["type"] })}>
          <SelectTrigger aria-label="按事件类型筛选">
            <SelectValue placeholder="事件类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            {data.eventTypes.map((type) => (
              <SelectItem key={type} value={type}>{eventTypeLabels[type]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.confidence}
          onValueChange={(confidence) =>
            onFiltersChange({ ...filters, confidence: confidence as Filters["confidence"] })
          }
        >
          <SelectTrigger aria-label="按信心筛选">
            <SelectValue placeholder="信心" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部信心</SelectItem>
            {data.confidenceLevels.map((confidence) => (
              <SelectItem key={confidence} value={confidence}>{confidenceLabels[confidence]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex min-h-10 items-center gap-2 rounded-md border border-[#ded4bf] bg-background px-3 text-sm">
          <Checkbox
            checked={filters.watchlistOnly}
            onCheckedChange={(checked) => onFiltersChange({ ...filters, watchlistOnly: checked === true })}
          />
          只看观察清单
        </label>
      </div>
      {activeBadges.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeBadges.map((badge) => (
            <Badge key={badge} variant="secondary">{badge}</Badge>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function EventGrid({
  events,
  onOpenEvent
}: {
  events: PublicEvent[];
  onOpenEvent: (event: PublicEvent) => void;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {events.map((event) => (
        <EventCard key={event.id} event={event} onOpenEvent={onOpenEvent} />
      ))}
    </div>
  );
}

function TimelineStream({
  events,
  onOpenEvent
}: {
  events: PublicEvent[];
  onOpenEvent: (event: PublicEvent) => void;
}) {
  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section className="relative ml-3 space-y-6 border-l border-[#d8ccb5] py-2 pl-6" aria-label="轨迹时间线">
      {sortedEvents.map((event) => (
        <article key={event.id} className="relative">
          <span className="absolute -left-[33px] top-4 flex size-4 items-center justify-center rounded-full border-2 border-primary bg-background">
            <span className="size-1.5 rounded-full bg-primary" />
          </span>
          <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[10px]">
            <span className="rounded border border-primary bg-white px-2 py-0.5 font-bold text-primary">
              {formatDate(event.date)}
            </span>
            <span className="rounded border border-[#ded4bf] bg-white/70 px-2 py-0.5 font-bold uppercase text-muted-foreground">
              {eventTypeLabels[event.type]}
            </span>
            <span className="text-muted-foreground">ID: {event.id}</span>
          </div>
          <CompactEventRow event={event} onOpenEvent={onOpenEvent} />
        </article>
      ))}
    </section>
  );
}

function EventCard({
  event,
  onOpenEvent
}: {
  event: PublicEvent;
  onOpenEvent: (event: PublicEvent) => void;
}) {
  return (
    <Card className="group rounded-xl border-[#ded4bf] bg-white/85 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="border border-[#ded4bf] bg-[#f9f8f6] font-mono text-[9px] font-bold uppercase tracking-[0.12em]">
              {eventTypeLabels[event.type]}
            </Badge>
            <ConfidenceBadge confidence={event.confidence} />
            {event.watchlist ? <Badge variant="default" className="font-mono text-[9px] uppercase tracking-[0.12em]">观察清单</Badge> : null}
          </div>
          <span className="shrink-0 font-mono text-[10px] font-bold uppercase text-muted-foreground">{formatDate(event.date)}</span>
        </div>
        <CardTitle>
          <button
            type="button"
            onClick={() => onOpenEvent(event)}
            className="text-left font-serif text-base font-black italic leading-6 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`查看事件：${event.title}`}
          >
            {event.title}
          </button>
        </CardTitle>
        <CardDescription className="line-clamp-2 leading-6">{event.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0">
        <div className="rounded-md border border-[#ded4bf] bg-[#f9f8f6] p-3">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">它改变的轨迹</div>
          <p className="mt-1 text-sm leading-6">{eventImpactLine(event)}</p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[#ece4d5] pt-3 font-mono text-[10px] text-muted-foreground">
          <span className="min-w-0 truncate">
            轨迹：<b className="font-semibold text-foreground">{trajectoryLabels[event.primaryTrajectory]}</b>
          </span>
          <span className="shrink-0 font-semibold text-foreground">来源 {event.sources.length}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CompactEventRow({
  event,
  onOpenEvent
}: {
  event: PublicEvent;
  onOpenEvent: (event: PublicEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenEvent(event)}
      className="flex w-full items-start justify-between gap-3 rounded-lg border border-[#ded4bf] bg-white/85 px-4 py-3 text-left outline-none transition-all hover:border-primary hover:bg-white hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span>
        <span className="block font-serif text-sm font-bold italic leading-5">{event.title}</span>
        <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {formatDate(event.date)} · {eventTypeLabels[event.type]} · {confidenceLabels[event.confidence]}
        </span>
      </span>
      <Badge variant="outline">来源 {event.sources.length}</Badge>
    </button>
  );
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return <Badge variant="outline" className="font-mono text-[9px] font-bold uppercase tracking-[0.12em]">信心：{confidenceLabels[confidence]}</Badge>;
}

function PageHeading({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="space-y-3 border-b border-[#ded4bf] pb-5">
      <Badge variant="secondary" className="w-fit font-mono text-[10px] uppercase tracking-[0.18em]">{eyebrow}</Badge>
      <h1 className="font-serif text-3xl font-black italic tracking-normal">{title}</h1>
      <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{description}</p>
    </section>
  );
}

function SparseEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="rounded-xl border-[#ded4bf] bg-white/75">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Search className="size-4 text-muted-foreground" aria-hidden="true" />
      </EmptyContent>
    </Empty>
  );
}

function EventSheet({
  event,
  onOpenChange
}: {
  event: PublicEvent | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(event)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden border-[#ded4bf] bg-background p-0 sm:max-w-2xl">
        {event ? (
          <ScrollArea className="h-svh">
            <div className="p-6 pr-10 md:p-8 md:pr-12">
              <SheetHeader>
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">ID: {event.id}</Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">{formatDate(event.date)}</Badge>
                  <Badge variant="secondary" className="font-mono text-[10px]">{eventTypeLabels[event.type]}</Badge>
                  {event.watchlist ? <Badge>观察清单</Badge> : null}
                </div>
                <SheetTitle className="font-serif text-2xl font-black italic leading-tight md:text-3xl">{event.title}</SheetTitle>
                <SheetDescription className="font-serif text-sm leading-7">{event.summary}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <section className="grid gap-3 rounded-xl border border-[#ded4bf] bg-[#f2ede4]/45 p-4 text-sm md:grid-cols-2">
                  <div>
                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">研判置信度</div>
                    <div className="mt-1"><ConfidenceBadge confidence={event.confidence} /></div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">技术提供方</div>
                    <p className="mt-1 font-semibold">{event.providers.join(", ") || "未知"}</p>
                  </div>
                </section>
                <section className="relative overflow-hidden rounded-xl bg-primary p-6 text-primary-foreground shadow-sm">
                  <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                    Why It Matters · 为什么关键
                  </h3>
                  <p className="mt-3 font-serif text-sm italic leading-7 text-primary-foreground/90">{event.whyItMatters}</p>
                  <Sparkles className="absolute -bottom-5 -right-4 size-24 text-primary-foreground/10" aria-hidden="true" />
                </section>
                <section className="space-y-2">
                  <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">关联的技术与商业轨迹</h3>
                  <div className="flex flex-wrap gap-2">
                    {event.trajectories.map((trajectory) => (
                      <Badge key={trajectory} variant="outline">{trajectoryLabels[trajectory]}</Badge>
                    ))}
                    {event.providers.map((provider) => (
                      <Badge key={provider} variant="secondary">{provider}</Badge>
                    ))}
                  </div>
                </section>
                <section className="space-y-2">
                  <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Primary Evidence · 公开来源</h3>
                  {event.sources.length === 0 ? (
                    <SparseEmpty title="缺少来源" description="这个事件不会在公共站点中作为确定判断展示。" />
                  ) : (
                    <div className="grid gap-2">
                      {event.sources.map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span>
                            <span className="block font-medium">{source.title}</span>
                            <span className="text-xs text-muted-foreground">{sourceTypeLabel(source.sourceType)}</span>
                          </span>
                          <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  )}
                </section>
                {event.causalLinks.length > 0 ? (
                  <section className="space-y-2">
                    <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">因果关系</h3>
                    {event.causalLinks.map((link) => (
                      <div key={`${link.sourceEventId}-${link.targetConcept ?? link.targetEventId}`} className="rounded-md border p-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{relationshipLabels[link.relationshipType] ?? link.relationshipType}</Badge>
                          <ConfidenceBadge confidence={link.confidence} />
                          <Badge variant="outline">来源 {link.sources.length}</Badge>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{link.explanation}</p>
                      </div>
                    ))}
                  </section>
                ) : null}
                {event.body ? (
                  <section className="space-y-2">
                    <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">笔记</h3>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{event.body}</p>
                  </section>
                ) : null}
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
