import React, { useState } from 'react';
import { Event } from '../types';
import { Users, LayoutGrid, Calendar } from 'lucide-react';

interface ProvidersViewProps {
  events: Event[];
  onOpenDetails: (event: Event) => void;
}

export default function ProvidersView({ events, onOpenDetails }: ProvidersViewProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>('all');

  // List of standard main providers we want to group by
  const standardProviders = ['OpenAI', 'DeepSeek', 'Google', 'NVIDIA', 'Anthropic', 'Meta'];

  // Categorize events by provider
  const getEventsForProvider = (provider: string) => {
    return events.filter(e => {
      if (provider === 'Other') {
        // Events that do not have any of the standard providers
        return !e.providers.some(p => standardProviders.includes(p));
      }
      return e.providers.includes(provider);
    });
  };

  const filteredProviders = selectedProvider === 'all'
    ? [...standardProviders, 'Other']
    : [selectedProvider];

  return (
    <div className="space-y-6">
      {/* Selector pills */}
      <div className="flex flex-wrap items-center gap-2 bg-[#F2EDE4]/40 border border-[#e5dec9]/60 p-4 rounded-xl text-xs font-semibold">
        <span className="text-slate-400 font-mono uppercase text-[10px] tracking-wider">Filter Providers • 过滤机构:</span>
        <button
          onClick={() => setSelectedProvider('all')}
          className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
            selectedProvider === 'all'
              ? 'bg-black text-white border-black'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          查看全部
        </button>
        {standardProviders.map(p => {
          const count = getEventsForProvider(p).length;
          return (
            <button
              key={p}
              onClick={() => setSelectedProvider(p)}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
                selectedProvider === p
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {p} ({count})
            </button>
          );
        })}
        <button
          onClick={() => setSelectedProvider('Other')}
          className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
            selectedProvider === 'Other'
              ? 'bg-black text-white border-black'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          其他机构 ({getEventsForProvider('Other').length})
        </button>
      </div>

      {/* Grid of Providers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredProviders.map(provider => {
          const providerEvents = getEventsForProvider(provider);
          if (providerEvents.length === 0 && selectedProvider !== 'all') {
            return (
              <div key={provider} className="md:col-span-2 text-center py-12 border border-dashed border-slate-200 rounded-xl bg-white">
                <Users size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500 font-serif italic">暂无属于 {provider} 的已批准进展</p>
              </div>
            );
          }
          if (providerEvents.length === 0) return null;

          return (
            <div key={provider} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-950 flex items-center gap-2 font-serif italic text-base">
                  <LayoutGrid size={14} className="text-slate-400" />
                  {provider === 'Other' ? '其他科研与开源机构' : `${provider} 进展轨迹`}
                </h3>
                <span className="font-mono text-[10px] text-slate-500 font-bold bg-[#F9F8F6] px-2 py-0.5 border border-slate-200 rounded">
                  {providerEvents.length} 事件已核准
                </span>
              </div>

              <div className="space-y-3">
                {providerEvents.map(event => (
                  <div
                    key={event.id}
                    onClick={() => onOpenDetails(event)}
                    className="p-3.5 bg-[#F9F8F6] hover:bg-white border border-slate-100 hover:border-slate-300 hover:shadow-sm rounded-lg cursor-pointer transition-all flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {event.date}
                      </span>
                      <span className="px-1.5 py-0.2 uppercase font-bold bg-white border border-slate-200 text-slate-500 rounded">
                        {event.type}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1 leading-snug group-hover:text-blue-600 font-serif">
                      {event.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed">
                      {event.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
