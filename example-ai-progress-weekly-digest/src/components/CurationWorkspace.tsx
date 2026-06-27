import React, { useState } from 'react';
import { Event, WeeklyBrief, CurationSource, EventType, TrajectoryType, ConfidenceType, QualityReport, Source } from '../types';
import { Play, Loader2, Sparkles, AlertCircle, CheckCircle2, Save, Trash, Plus, FileCheck, Send, BookOpen } from 'lucide-react';
import { EVENT_TYPE_MAP, TRAJECTORY_MAP } from './EventCard';

interface CurationWorkspaceProps {
  approvedEvents: Event[];
  onApproveEvent: (event: Event) => void;
  onPublishWeeklyBrief: (brief: WeeklyBrief) => void;
  activeWeeklyBriefs: WeeklyBrief[];
}

export default function CurationWorkspace({
  approvedEvents,
  onApproveEvent,
  onPublishWeeklyBrief,
  activeWeeklyBriefs
}: CurationWorkspaceProps) {
  // Ingestion Inbound States
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [extractor, setExtractor] = useState<'Crawl4AI' | 'Trafilatura'>('Crawl4AI');
  
  // Extraction states
  const [isExtracting, setIsExtracting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentLogsToShow, setCurrentLogsToShow] = useState<string[]>([]);
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [draft, setDraft] = useState<Partial<Event> | null>(null);

  // List of previously curated sources in session
  const [curatedSources, setCuratedSources] = useState<CurationSource[]>([
    {
      id: 'src-1',
      url: 'https://arxiv.org/abs/2412.01234',
      title: 'Mamba-2: Linear-Time Sequence Modeling',
      type: 'arxiv',
      createdAt: '2026-06-23',
      extractionStatus: 'approved',
    },
    {
      id: 'src-2',
      url: 'https://openai.com/sora',
      title: 'Sora: World Simulators as Video Generative Models',
      type: 'blog',
      createdAt: '2026-06-22',
      extractionStatus: 'approved'
    }
  ]);

  // Draft editing states (when a draft is loaded for editing)
  const [editedTitle, setEditedTitle] = useState('');
  const [editedType, setEditedType] = useState<EventType>('model_release');
  const [editedSummary, setEditedSummary] = useState('');
  const [editedWhyItMatters, setEditedWhyItMatters] = useState('');
  const [editedConfidence, setEditedConfidence] = useState<ConfidenceType>('observed');
  const [editedTrajectories, setEditedTrajectories] = useState<TrajectoryType[]>([]);
  const [editedProviders, setEditedProviders] = useState<string[]>([]);
  const [editedSources, setEditedSources] = useState<Source[]>([]);

  // Weekly Brief Builder States
  const [weekStart, setWeekStart] = useState('2026-06-22');
  const [weekEnd, setWeekEnd] = useState('2026-06-28');
  const [weeklyThesis, setWeeklyThesis] = useState('本周 AI 领域见证了底层序列机制的实用化整合与强化学习架构向推理端的彻底下沉。');
  const [selectedHeadlineIds, setSelectedHeadlineIds] = useState<string[]>([]);
  const [selectedWatchlistIds, setSelectedWatchlistIds] = useState<string[]>([]);
  const [closingSynthesis, setClosingSynthesis] = useState('展望未来，随着推理侧平均能耗下降，智能体不仅能在复杂的沙盒中独立运作，更能带来全新的企业协同效率革命。');

  // Triggering the server-side extraction
  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsExtracting(true);
    setQualityReport(null);
    setDraft(null);
    setLogs([]);
    setCurrentLogsToShow([]);

    try {
      const response = await fetch('/api/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, notes, extractor }),
      });

      const data = await response.json();

      if (data.success) {
        setLogs(data.extractionLog);
        
        // Progressively stream the logs to the terminal UI for high-fidelity interactive experience!
        let currentIdx = 0;
        const interval = setInterval(() => {
          if (currentIdx < data.extractionLog.length) {
            setCurrentLogsToShow(prev => [...prev, data.extractionLog[currentIdx]]);
            currentIdx++;
          } else {
            clearInterval(interval);
            setIsExtracting(false);
            setQualityReport(data.qualityReport);
            setDraft(data.draft);

            // Pre-fill editor states
            setEditedTitle(data.draft.title || '');
            setEditedType(data.draft.type || 'model_release');
            setEditedSummary(data.draft.summary || '');
            setEditedWhyItMatters(data.draft.why_it_matters || '');
            setEditedConfidence(data.draft.confidence || 'observed');
            setEditedTrajectories(data.draft.trajectories || []);
            setEditedProviders(data.draft.providers || []);
            setEditedSources(data.draft.sources || []);

            // Add to session source logs
            const newCurItem: CurationSource = {
              id: `src-${Date.now()}`,
              url,
              title: data.draft.title,
              type: url.includes('arxiv') ? 'arxiv' : 'blog',
              createdAt: new Date().toISOString().split('T')[0],
              extractionStatus: data.mode === 'simulated' ? 'fallback_success' : 'success'
            };
            setCuratedSources(prev => [newCurItem, ...prev]);
          }
        }, 600);

      } else {
        throw new Error(data.error || 'Extraction failed');
      }

    } catch (err: any) {
      console.error(err);
      setIsExtracting(false);
      setCurrentLogsToShow(prev => [...prev, `[ERROR] 抓取进程异常：${err.message || '网络连接被重置或超时'}`]);
      
      const failedCurItem: CurationSource = {
        id: `src-${Date.now()}`,
        url,
        type: 'other',
        createdAt: new Date().toISOString().split('T')[0],
        extractionStatus: 'failed'
      };
      setCuratedSources(prev => [failedCurItem, ...prev]);
    }
  };

  // Trajectory select helpers
  const toggleTrajectory = (traj: TrajectoryType) => {
    setEditedTrajectories(prev =>
      prev.includes(traj) ? prev.filter(t => t !== traj) : [...prev, traj]
    );
  };

  // Provider editing helper
  const handleProviderChange = (providerStr: string) => {
    const list = providerStr.split(',').map(s => s.trim()).filter(Boolean);
    setEditedProviders(list);
  };

  // Approve Draft -> Merges into public Events State
  const handleApprove = () => {
    if (!editedTitle || !editedSummary || !editedWhyItMatters) {
      alert('请确保标题、核心摘要及关键说明不为空！');
      return;
    }

    const approvedEvent: Event = {
      id: draft?.id || `ev-approved-${Date.now()}`,
      title: editedTitle,
      date: draft?.date || new Date().toISOString().split('T')[0],
      type: editedType,
      summary: editedSummary,
      why_it_matters: editedWhyItMatters,
      trajectories: editedTrajectories,
      providers: editedProviders,
      sources: editedSources.length > 0 ? editedSources : [{ title: editedTitle, url }],
      confidence: editedConfidence,
      watchlist: draft?.watchlist || false,
    };

    onApproveEvent(approvedEvent);
    alert('🎉 事件人工批准通过！内容已合流并于公共网站即时上线。');

    // Reset Curation editor
    setDraft(null);
    setQualityReport(null);
    setUrl('');
    setNotes('');
  };

  // Reject Draft
  const handleReject = () => {
    if (confirm('确认拒绝并驳回该 AI 生成草稿吗？')) {
      const rejectedCurItem: CurationSource = {
        id: `src-${Date.now()}`,
        url,
        title: editedTitle || '未命名草稿',
        type: 'other',
        createdAt: new Date().toISOString().split('T')[0],
        extractionStatus: 'rejected'
      };
      setCuratedSources(prev => [rejectedCurItem, ...prev]);
      setDraft(null);
      setQualityReport(null);
      setUrl('');
      setNotes('');
    }
  };

  // Compile Weekly Brief Proposal
  const handlePublishBrief = () => {
    if (selectedHeadlineIds.length === 0) {
      alert('请至少选择一个已批准事件作为本周的主线焦点（Headline Event）！');
      return;
    }

    const newBrief: WeeklyBrief = {
      id: `week-${Date.now()}`,
      weekStart,
      weekEnd,
      weeklyThesis,
      headlineEventIds: selectedHeadlineIds,
      watchlistEventIds: selectedWatchlistIds,
      closingSynthesis
    };

    onPublishWeeklyBrief(newBrief);
    alert('🚀 本周 Weekly Digest 组装成功！公共静态首页头版已被更新。');
  };

  const handleToggleHeadline = (id: string) => {
    setSelectedHeadlineIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    // Remove from watchlist if selected for headline
    setSelectedWatchlistIds(prev => prev.filter(x => x !== id));
  };

  const handleToggleWatchlist = (id: string) => {
    setSelectedWatchlistIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    // Remove from headline if selected for watchlist
    setSelectedHeadlineIds(prev => prev.filter(x => x !== id));
  };

  return (
    <div className="space-y-6">
      {/* Curation Intro Header */}
      <div className="bg-black text-white p-6 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 max-w-xl">
          <h2 className="text-base font-bold flex items-center gap-2 font-serif italic">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            AI Progress 本地决策与研判工作台 • Cockpit
          </h2>
          <p className="text-[11px] text-slate-450 font-serif">
            管理员专设，所有本地摄入、未审计草稿、决策日志、模型配置均保持离线隔离，于本地暂存安全运行。
          </p>
        </div>
        <div className="flex gap-2 text-[10px] font-mono">
          <span className="px-2.5 py-1 bg-zinc-900 text-slate-300 rounded border border-zinc-800">
            CRAWL4AI: ACTIVE
          </span>
          <span className="px-2.5 py-1 bg-zinc-900 text-slate-300 rounded border border-zinc-800">
            TRAFILATURA: ACTIVE
          </span>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        {/* Left Column: URL Ingestion and Extract Log Terminal */}
        <div className="xl:col-span-1 space-y-6">
          {/* Source URL Ingestion Form */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-4 flex items-center gap-1.5">
              <Send size={11} className="text-black" />
              1. Ingestion • 摄入最新研判线索
            </h3>
            <form onSubmit={handleIngest} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 font-mono uppercase tracking-wider">来源 URL (Source URL)</label>
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://arxiv.org/abs/..."
                  className="w-full text-xs px-3 py-2 bg-[#F9F8F6] border border-slate-200 rounded focus:outline-none focus:border-black focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 font-mono uppercase tracking-wider">策展研究备忘录 (Private Notes)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="录入对此事件的初步直觉备忘..."
                  rows={2}
                  className="w-full text-xs p-3 bg-[#F9F8F6] border border-slate-200 rounded focus:outline-none focus:border-black focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div>
                  <label className="block text-slate-400 mb-1">主提取引擎</label>
                  <select
                    value={extractor}
                    onChange={e => setExtractor(e.target.value as 'Crawl4AI' | 'Trafilatura')}
                    className="w-full bg-[#F9F8F6] border border-slate-200 rounded px-1.5 py-1 focus:outline-none"
                  >
                    <option value="Crawl4AI">Crawl4AI (Md)</option>
                    <option value="Trafilatura">Trafilatura (Txt)</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isExtracting || !url}
                    className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-black hover:bg-zinc-800 text-white font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer uppercase tracking-wider text-[10px]"
                  >
                    {isExtracting ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Play size={11} />
                    )}
                    提取并 AI 研判
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Rolling Extractor Terminal Logs */}
          {(isExtracting || currentLogsToShow.length > 0) && (
            <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 font-mono text-[10px] text-zinc-300 shadow-md">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-900 mb-2">
                <span className="text-amber-500 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                  RAW EXTRACTION LIVE CONSOLE
                </span>
                {isExtracting && <Loader2 size={10} className="animate-spin text-zinc-500" />}
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto leading-relaxed">
                {currentLogsToShow.map((log, i) => (
                  <p key={i} className={log.includes('ERROR') ? 'text-rose-400' : 'text-zinc-400'}>
                    {log}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Curation Sources Log list */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-xs">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-3">
              Ingestion Logs • 摄入源生命周期
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {curatedSources.map((src) => (
                <div key={src.id} className="p-2.5 bg-[#F9F8F6] border border-slate-200 rounded flex items-center justify-between gap-2">
                  <div className="truncate space-y-0.5">
                    <span className="block font-semibold text-slate-800 truncate font-serif">{src.title || src.url}</span>
                    <span className="block text-[9px] font-mono text-slate-400 truncate">{src.url}</span>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium shrink-0 ${
                    src.extractionStatus === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    src.extractionStatus === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    src.extractionStatus === 'failed' ? 'bg-red-100 text-red-800' : 'bg-blue-50 text-blue-755 border border-blue-200'
                  }`}>
                    {src.extractionStatus === 'approved' && '已合流'}
                    {src.extractionStatus === 'rejected' && '已驳回'}
                    {src.extractionStatus === 'failed' && '抓取失败'}
                    {src.extractionStatus === 'success' && 'AI已抽'}
                    {src.extractionStatus === 'fallback_success' && '模拟抽'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (2 xl columns): Quality Report + Draft Review / Editor */}
        <div className="xl:col-span-2 space-y-6">
          {draft ? (
            <div className="space-y-6">
              {/* Quality Report Analysis Dashboard */}
              {qualityReport && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5 font-mono">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    2. AI Quality Audit • AI 质量评估
                  </h3>

                  {/* Indicators Grid */}
                  <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                    <div className="p-3 bg-[#F9F8F6] border border-slate-150 rounded-lg">
                      <span className="block text-[9px] text-slate-400 font-bold tracking-wider mb-1 uppercase font-mono">证据覆盖率</span>
                      <span className="block text-lg font-bold font-mono text-emerald-700">{qualityReport.evidenceCoverage}%</span>
                    </div>
                    <div className="p-3 bg-[#F9F8F6] border border-slate-150 rounded-lg">
                      <span className="block text-[9px] text-slate-400 font-bold tracking-wider mb-1 uppercase font-mono">可信度评分</span>
                      <span className="block text-lg font-bold font-mono text-blue-700">{qualityReport.sourceTrust}%</span>
                    </div>
                    <div className="p-3 bg-[#F9F8F6] border border-slate-150 rounded-lg">
                      <span className="block text-[9px] text-slate-400 font-bold tracking-wider mb-1 uppercase font-mono">因果链接度</span>
                      <span className="block text-lg font-bold font-mono text-purple-700">{qualityReport.causalLinkCompleteness}%</span>
                    </div>
                  </div>

                  {/* Alerts/Issues */}
                  {qualityReport.issues.length > 0 && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded text-xs text-amber-900 flex items-start gap-2">
                      <AlertCircle size={14} className="text-amber-700 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold">质量研判提示：</span>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {qualityReport.issues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Live Structural Draft Editor */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                    <FileCheck size={12} className="text-black" />
                    3. Draft Review • 草稿核准对齐
                  </h3>
                  <span className="text-[9px] font-mono text-slate-400 uppercase font-bold">DATE: {draft?.date}</span>
                </div>

                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 font-mono uppercase">中文标题 (Title) *</label>
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={e => setEditedTitle(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-[#F9F8F6] border border-slate-200 rounded focus:outline-none focus:border-black font-semibold font-serif"
                      required
                    />
                  </div>

                  {/* Row 1: Type, Confidence, Providers */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 font-mono uppercase">分类类型 (Category)</label>
                      <select
                        value={editedType}
                        onChange={e => setEditedType(e.target.value as EventType)}
                        className="w-full bg-[#F9F8F6] border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none text-xs"
                      >
                        {Object.entries(EVENT_TYPE_MAP).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 font-mono uppercase">置信度 (Confidence)</label>
                      <select
                        value={editedConfidence}
                        onChange={e => setEditedConfidence(e.target.value as ConfidenceType)}
                        className="w-full bg-[#F9F8F6] border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none text-xs"
                      >
                        <option value="observed">已观测 (Observed)</option>
                        <option value="likely">高概率 (Likely)</option>
                        <option value="speculative">前沿推测 (Speculative)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 font-mono uppercase">研究/供应方 (Comma Sep)</label>
                      <input
                        type="text"
                        value={editedProviders.join(', ')}
                        onChange={e => handleProviderChange(e.target.value)}
                        placeholder="例如: OpenAI, Google"
                        className="w-full bg-[#F9F8F6] border border-slate-200 rounded px-3 py-1.5 focus:outline-none text-xs"
                      />
                    </div>
                  </div>

                  {/* Multi-select Trajectories */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 font-mono uppercase">轨迹归属 (Trajectories) *</label>
                    <div className="flex flex-wrap gap-1">
                      {(Object.keys(TRAJECTORY_MAP) as TrajectoryType[]).map(traj => {
                        const mapped = TRAJECTORY_MAP[traj];
                        const isSelected = editedTrajectories.includes(traj);
                        return (
                          <button
                            key={traj}
                            type="button"
                            onClick={() => toggleTrajectory(traj)}
                            className={`px-3 py-1 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-black text-white border-black'
                                : 'bg-[#F9F8F6] text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {mapped.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 font-mono uppercase">核心内容摘要 (Chinese Summary) *</label>
                    <textarea
                      value={editedSummary}
                      onChange={e => setEditedSummary(e.target.value)}
                      rows={4}
                      className="w-full text-xs p-3 bg-[#F9F8F6] border border-slate-200 rounded focus:outline-none focus:border-black leading-relaxed font-serif"
                      required
                    />
                  </div>

                  {/* Why It Matters */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 font-mono uppercase">关键说明与技术启示 (Why It Matters) *</label>
                    <textarea
                      value={editedWhyItMatters}
                      onChange={e => setEditedWhyItMatters(e.target.value)}
                      rows={2}
                      className="w-full text-xs p-3 bg-[#F9F8F6] border border-slate-200 rounded focus:outline-none focus:border-black font-serif"
                      required
                    />
                  </div>
                </div>

                {/* Audit Actions Bar */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                  <button
                    onClick={handleReject}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded transition-colors cursor-pointer"
                  >
                    驳回此草稿
                  </button>
                  <button
                    onClick={handleApprove}
                    className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    人工核准：批准并入公网
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl bg-[#F2EDE4]/30">
              <Sparkles size={32} className="mx-auto text-slate-300 mb-3" />
              <h4 className="text-sm font-semibold text-slate-700 font-serif italic">等待录入研判线索</h4>
              <p className="text-xs text-slate-450 mt-1 max-w-sm mx-auto font-serif">
                请在左侧策展输入栏填写相关文献/博客链接。工作台将自动运行抽取分析，并在此生成可由您任意编辑、审计的事实草稿。
              </p>
            </div>
          )}

          {/* Weekly Brief Builder Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pb-3 border-b border-slate-100 flex items-center gap-1.5 font-mono">
              <BookOpen size={12} className="text-black" />
              4. Assembly • 编排组装本周周报
            </h3>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">周起始日期 (Week Start)</label>
                <input
                  type="date"
                  value={weekStart}
                  onChange={e => setWeekStart(e.target.value)}
                  className="w-full bg-[#F9F8F6] border border-slate-200 rounded p-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">周结束日期 (Week End)</label>
                <input
                  type="date"
                  value={weekEnd}
                  onChange={e => setWeekEnd(e.target.value)}
                  className="w-full bg-[#F9F8F6] border border-slate-200 rounded p-1.5 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-4">
              {/* Thesis */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 font-mono uppercase">本周主线研判论据 (Weekly Thesis) *</label>
                <textarea
                  value={weeklyThesis}
                  onChange={e => setWeeklyThesis(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-3 bg-[#F9F8F6] border border-slate-200 rounded focus:outline-none focus:border-black font-serif"
                  required
                />
              </div>

              {/* Event selectors */}
              <div className="space-y-2 text-xs">
                <span className="block text-[10px] font-bold text-slate-500 font-mono uppercase">编组已批准线索事件 (Headline vs Watchlist):</span>
                <span className="block text-[9px] text-slate-450 font-mono mb-2">事件在上方批准合流后方在此处显示。</span>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-100 rounded p-2.5 bg-[#F9F8F6]">
                  {approvedEvents.length === 0 ? (
                    <p className="text-slate-400 italic text-center py-4 font-serif">无已批准事件可选</p>
                  ) : (
                    approvedEvents.map((ev) => {
                      const isHeadline = selectedHeadlineIds.includes(ev.id);
                      const isWatchlist = selectedWatchlistIds.includes(ev.id);

                      return (
                        <div key={ev.id} className="flex items-center justify-between p-2 bg-white border border-slate-250 rounded gap-3">
                          <span className="font-semibold text-slate-800 truncate pr-2 text-xs font-serif">{ev.title}</span>
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleHeadline(ev.id)}
                              className={`px-2 py-1 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                                isHeadline ? 'bg-black text-white border-black' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              头条焦点
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleWatchlist(ev.id)}
                              className={`px-2 py-1 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                                isWatchlist ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              关注清单
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Closing Outlook */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 font-mono uppercase">结语与未来趋势展望 (Closing Synthesis) *</label>
                <textarea
                  value={closingSynthesis}
                  onChange={e => setClosingSynthesis(e.target.value)}
                  rows={2}
                  className="w-full text-xs p-3 bg-[#F9F8F6] border border-slate-200 rounded focus:outline-none focus:border-black font-serif"
                  required
                />
              </div>

              {/* Publish Weekly Action */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handlePublishBrief}
                  className="w-full py-2.5 bg-black hover:bg-zinc-800 text-white font-bold text-xs rounded shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer uppercase tracking-wider"
                >
                  <FileCheck size={12} />
                  组装本期周报并实时推送头版 (Publish Digest)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
