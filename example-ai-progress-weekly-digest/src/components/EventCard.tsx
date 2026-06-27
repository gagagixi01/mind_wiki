import React, { useEffect } from 'react';
import { Event, EventType, TrajectoryType, ConfidenceType } from '../types';
import { Layers, ExternalLink, Check, Eye, HelpCircle, X } from 'lucide-react';

interface EventCardProps {
  event: Event;
  onOpenDetails?: (event: Event) => void;
  key?: string;
}

// Map Event types to human-readable labels and modern editorial tags
export const EVENT_TYPE_MAP: Record<EventType, { label: string; bg: string; text: string }> = {
  paper: { label: '学术论文', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/60', text: 'text-emerald-700' },
  model_release: { label: '模型发布', bg: 'bg-blue-50 text-blue-800 border-blue-200/60', text: 'text-blue-700' },
  architecture: { label: '架构突破', bg: 'bg-purple-50 text-purple-800 border-purple-200/60', text: 'text-purple-700' },
  business: { label: '商业进展', bg: 'bg-amber-50 text-amber-800 border-amber-200/60', text: 'text-amber-700' },
  infra: { label: '算力基建', bg: 'bg-cyan-50 text-cyan-800 border-cyan-200/60', text: 'text-cyan-700' },
  benchmark: { label: '评测指标', bg: 'bg-rose-50 text-rose-800 border-rose-200/60', text: 'text-rose-700' },
  regulation: { label: '合规监管', bg: 'bg-slate-50 text-slate-800 border-slate-350/60', text: 'text-slate-700' },
  product: { label: '产品落地', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200/60', text: 'text-indigo-700' }
};

// Map Trajectories to human-readable labels
export const TRAJECTORY_MAP: Record<TrajectoryType, { label: string; bg: string; text: string }> = {
  llm_architecture: { label: 'LLM 架构演进', bg: 'bg-indigo-50 text-indigo-850', text: 'text-indigo-850' },
  multimodal_architecture: { label: '多模态与生成', bg: 'bg-violet-50 text-violet-850', text: 'text-violet-850' },
  provider_releases: { label: '厂商重大发布', bg: 'bg-pink-50 text-pink-850', text: 'text-pink-850' },
  commercial_forces: { label: '商业与基础设施', bg: 'bg-amber-50 text-amber-850', text: 'text-amber-850' }
};

// Map Confidence labels
export const CONFIDENCE_MAP: Record<ConfidenceType, { label: string; bg: string; icon: React.ReactNode }> = {
  observed: { label: '已观测 (Observed)', bg: 'bg-green-50 text-green-700 border-green-200', icon: <Check size={11} className="mr-1" /> },
  likely: { label: '高概率 (Likely)', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Eye size={11} className="mr-1" /> },
  speculative: { label: '前沿探究 (Speculative)', bg: 'bg-purple-50 text-purple-700 border-purple-200', icon: <HelpCircle size={11} className="mr-1" /> }
};

export default function EventCard({ event, onOpenDetails }: EventCardProps) {
  const typeStyle = EVENT_TYPE_MAP[event.type] || { label: event.type, bg: 'bg-slate-100 text-slate-700 border-slate-200', text: 'text-slate-700' };

  return (
    <div
      id={`event-card-${event.id}`}
      onClick={() => onOpenDetails?.(event)}
      className="group p-5 bg-white border border-slate-200 rounded-xl hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between"
    >
      {/* Top Meta Row */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-1.5">
          <span className={`text-[9px] ${typeStyle.bg} border px-2 py-0.5 rounded uppercase font-bold tracking-wider`}>
            {typeStyle.label}
          </span>
          <span className="text-[9px] bg-[#F9F8F6] text-slate-500 border border-slate-200 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
            {event.confidence.toUpperCase()}
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-450 uppercase font-bold">{event.date}</span>
      </div>

      {/* Title */}
      <h4 className="font-bold mb-1.5 text-base text-slate-900 group-hover:text-black transition-colors leading-snug font-serif">
        {event.title}
      </h4>

      {/* Summary Fragment */}
      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4 font-sans">
        {event.summary}
      </p>

      {/* Bottom Footer Section */}
      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400 font-mono">
        <span className="truncate max-w-[70%]">
          轨迹: <b className="text-slate-600 font-semibold">{event.trajectories.map(t => TRAJECTORY_MAP[t]?.label || t).join(', ')}</b>
        </span>
        <span className="italic shrink-0 font-semibold text-slate-500 hover:underline">
          {event.sources?.length || 0} Cite(s)
        </span>
      </div>
    </div>
  );
}

// Detailed Slide-out Sheet/Drawer Component
interface EventDetailSheetProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  allEvents?: Event[];
}

export function EventDetailSheet({ event, isOpen, onClose, allEvents = [] }: EventDetailSheetProps) {
  // Handle keyboard Escape close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!event) return null;

  const typeStyle = EVENT_TYPE_MAP[event.type] || { label: event.type, bg: 'bg-slate-100 text-slate-700 border-slate-200', text: 'text-slate-700' };
  const confidenceStyle = CONFIDENCE_MAP[event.confidence] || { label: event.confidence, bg: 'bg-slate-50', icon: null };

  return (
    <>
      {/* Backdrop */}
      <div
        id="sheet-backdrop"
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Drawer Panel */}
      <div
        id={`event-detail-drawer-${event.id}`}
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-[#F9F8F6] text-[#121212] shadow-2xl border-l border-slate-200 flex flex-col transition-transform duration-300 ease-out h-full ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-[#F2EDE4]/30">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200 uppercase tracking-wide">
              ID: {event.id}
            </span>
            {event.watchlist && (
              <span className="px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider bg-rose-50 text-rose-700 border border-rose-200 rounded">
                重点观察
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-[#F2EDE4]/60 transition-colors cursor-pointer"
            title="关闭窗口 (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-[#F2EDE4]/30 border border-[#e5dec9]/60 rounded-xl text-xs font-mono text-slate-600">
            <div>
              <span className="block text-slate-450 text-[9px] uppercase font-bold tracking-wider mb-1">事件分类</span>
              <span className={`inline-block px-2.5 py-0.5 font-bold rounded border text-[10px] uppercase tracking-wider ${typeStyle.bg}`}>
                {typeStyle.label}
              </span>
            </div>
            <div>
              <span className="block text-slate-455 text-[9px] uppercase font-bold tracking-wider mb-1">发布日期</span>
              <span className="text-slate-800 font-bold">{event.date}</span>
            </div>
            <div>
              <span className="block text-slate-455 text-[9px] uppercase font-bold tracking-wider mb-1">研判置信度</span>
              <span className={`inline-flex items-center px-2 py-0.5 font-bold rounded border text-[10px] uppercase tracking-wider ${confidenceStyle.bg}`}>
                {confidenceStyle.label.split(' ')[0]}
              </span>
            </div>
            <div>
              <span className="block text-slate-455 text-[9px] uppercase font-bold tracking-wider mb-1">技术提供方</span>
              <span className="text-slate-800 font-bold">{event.providers?.join(', ') || '未知'}</span>
            </div>
          </div>

          {/* Title */}
          <div>
            <h2 className="text-2xl md:text-3xl font-serif font-extrabold text-slate-950 leading-tight italic">
              {event.title}
            </h2>
          </div>

          {/* Long Summary */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">进展核心摘要 (Core Summary)</h4>
            <div className="text-sm text-slate-700 leading-relaxed bg-white border border-slate-100 p-5 rounded-xl shadow-sm space-y-3 font-serif">
              {event.summary.split('\n').map((para, idx) => (
                <p key={idx}>{para}</p>
              ))}
            </div>
          </div>

          {/* Why It Matters Callout Block in pitch black */}
          <div className="p-6 bg-black text-white rounded-xl relative overflow-hidden shadow-md space-y-2">
            <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest font-mono">
              ★ WHY IT MATTERS • 为什么关键
            </h4>
            <p className="text-sm leading-relaxed font-serif italic text-slate-100">
              {event.why_it_matters}
            </p>
            <div className="absolute -right-4 -bottom-6 opacity-10 text-8xl font-serif pointer-events-none select-none">★</div>
          </div>

          {/* Trajectories */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">关联的技术与商业轨迹</h4>
            <div className="flex flex-wrap gap-1.5">
              {event.trajectories.map((traj) => {
                const mapped = TRAJECTORY_MAP[traj];
                return mapped ? (
                  <span
                    key={traj}
                    className="inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-white text-slate-700 border border-slate-200 rounded"
                  >
                    <Layers size={11} className="mr-1.5 opacity-60 text-black" />
                    {mapped.label}
                  </span>
                ) : null;
              })}
            </div>
          </div>

          {/* Related Causal Links */}
          {event.causal_links && event.causal_links.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">触发的趋势联动 / 因果链条</h4>
              <div className="space-y-2 text-xs bg-white border border-slate-200 rounded-xl p-4">
                <span className="block font-bold text-slate-550 mb-1 font-mono text-[9px] uppercase tracking-wider">关联的因果网络标识：</span>
                <div className="space-y-1.5">
                  {event.causal_links.map((linkId) => (
                    <div key={linkId} className="flex items-center gap-2 text-slate-700 font-mono">
                      <span className="px-1.5 py-0.5 font-bold bg-[#F9F8F6] text-black rounded border border-slate-250">
                        {linkId}
                      </span>
                      <span className="text-slate-500 text-[11px]">关系已注册在因果链谱中</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Primary Evidence Sources */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
              证明证据与信源 (Evidence Sources)
            </h4>
            <div className="space-y-2">
              {event.sources?.map((src, i) => (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-lg hover:border-slate-350 hover:bg-slate-50/50 transition-all text-xs"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    {src.category && (
                      <span className="px-1.5 py-0.2 text-[9px] uppercase font-bold bg-[#F9F8F6] text-slate-500 border border-slate-200 rounded font-mono">
                        {src.category}
                      </span>
                    )}
                    <span className="font-bold text-slate-900 truncate font-serif">{src.title}</span>
                  </div>
                  <span className="flex items-center text-black font-mono font-bold text-[10px] uppercase tracking-wider shrink-0">
                    Cite
                    <ExternalLink size={10} className="ml-1" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-[#F2EDE4]/20 text-center text-[10px] text-slate-400 font-mono uppercase tracking-widest">
          AI Progress Research Cockpit v1.0
        </div>
      </div>
    </>
  );
}
