import React, { useState } from 'react';
import { Event, WeeklyBrief } from '../types';
import EventCard from './EventCard';
import { Calendar, Quote, Sparkles, TrendingUp, Compass, Clock, Archive } from 'lucide-react';

interface WeeklyDigestViewProps {
  weeklyBriefs: WeeklyBrief[];
  allEvents: Event[];
  onOpenDetails: (event: Event) => void;
}

export default function WeeklyDigestView({ weeklyBriefs, allEvents, onOpenDetails }: WeeklyDigestViewProps) {
  const [selectedBriefId, setSelectedBriefId] = useState<string>(
    weeklyBriefs.length > 0 ? weeklyBriefs[0].id : ''
  );

  const activeBrief = weeklyBriefs.find(b => b.id === selectedBriefId) || weeklyBriefs[0];

  if (!activeBrief) {
    return (
      <div className="text-center py-16 bg-[#F9F8F6] border border-dashed border-slate-200 rounded-2xl">
        <Compass size={40} className="mx-auto text-slate-300 mb-3" />
        <h3 className="text-sm font-semibold text-slate-700">暂无任何周报发布</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">请切换到本地工作台，人工合并批准一些事件并装配首份周报。</p>
      </div>
    );
  }

  // Find Headline events belonging to this brief
  const headlineEvents = allEvents.filter(e => activeBrief.headlineEventIds.includes(e.id));
  
  // Find Watchlist events belonging to this brief
  const watchlistEvents = allEvents.filter(e => activeBrief.watchlistEventIds.includes(e.id));

  return (
    <div className="space-y-8">
      {/* Archive Selector Block if more than 1 week */}
      {weeklyBriefs.length > 1 && (
        <div className="flex items-center justify-between gap-4 bg-[#F2EDE4]/60 border border-[#e5dec9]/60 px-4 py-2.5 rounded-lg text-xs">
          <span className="font-semibold text-slate-600 flex items-center gap-1.5 font-mono">
            <Archive size={13} className="text-slate-500" />
            查看往期归档 (Digest Archives):
          </span>
          <select
            value={selectedBriefId}
            onChange={e => setSelectedBriefId(e.target.value)}
            className="bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-700 font-mono text-[11px] focus:outline-none"
          >
            {weeklyBriefs.map(brief => (
              <option key={brief.id} value={brief.id}>
                第 {brief.id.split('-').pop()} 期 ({brief.weekStart} 至 {brief.weekEnd})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main Grid Layout matching the Editorial Split-view */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start divide-y lg:divide-y-0 lg:divide-x lg:divide-slate-200/80">
        
        {/* LEFT COLUMN: Editorial / Weekly Thesis (col-span-5) */}
        <section className="lg:col-span-5 flex flex-col pr-0 lg:pr-8 space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] font-mono px-2 py-0.5 border border-black rounded uppercase inline-block">
              W{activeBrief.id.split('-').pop() || 'Digest'} — 2026
            </span>
            <div className="text-[10px] uppercase font-bold tracking-widest text-orange-600 font-mono">
              Weekly Thesis • 本周研判主线
            </div>
          </div>

          <h3 className="text-3xl md:text-4xl font-serif font-extrabold leading-[1.15] text-[#121212] italic">
            {activeBrief.id === 'week-1' ? '推理扩展定律：从预训练到推理侧的范式转移' : 'AI 进展研究周报：技术变局与因果逻辑'}
          </h3>

          <p className="text-sm leading-relaxed text-slate-600 font-serif whitespace-pre-line">
            {activeBrief.weeklyThesis}
          </p>

          {/* Editorial Synthesis Quote Card in deep pitch black */}
          <div className="p-6 bg-black text-white rounded-2xl relative overflow-hidden shadow-md mt-6 space-y-2">
            <div className="text-[10px] uppercase opacity-50 tracking-wider font-mono">Closing Synthesis • 结语前瞻</div>
            <p className="text-base leading-relaxed font-serif italic text-slate-100">
              “{activeBrief.closingSynthesis}”
            </p>
            <div className="absolute -right-4 -bottom-6 opacity-10 text-9xl font-serif pointer-events-none select-none">“</div>
          </div>
        </section>

        {/* RIGHT COLUMN: Major Events & Tracks (col-span-7) */}
        <section className="lg:col-span-7 pt-8 lg:pt-0 pl-0 lg:pl-8 flex flex-col gap-6">
          
          {/* Headline events section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono flex items-center gap-1">
                <TrendingUp size={12} />
                Headline Focus • 主线焦点
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {headlineEvents.length} 个重大进展
              </span>
            </div>

            {headlineEvents.length === 0 ? (
              <p className="text-slate-400 text-xs italic text-center py-8 bg-white border border-dashed border-slate-200 rounded-xl">
                本期无主线焦点事件数据
              </p>
            ) : (
              <div className="space-y-4">
                {headlineEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onOpenDetails={onOpenDetails}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Watchlist events section */}
          {watchlistEvents.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <span className="text-[10px] uppercase font-bold tracking-widest text-rose-500 font-mono flex items-center gap-1">
                  <Clock size={12} />
                  Emerging Watchlist • 长线趋势技术看点
                </span>
                <span className="text-[10px] text-rose-400 font-mono">
                  重点技术追踪
                </span>
              </div>

              <div className="space-y-4">
                {watchlistEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onOpenDetails={onOpenDetails}
                  />
                ))}
              </div>
            </div>
          )}

        </section>
      </div>
    </div>
  );
}
