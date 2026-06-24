"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ExternalLink,
  Filter,
  GitBranch,
  Layers3,
  Library,
  RadioTower,
  Search,
  ShieldCheck,
  Sparkles,
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

const navGroups = [
  {
    label: "问题",
    items: [
      { href: "/", label: "本周发生了什么", icon: CalendarDays },
      { href: "/trajectories", label: "长期趋势是什么", icon: Waypoints },
      { href: "/causal-chains", label: "因果链如何连接", icon: GitBranch }
    ]
  },
  {
    label: "轨迹",
    items: [
      { href: "/trajectories/llm_architecture", label: "LLM 架构演进", icon: Layers3 },
      { href: "/trajectories/multimodal_architecture", label: "多模态架构", icon: Sparkles },
      { href: "/trajectories/provider_releases", label: "供应商发布与开放策略", icon: RadioTower },
      { href: "/trajectories/commercial_forces", label: "商业力量与基础设施约束", icon: ShieldCheck }
    ]
  },
  {
    label: "视图",
    items: [
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
      <Sidebar>
        <SidebarContent>
          <div className="px-4 pb-3 pt-4">
            <div className="text-sm font-semibold">Mind Wiki AI Progress</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">公开研究导航 · 仅批准内容</p>
          </div>
          {navGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-sm text-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
                          isActive && "bg-accent font-medium text-accent-foreground"
                        )}
                      >
                        <item.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="min-h-svh bg-background">
          <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur md:px-5">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">AI 进展公开站</div>
              <div className="hidden text-xs text-muted-foreground sm:block">
                {formatDate(week.weekStart)} - {formatDate(week.weekEnd)}
              </div>
            </div>
          </header>
          <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-3 py-5 md:px-6 md:py-7">
            {view === "week" ? (
              <WeekView
                week={week}
                events={filteredEvents}
                filters={visibleFilters}
                data={data}
                onFiltersChange={applyFilters}
                onClearFilters={clearFilters}
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
      <section className="grid gap-4 border-b pb-5 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-4">
          <Badge variant="secondary" className="w-fit">最新周报 · {week.weekStart}</Badge>
          <div className="space-y-3">
            <h1 className="max-w-4xl text-3xl font-semibold leading-tight tracking-normal md:text-4xl">
              本周 AI 发生了什么，它在长期趋势中意味着什么？
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground">{week.thesis}</p>
          </div>
        </div>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>本周读法</CardTitle>
            <CardDescription>历史锚点不是时间线噪音，而是能力、产品与基础设施互相塑形的证据。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6">
            <p>{week.closingSynthesis}</p>
            <Link href={`/weeks/${week.weekStart}`} className="inline-flex items-center gap-1 font-medium text-primary">
              打开周报详情 <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      </section>
      <FilterBar data={data} filters={filters} onFiltersChange={onFiltersChange} onClearFilters={onClearFilters} />
      {filters.watchlistOnly && !hasWatchlistEvents ? (
        <SparseEmpty title="本周没有匹配的观察清单" description="这个周报有观察清单条目，但当前筛选组合没有留下任何结果。" />
      ) : events.length === 0 ? (
        <SparseEmpty title="没有匹配筛选的事件" description="换一个轨迹、提供方、事件类型或信心条件，再回到证据列表。" />
      ) : (
        <EventGrid events={events} onOpenEvent={onOpenEvent} />
      )}
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
      <FilterBar data={data} filters={filters} onFiltersChange={onFiltersChange} onClearFilters={onClearFilters} />
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
  return (
    <>
      <PageHeading
        eyebrow="长期轨迹"
        title={selectedTrajectory ? trajectoryLabels[selectedTrajectory] : "长期趋势"}
        description="把事件放回架构、模态、供应商策略和商业约束四条线里阅读。"
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.trajectories.map((trajectory) => {
          const count = data.events.filter((event) => event.trajectories.includes(trajectory.id)).length;
          return (
            <Card key={trajectory.id} className="rounded-md">
              <CardHeader>
                <CardTitle>{trajectory.title}</CardTitle>
                <CardDescription>{count} 个批准事件</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>{trajectory.primer}</p>
                <Link href={`/trajectories/${trajectory.id}`} className="font-medium text-primary">
                  聚焦这条轨迹
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <FilterBar data={data} filters={filters} onFiltersChange={onFiltersChange} onClearFilters={onClearFilters} />
      {events.length === 0 ? (
        <SparseEmpty title="这条轨迹暂时很稀疏" description="当前批准内容还没有覆盖这个筛选组合；公开站点不会展示草稿或本地策展材料。" />
      ) : (
        <EventGrid events={events} onOpenEvent={onOpenEvent} />
      )}
    </>
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
            <section key={provider} className="rounded-md border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">{provider}</h2>
                <Badge variant="outline">{events.length} 事件</Badge>
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
          <section key={event.id} className="rounded-md border bg-card p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <button
                type="button"
                onClick={() => onOpenEvent(event)}
                className="text-left text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
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
                  className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        description="用紧凑面板展示哪些事件正在施压、促成或影响后续技术路线，并把信心与来源数量放在判断旁边。"
      />
      {links.length === 0 ? (
        <SparseEmpty title="暂无因果链" description="批准内容里还没有可公开展示的因果关系。" />
      ) : (
        <div className="grid gap-3">
          {links.map((link) => {
            const sourceEvent = eventById.get(link.sourceEventId);
            return (
              <section key={`${link.sourceEventId}-${link.targetConcept ?? link.targetEventId}`} className="rounded-md border bg-card p-4">
                <div className="grid gap-3 md:grid-cols-[0.9fr_auto_1.2fr] md:items-center">
                  <button
                    type="button"
                    onClick={() => sourceEvent && onOpenEvent(sourceEvent)}
                    className="rounded-md border bg-background p-3 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block text-xs text-muted-foreground">来源事件</span>
                    <span className="mt-1 block text-sm font-semibold">{link.sourceEventTitle}</span>
                  </button>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground md:flex-col">
                    <ArrowRight className="size-4" aria-hidden="true" />
                    <Badge variant="secondary">{relationshipLabels[link.relationshipType] ?? link.relationshipType}</Badge>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <span className="block text-xs text-muted-foreground">目标</span>
                    <span className="mt-1 block text-sm font-semibold">
                      {link.targetEventTitle ?? link.targetConcept}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{link.explanation}</p>
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
  data,
  filters,
  onFiltersChange,
  onClearFilters
}: {
  data: PublicSiteData;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onClearFilters: () => void;
}) {
  const activeBadges = [
    filters.trajectory !== "all" ? trajectoryLabels[filters.trajectory] : null,
    filters.provider !== "all" ? filters.provider : null,
    filters.type !== "all" ? eventTypeLabels[filters.type] : null,
    filters.confidence !== "all" ? confidenceLabels[filters.confidence] : null,
    filters.watchlistOnly ? "只看观察清单" : null
  ].filter((item): item is string => Boolean(item));

  return (
    <section className="rounded-md border bg-card p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Filter className="size-4" aria-hidden="true" />
          筛选证据
        </div>
        <button
          type="button"
          onClick={onClearFilters}
          className="w-fit text-sm text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          清除筛选
        </button>
      </div>
      <div className="grid gap-3 xl:grid-cols-[1.4fr_0.75fr_0.75fr_0.75fr_auto]">
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
        <label className="flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm">
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
    <div className="grid gap-3 lg:grid-cols-2">
      {events.map((event) => (
        <EventCard key={event.id} event={event} onOpenEvent={onOpenEvent} />
      ))}
    </div>
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
    <Card className="rounded-md">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{formatDate(event.date)}</Badge>
          <Badge variant="secondary">{eventTypeLabels[event.type]}</Badge>
          <Badge variant="outline">{trajectoryLabels[event.primaryTrajectory]}</Badge>
          {event.watchlist ? <Badge variant="default">观察清单</Badge> : null}
        </div>
        <CardTitle>
          <button
            type="button"
            onClick={() => onOpenEvent(event)}
            className="text-left leading-6 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`查看事件：${event.title}`}
          >
            {event.title}
          </button>
        </CardTitle>
        <CardDescription className="leading-6">{event.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">{event.whyItMatters}</p>
        <div className="flex flex-wrap gap-2">
          {event.providers.map((provider) => (
            <Badge key={provider} variant="outline">{provider}</Badge>
          ))}
          <ConfidenceBadge confidence={event.confidence} />
          <Badge variant="outline">来源 {event.sources.length}</Badge>
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
      className="flex w-full items-start justify-between gap-3 rounded-md border bg-background px-3 py-2 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span>
        <span className="block text-sm font-medium">{event.title}</span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {formatDate(event.date)} · {eventTypeLabels[event.type]} · {confidenceLabels[event.confidence]}
        </span>
      </span>
      <Badge variant="outline">来源 {event.sources.length}</Badge>
    </button>
  );
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return <Badge variant="outline">信心：{confidenceLabels[confidence]}</Badge>;
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
    <section className="space-y-3 border-b pb-5">
      <Badge variant="secondary" className="w-fit">{eyebrow}</Badge>
      <h1 className="text-3xl font-semibold tracking-normal">{title}</h1>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
    </section>
  );
}

function SparseEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="rounded-md bg-card">
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
      <SheetContent className="w-full overflow-hidden p-0 sm:max-w-2xl">
        {event ? (
          <ScrollArea className="h-svh">
            <div className="p-6 pr-10">
              <SheetHeader>
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{formatDate(event.date)}</Badge>
                  <Badge variant="secondary">{eventTypeLabels[event.type]}</Badge>
                  {event.watchlist ? <Badge>观察清单</Badge> : null}
                </div>
                <SheetTitle>{event.title}</SheetTitle>
                <SheetDescription className="leading-6">{event.summary}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">为什么重要</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{event.whyItMatters}</p>
                </section>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">轨迹与提供方</h3>
                  <div className="flex flex-wrap gap-2">
                    {event.trajectories.map((trajectory) => (
                      <Badge key={trajectory} variant="outline">{trajectoryLabels[trajectory]}</Badge>
                    ))}
                    {event.providers.map((provider) => (
                      <Badge key={provider} variant="secondary">{provider}</Badge>
                    ))}
                    <ConfidenceBadge confidence={event.confidence} />
                  </div>
                </section>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">公开来源</h3>
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
                    <h3 className="text-sm font-semibold">因果关系</h3>
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
                    <h3 className="text-sm font-semibold">笔记</h3>
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
