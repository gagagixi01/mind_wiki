import React from 'react';
import { Event } from '../types';
import { ExternalLink, AlertTriangle } from 'lucide-react';

interface SourcesViewProps {
  events: Event[];
  onOpenDetails: (event: Event) => void;
}

export default function SourcesView({ events, onOpenDetails }: SourcesViewProps) {
  // Collate all source objects from all events
  const collation = events.map(event => {
    return {
      eventId: event.id,
      eventTitle: event.title,
      sources: event.sources || []
    };
  });

  // Find events with missing/empty sources to flag audit requirements
  const anomalousEvents = events.filter(e => !e.sources || e.sources.length === 0);

  return (
    <div className="space-y-6">
      {/* Overview stats banner */}
      <div className="bg-[#F2EDE4]/40 border border-[#e5dec9]/60 p-6 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-1">
          <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Verified Citations • 已核文献总数</span>
          <span className="block text-2xl font-bold font-mono text-slate-900">
            {events.reduce((acc, ev) => acc + (ev.sources?.length || 0), 0)}
          </span>
        </div>
        <div className="space-y-1">
          <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Completeness Score • 完整性得分</span>
          <span className="block text-2xl font-bold font-mono text-emerald-700">
            {anomalousEvents.length === 0 ? '100% (Green)' : `${Math.floor(((events.length - anomalousEvents.length) / events.length) * 100)}%`}
          </span>
        </div>
        <div className="space-y-1">
          <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Pending Citations • 待审计事件数</span>
          <span className={`block text-2xl font-bold font-mono ${anomalousEvents.length > 0 ? 'text-amber-700 animate-pulse' : 'text-slate-400'}`}>
            {anomalousEvents.length}
          </span>
        </div>
      </div>

      {/* Warning list for missing sources */}
      {anomalousEvents.length > 0 && (
        <div className="bg-amber-50/75 border border-amber-200/80 rounded-xl p-5 space-y-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 font-mono text-[10px] uppercase tracking-wider">
            <AlertTriangle size={14} className="text-amber-700" />
            <span>Audit Alert • 存在未绑定公开发表信源的进展项目</span>
          </div>
          <p className="text-amber-800 leading-relaxed font-serif">
            以下核准进展暂未绑定官方文献或论文链接。请前往策展工作台录入或对齐：
          </p>
          <div className="flex flex-wrap gap-2">
            {anomalousEvents.map(e => (
              <div
                key={e.id}
                onClick={() => onOpenDetails(e)}
                className="inline-flex items-center gap-1.5 text-black hover:underline cursor-pointer font-semibold bg-white px-3 py-1.5 rounded border border-amber-200"
              >
                <span className="font-serif">{e.title}</span>
                <span className="text-[9px] font-mono opacity-60">({e.id})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main sources checklist table */}
      <div className="space-y-4">
        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
          Verified Bibliography • 已校验公开信源归档表
        </span>
        
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-1 divide-y divide-slate-100">
            {collation.map((col) => {
              if (col.sources.length === 0) return null;

              return (
                <div key={col.eventId} className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-6 hover:bg-slate-50/40">
                  {/* Event Reference */}
                  <div className="md:w-1/3 space-y-1">
                    <span className="inline-block px-2 py-0.5 bg-[#F9F8F6] text-slate-500 font-mono text-[9px] rounded border border-slate-200 uppercase font-bold tracking-wide">
                      ID: {col.eventId}
                    </span>
                    <h4
                      onClick={() => {
                        const ev = events.find(e => e.id === col.eventId);
                        if (ev) onOpenDetails(ev);
                      }}
                      className="text-xs font-bold text-slate-900 hover:text-blue-700 hover:underline cursor-pointer font-serif"
                    >
                      {col.eventTitle}
                    </h4>
                  </div>

                  {/* Sources mapped */}
                  <div className="md:w-2/3 space-y-2">
                    {col.sources.map((src, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3.5 bg-[#F9F8F6] border border-slate-200/60 rounded hover:border-slate-300 transition-all text-xs"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="px-1.5 py-0.2 uppercase text-[9px] font-bold tracking-wider font-mono bg-white text-slate-600 border border-slate-200 rounded">
                            {src.category || 'Cite'}
                          </span>
                          <span className="font-semibold text-slate-800 truncate font-serif">{src.title}</span>
                        </div>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-black font-mono hover:underline font-bold text-[10px] ml-4 shrink-0 uppercase tracking-wider"
                        >
                          <span>Link</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
