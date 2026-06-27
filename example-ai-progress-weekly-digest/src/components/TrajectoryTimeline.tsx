import React, { useState } from 'react';
import { Event, TrajectoryType } from '../types';
import { Layers, SlidersHorizontal, ArrowDown, ArrowUp, Clock, HelpCircle, Users } from 'lucide-react';
import { EVENT_TYPE_MAP, TRAJECTORY_MAP } from './EventCard';

interface TrajectoryTimelineProps {
  events: Event[];
  onOpenDetails: (event: Event) => void;
}

export default function TrajectoryTimeline({ events, onOpenDetails }: TrajectoryTimelineProps) {
  const [activeTrajectory, setActiveTrajectory] = useState<TrajectoryType>('llm_architecture');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [watchlistOnly, setWatchlistOnly] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Unique lists of providers for filtering
  const allProviders = Array.from(new Set(events.flatMap(e => e.providers)));

  // Filter & Sort events
  const timelineEvents = events
    .filter(event => {
      const matchesTrajectory = event.trajectories.includes(activeTrajectory);
      const matchesProvider = filterProvider === 'all' || event.providers.includes(filterProvider);
      const matchesType = filterType === 'all' || event.type === filterType;
      const matchesWatchlist = !watchlistOnly || event.watchlist;
      return matchesTrajectory && matchesProvider && matchesType && matchesWatchlist;
    })
    .sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  const activeTrajectoryDetail = TRAJECTORY_MAP[activeTrajectory];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
      {/* Sidebar Selector for Trajectories */}
      <div className="lg:col-span-1 space-y-6">
        <div className="space-y-2">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
            Tracks • 选择追踪轨迹
          </span>
          <div className="flex flex-col gap-1 bg-[#F2EDE4]/40 border border-[#e5dec9]/60 p-2 rounded-xl">
            {(Object.keys(TRAJECTORY_MAP) as TrajectoryType[]).map((trajKey) => {
              const mapped = TRAJECTORY_MAP[trajKey];
              const isActive = activeTrajectory === trajKey;
              const count = events.filter(e => e.trajectories.includes(trajKey)).length;

              return (
                <button
                  key={trajKey}
                  onClick={() => setActiveTrajectory(trajKey)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded text-left text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-black text-white shadow-sm font-bold'
                      : 'text-slate-755 hover:bg-slate-200/50'
                  }`}
                >
                  <span className="truncate flex items-center gap-2">
                    <Layers size={13} className={isActive ? 'text-white' : 'text-slate-400'} />
                    {mapped.label}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${isActive ? 'bg-zinc-800 text-white' : 'bg-[#e5dec9]/60 text-slate-700'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm text-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 font-bold text-slate-800 font-mono tracking-wider uppercase text-[10px]">
            <SlidersHorizontal size={12} className="text-slate-400" />
            <span>Axis Filter • 轴向过滤器</span>
          </div>

          {/* Provider */}
          <div className="space-y-1">
            <label className="block text-slate-400 font-bold font-mono uppercase text-[9px] tracking-wider">提供方 (Provider)</label>
            <select
              value={filterProvider}
              onChange={e => setFilterProvider(e.target.value)}
              className="w-full bg-[#F9F8F6] border border-slate-200 rounded p-1.5 focus:outline-none focus:border-black font-mono text-[11px]"
            >
              <option value="all">全部机构</option>
              {allProviders.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Event Type */}
          <div className="space-y-1">
            <label className="block text-slate-400 font-bold font-mono uppercase text-[9px] tracking-wider">事件分类 (Category)</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="w-full bg-[#F9F8F6] border border-slate-200 rounded p-1.5 focus:outline-none focus:border-black font-mono text-[11px]"
            >
              <option value="all">全部事件类型</option>
              {Object.entries(EVENT_TYPE_MAP).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div className="space-y-1">
            <label className="block text-slate-400 font-bold font-mono uppercase text-[9px] tracking-wider">时间顺序 (Chronological)</label>
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="w-full flex items-center justify-between bg-[#F9F8F6] hover:bg-[#F2EDE4]/60 border border-slate-200 rounded p-1.5 text-left text-slate-700 transition-all font-mono text-[11px]"
            >
              <span className="flex items-center gap-1.5">
                <Clock size={12} className="text-slate-400" />
                {sortOrder === 'desc' ? '最新排前' : '时间递增'}
              </span>
              {sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
            </button>
          </div>

          {/* Watchlist Toggle */}
          <label className="flex items-center gap-2 cursor-pointer pt-3 border-t border-slate-100 text-slate-600 font-medium">
            <input
              type="checkbox"
              checked={watchlistOnly}
              onChange={e => setWatchlistOnly(e.target.checked)}
              className="rounded border-slate-300 text-black focus:ring-black h-3.5 w-3.5"
            />
            <span className="text-[11px]">仅显示重点观察清单</span>
          </label>
        </div>
      </div>

      {/* Main Timeline Stream */}
      <div className="lg:col-span-3 space-y-6">
        {/* Trajectory Banner Info */}
        <div className="bg-[#F2EDE4]/40 border border-[#e5dec9]/70 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
            <h3 className="text-base font-bold text-slate-950 font-serif italic">{activeTrajectoryDetail?.label}</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-serif">
            {activeTrajectory === 'llm_architecture' && '深入追踪大语言模型的基础机制演变，从经典的 Transformer 稠密注意力，到线性复杂度的 Mamba 等状态空间模型，再到最新的强化学习与推理期思维链（CoT）革命。'}
            {activeTrajectory === 'multimodal_architecture' && '揭示图像、音频和视频等多模态生成的融合范式。见证自编码器、扩散网络、扩散 Transformer（DiT）到原生高维多模态理解与生成的跨时代整合。'}
            {activeTrajectory === 'provider_releases' && '汇聚行业超级极核厂商（如 OpenAI, Meta, DeepSeek, Google, NVIDIA, Anthropic 等）的旗舰级模型、平台与商业生态矩阵，梳理核心大厂的统治曲线。'}
            {activeTrajectory === 'commercial_forces' && '洞察算力开支、GPU 互联带宽、能量电源限制、以及国家主权 AI 投资如何直接重塑前沿技术研究的方向与企业落地的成本壁垒。'}
          </p>
        </div>

        {/* Timeline Entries */}
        {timelineEvents.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl bg-white">
            <h4 className="text-sm font-semibold text-slate-700">没有匹配的历史进展事件</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto font-serif italic">尝试放宽侧边栏过滤面板的条件，或在策展工作台中录入并批准关联此轨迹的最新事件。</p>
          </div>
        ) : (
          <div className="relative pl-6 border-l border-slate-200 space-y-8 py-3">
            {timelineEvents.map((event) => {
              const mappedType = EVENT_TYPE_MAP[event.type];

              return (
                <div key={event.id} className="relative group" id={`timeline-entry-${event.id}`}>
                  {/* Timeline Node Dot */}
                  <div className="absolute -left-[31px] top-1 w-4.5 h-4.5 rounded-full bg-white border-2 border-black flex items-center justify-center transition-all group-hover:bg-black">
                    <div className="w-1.5 h-1.5 rounded-full bg-black group-hover:bg-white" />
                  </div>

                  {/* Entry Header */}
                  <div className="flex flex-wrap items-center gap-2 mb-2 text-[10px] font-mono">
                    <span className="font-bold text-black bg-white px-2 py-0.5 border border-black rounded">
                      {event.date}
                    </span>
                    {mappedType && (
                      <span className={`px-2 py-0.5 uppercase font-bold border rounded ${mappedType.bg}`}>
                        {mappedType.label}
                      </span>
                    )}
                    <span className="text-slate-400">ID: {event.id}</span>
                  </div>

                  {/* Interactive Details Card Container */}
                  <div
                    onClick={() => onOpenDetails(event)}
                    className="p-5 bg-white border border-slate-200 rounded-xl hover:shadow-lg cursor-pointer transition-all duration-200"
                  >
                    <h4 className="font-bold text-slate-900 mb-1.5 leading-snug group-hover:text-blue-700 transition-colors font-serif text-base">
                      {event.title}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                      {event.summary}
                    </p>

                    <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-100 gap-2 text-[10px] font-mono text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users size={11} />
                        技术供应: {event.providers.join(', ') || '未知'}
                      </span>
                      <span className="text-black font-semibold hover:underline flex items-center gap-1 uppercase tracking-wider">
                        查看完整深度研判 →
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
