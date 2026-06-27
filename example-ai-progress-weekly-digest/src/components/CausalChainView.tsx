import React, { useState } from 'react';
import { CausalLink, RelationshipType, ConfidenceType } from '../types';
import { ArrowRight, Link, ShieldAlert, Sparkles, Plus, Trash, ExternalLink } from 'lucide-react';
import { CONFIDENCE_MAP } from './EventCard';

interface CausalChainViewProps {
  causalLinks: CausalLink[];
  onAddCausalLink?: (newLink: CausalLink) => void;
  onDeleteCausalLink?: (id: string) => void;
  isCurationMode?: boolean;
}

export const RELATIONSHIP_MAP: Record<RelationshipType, { label: string; bg: string; border: string; text: string; desc: string }> = {
  enables: { label: '赋能 (Enables)', bg: 'bg-emerald-50 text-emerald-800', border: 'border-emerald-200/60', text: 'text-emerald-700', desc: '源事件提供了关键的底层技术或条件，使得目标进展成为可能' },
  constrains: { label: '约束 (Constrains)', bg: 'bg-rose-50 text-rose-800', border: 'border-rose-200/60', text: 'text-rose-700', desc: '源事件施加了瓶颈、物理或合规层面的阻碍，限制了目标进展' },
  accelerates: { label: '加速 (Accelerates)', bg: 'bg-blue-50 text-blue-800', border: 'border-blue-200/60', text: 'text-blue-700', desc: '源事件显著推进了目标技术、商业路线的研究速度与渗透速度' },
  competes: { label: '竞争 (Competes)', bg: 'bg-amber-50 text-amber-800', border: 'border-amber-200/60', text: 'text-amber-700', desc: '源进展构成了平行替代选项，压缩、平替或挑战了目标技术的垄断定价' },
  drives: { label: '驱动 (Drives)', bg: 'bg-purple-50 text-purple-800', border: 'border-purple-200/60', text: 'text-purple-700', desc: '源事件作为核心推动力或需求，迫使目标技术路线发生战略转移' },
  mitigates: { label: '缓解 (Mitigates)', bg: 'bg-cyan-50 text-cyan-800', border: 'border-cyan-200/60', text: 'text-cyan-700', desc: '源事件提供了保护、优化或对冲方案，降低了目标进展带来的物理/安全负面风险' }
};

export default function CausalChainView({ causalLinks, onAddCausalLink, onDeleteCausalLink, isCurationMode = false }: CausalChainViewProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterConfidence, setFilterConfidence] = useState<string>('all');

  // Interactive local registration state
  const [showAddForm, setShowAddForm] = useState(false);
  const [sourceTitle, setSourceTitle] = useState('');
  const [targetTitle, setTargetTitle] = useState('');
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('enables');
  const [explanation, setExplanation] = useState('');
  const [confidence, setConfidence] = useState<ConfidenceType>('observed');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceName, setSourceName] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceTitle || !targetTitle || !explanation) {
      alert('请完整填写源节点、目标节点和作用机理！');
      return;
    }

    const newLink: CausalLink = {
      id: `cl-custom-${Date.now()}`,
      sourceId: `ev-${Date.now()}-src`,
      sourceTitle,
      targetId: `ev-${Date.now()}-tgt`,
      targetTitle,
      relationshipType,
      explanation,
      confidence,
      sources: sourceUrl ? [{ title: sourceName || '证据信源', url: sourceUrl }] : []
    };

    onAddCausalLink?.(newLink);

    // Reset Form
    setSourceTitle('');
    setTargetTitle('');
    setExplanation('');
    setSourceUrl('');
    setSourceName('');
    setShowAddForm(false);
  };

  const filteredLinks = causalLinks.filter(link => {
    const matchesType = filterType === 'all' || link.relationshipType === filterType;
    const matchesConfidence = filterConfidence === 'all' || link.confidence === filterConfidence;
    return matchesType && matchesConfidence;
  });

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#F2EDE4]/40 border border-[#e5dec9]/70 p-6 rounded-xl">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-950 flex items-center gap-2 font-serif italic">
            <Sparkles size={16} className="text-black" />
            AI 行业因果逻辑链谱 • Causal Chains
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl font-serif">
            拒绝零散的信息堆砌。我们通过严谨的推演关系，展示商业约束如何向技术变革传导、开源势力如何对冲闭源垄断。
          </p>
        </div>
        {isCurationMode && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-black hover:bg-zinc-800 text-white font-semibold text-xs rounded transition-colors cursor-pointer"
          >
            <Plus size={13} />
            {showAddForm ? '取消注册' : '注册新因果链'}
          </button>
        )}
      </div>

      {/* Add Form (Interactive Curation Component) */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="bg-white border border-slate-300 rounded-xl p-5 space-y-4 shadow-sm">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest font-mono">新增因果联动定义 / Registered Link</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">源节点事件/概念名称 *</label>
              <input
                type="text"
                value={sourceTitle}
                onChange={e => setSourceTitle(e.target.value)}
                placeholder="例如：NVIDIA Blackwell 供给延迟"
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-black"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">目标节点事件/概念名称 *</label>
              <input
                type="text"
                value={targetTitle}
                onChange={e => setTargetTitle(e.target.value)}
                placeholder="例如：多模态 MoE 架构推理吞吐"
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-black"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">因果传导关系类型 *</label>
              <select
                value={relationshipType}
                onChange={e => setRelationshipType(e.target.value as RelationshipType)}
                className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-200 rounded focus:outline-none"
              >
                {Object.entries(RELATIONSHIP_MAP).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">关联置信度 *</label>
              <select
                value={confidence}
                onChange={e => setConfidence(e.target.value as ConfidenceType)}
                className="w-full text-xs px-2 py-2 bg-slate-50 border border-slate-200 rounded focus:outline-none"
              >
                <option value="observed">已观测 (Observed) - 具有硬性证据支撑</option>
                <option value="likely">高概率 (Likely) - 业界公认的技术因果趋势</option>
                <option value="speculative">前沿推测 (Speculative) - 具有启发式的战略论述</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">证明证据链接 (可选)</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">传导机理解释 (Mechanism Explanation) *</label>
              <textarea
                value={explanation}
                onChange={e => setExplanation(e.target.value)}
                rows={3}
                placeholder="请深度剖析源事件是如何触发并传导到目标节点的。逻辑严密，不少于15字。"
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={sourceName}
              onChange={e => setSourceName(e.target.value)}
              placeholder="证据信源名称（可选）"
              className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded focus:outline-none"
            />
            <button
              type="submit"
              className="ml-auto px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded transition-colors cursor-pointer"
            >
              完成注册并合流
            </button>
          </div>
        </form>
      )}

      {/* Grid Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 border border-slate-200 rounded-xl text-xs">
        <span className="font-bold text-slate-400 font-mono text-[10px] uppercase tracking-wider">
          Filter Network • 因果网络筛选:
        </span>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded text-xs font-semibold border transition-all ${filterType === 'all' ? 'bg-black text-white border-black' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
          >
            全部传导
          </button>
          {Object.entries(RELATIONSHIP_MAP).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className={`px-3 py-1 rounded text-xs font-semibold border transition-all ${filterType === key ? 'bg-black text-white border-black' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
            >
              {val.label.split(' ')[1]}
            </button>
          ))}
        </div>

        <div className="md:ml-auto flex items-center gap-1.5 font-mono text-[11px]">
          <span className="text-slate-400 uppercase tracking-wider">置信度:</span>
          <select
            value={filterConfidence}
            onChange={e => setFilterConfidence(e.target.value)}
            className="bg-[#F9F8F6] border border-slate-200 rounded px-2 py-1 text-slate-700 font-mono text-xs focus:outline-none"
          >
            <option value="all">全部</option>
            <option value="observed">已观测 (Observed)</option>
            <option value="likely">高概率 (Likely)</option>
            <option value="speculative">前沿探究 (Speculative)</option>
          </select>
        </div>
      </div>

      {/* Cards List */}
      <div className="grid grid-cols-1 gap-6">
        {filteredLinks.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-white">
            <p className="text-xs text-slate-400 font-medium font-serif italic">无符合筛选条件的因果联动记录</p>
          </div>
        ) : (
          filteredLinks.map((link) => {
            const rel = RELATIONSHIP_MAP[link.relationshipType] || { label: link.relationshipType, bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-slate-700', desc: '' };
            const conf = CONFIDENCE_MAP[link.confidence] || { label: link.confidence, bg: 'bg-slate-50', icon: null };

            return (
              <div
                key={link.id}
                id={`causal-link-card-${link.id}`}
                className="group relative bg-white border border-slate-200 rounded-2xl p-6 transition-all duration-200 hover:shadow-md"
              >
                {/* Delete button (only in private curation mode) */}
                {isCurationMode && onDeleteCausalLink && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('确认删除此条因果链联动关系吗？')) {
                        onDeleteCausalLink(link.id);
                      }
                    }}
                    className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-50 transition-colors"
                    title="删除此因果链"
                  >
                    <Trash size={14} />
                  </button>
                )}

                {/* Top Badge bar */}
                <div className="flex flex-wrap items-center gap-3 mb-4 text-[10px] font-mono">
                  <span className={`px-2 py-0.5 font-bold uppercase rounded border ${rel.bg} ${rel.border}`}>
                    {rel.label}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 uppercase font-bold border rounded ${conf.bg}`}>
                    {conf.label}
                  </span>
                  <span className="text-slate-400">ID: {link.id}</span>
                </div>

                {/* Flow Diagram Line */}
                <div className="grid grid-cols-1 md:grid-cols-9 items-center gap-3 bg-[#F9F8F6] p-4 rounded-xl border border-slate-200/60 mb-4">
                  {/* Source Node */}
                  <div className="md:col-span-4 bg-white border border-slate-200 p-3 rounded text-xs font-bold text-slate-900 text-center truncate">
                    {link.sourceTitle}
                  </div>

                  {/* Flow Arrow */}
                  <div className="md:col-span-1 flex justify-center text-slate-400">
                    <ArrowRight size={18} className="transform rotate-90 md:rotate-0" />
                  </div>

                  {/* Target Node */}
                  <div className="md:col-span-4 bg-black border border-black p-3 rounded text-xs font-bold text-white text-center truncate">
                    {link.targetTitle}
                  </div>
                </div>

                {/* Mechanistic Explanation */}
                <div className="space-y-1.5 text-sm mb-4">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">机理机制剖析 (Mechanism)</span>
                  <p className="text-slate-700 leading-relaxed bg-white border border-slate-100 p-4 rounded font-serif text-sm">
                    {link.explanation}
                  </p>
                </div>

                {/* Validating Evidence */}
                {link.sources.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-slate-100 text-[10px]">
                    <span className="text-slate-400 font-mono">论证来源（Evidence Sources）：</span>
                    <div className="flex flex-wrap gap-2">
                      {link.sources.map((src, i) => (
                        <a
                           key={i}
                           href={src.url}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-slate-600 hover:text-blue-600 hover:border-slate-300 transition-all font-mono"
                        >
                           <Link size={10} className="opacity-75" />
                           <span>{src.title}</span>
                           <ExternalLink size={9} className="opacity-50" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
