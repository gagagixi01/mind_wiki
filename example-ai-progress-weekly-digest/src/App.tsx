import React, { useState, useEffect } from 'react';
import { Event, WeeklyBrief, CausalLink } from './types';
import { SEED_EVENTS, SEED_WEEKS, SEED_CAUSAL_LINKS } from './data/seedData';
import WeeklyDigestView from './components/WeeklyDigestView';
import TrajectoryTimeline from './components/TrajectoryTimeline';
import CausalChainView from './components/CausalChainView';
import ProvidersView from './components/ProvidersView';
import SourcesView from './components/SourcesView';
import CurationWorkspace from './components/CurationWorkspace';
import { EventDetailSheet } from './components/EventCard';
import { BookOpen, Layers, Network, Users, FileText, Settings, Sparkles, Database, RotateCcw, Shield, ShieldCheck, Menu, X } from 'lucide-react';

export default function App() {
  // Navigation Routing States
  const [activeTab, setActiveTab] = useState<'digest' | 'timeline' | 'causal' | 'providers' | 'sources' | 'workspace'>('digest');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Core synchronized application states
  const [events, setEvents] = useState<Event[]>([]);
  const [weeklyBriefs, setWeeklyBriefs] = useState<WeeklyBrief[]>([]);
  const [causalLinks, setCausalLinks] = useState<CausalLink[]>([]);

  // Detailed Sheet drawer state
  const [selectedEventForSheet, setSelectedEventForSheet] = useState<Event | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Initialize data on load (syncing from localStorage if possible for real persistence)
  useEffect(() => {
    const cachedEvents = localStorage.getItem('ai_digest_events');
    const cachedWeeks = localStorage.getItem('ai_digest_weeks');
    const cachedCausal = localStorage.getItem('ai_digest_causal');

    if (cachedEvents && cachedWeeks && cachedCausal) {
      try {
        setEvents(JSON.parse(cachedEvents));
        setWeeklyBriefs(JSON.parse(cachedWeeks));
        setCausalLinks(JSON.parse(cachedCausal));
      } catch (e) {
        // Fallback to seeds on error
        setEvents(SEED_EVENTS);
        setWeeklyBriefs(SEED_WEEKS);
        setCausalLinks(SEED_CAUSAL_LINKS);
      }
    } else {
      setEvents(SEED_EVENTS);
      setWeeklyBriefs(SEED_WEEKS);
      setCausalLinks(SEED_CAUSAL_LINKS);
    }
  }, []);

  // Save states to localStorage when updated to preserve curated details
  const saveStateToLocalStorage = (newEvents: Event[], newWeeks: WeeklyBrief[], newCausal: CausalLink[]) => {
    localStorage.setItem('ai_digest_events', JSON.stringify(newEvents));
    localStorage.setItem('ai_digest_weeks', JSON.stringify(newWeeks));
    localStorage.setItem('ai_digest_causal', JSON.stringify(newCausal));
  };

  // Add / Approve curated event
  const handleApproveEvent = (approvedEvent: Event) => {
    const updated = [approvedEvent, ...events];
    setEvents(updated);
    saveStateToLocalStorage(updated, weeklyBriefs, causalLinks);
  };

  // Add custom causal link
  const handleAddCausalLink = (newLink: CausalLink) => {
    const updated = [newLink, ...causalLinks];
    setCausalLinks(updated);
    saveStateToLocalStorage(events, weeklyBriefs, updated);
  };

  // Delete causal link
  const handleDeleteCausalLink = (id: string) => {
    const updated = causalLinks.filter(l => l.id !== id);
    setCausalLinks(updated);
    saveStateToLocalStorage(events, weeklyBriefs, updated);
  };

  // Publish / update a Weekly Brief
  const handlePublishWeeklyBrief = (newBrief: WeeklyBrief) => {
    // Check if the brief already exists, if so overwrite; else prepend
    const index = weeklyBriefs.findIndex(b => b.weekStart === newBrief.weekStart);
    let updated: WeeklyBrief[];
    if (index !== -1) {
      updated = [...weeklyBriefs];
      updated[index] = newBrief;
    } else {
      updated = [newBrief, ...weeklyBriefs];
    }
    setWeeklyBriefs(updated);
    saveStateToLocalStorage(events, updated, causalLinks);
  };

  // Reset System to Seed Data
  const handleResetSystem = () => {
    if (confirm('确认重置整个系统吗？这将会清空您的本地暂存及全部私有抓取草稿，恢复至高价值历史种子数据集状态。')) {
      localStorage.removeItem('ai_digest_events');
      localStorage.removeItem('ai_digest_weeks');
      localStorage.removeItem('ai_digest_causal');
      setEvents(SEED_EVENTS);
      setWeeklyBriefs(SEED_WEEKS);
      setCausalLinks(SEED_CAUSAL_LINKS);
      setActiveTab('digest');
      alert('重置成功！');
    }
  };

  // Global details Sheet triggers
  const handleOpenDetails = (event: Event) => {
    setSelectedEventForSheet(event);
    setIsSheetOpen(true);
  };

  return (
    <div id="main-application-container" className="flex min-h-screen bg-[#F9F8F6] text-[#121212] font-sans antialiased">
      
      {/* MOBILE HEADER BAR */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-40 px-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-black" />
          <span className="font-extrabold text-sm tracking-tight text-slate-900 font-serif italic">AI Progress Digest</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* LEFT SIDEBAR NAVIGATION ROUTER (Editorial Aesthetic) */}
      <aside
        id="navigation-sidebar"
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#F9F8F6] text-[#121212] border-r border-slate-200 flex flex-col justify-between transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:static'
        }`}
      >
        <div className="flex flex-col flex-1 p-6">
          {/* Logo Brand Frame */}
          <div className="mb-10">
            <h1 className="text-xl font-extrabold tracking-tighter uppercase italic">AI Progress</h1>
            <p className="text-[10px] text-slate-500 font-mono mt-1 uppercase tracking-widest">Weekly Digest / V1.0</p>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1">
            <button
              id="tab-digest"
              onClick={() => { setActiveTab('digest'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'digest'
                  ? 'bg-black text-white'
                  : 'text-slate-600 hover:bg-slate-200/40'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>本周摘要</span>
              </span>
              <span className="text-[10px] opacity-60 italic font-mono uppercase">Digest</span>
            </button>

            <button
              id="tab-timeline"
              onClick={() => { setActiveTab('timeline'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'timeline'
                  ? 'bg-black text-white'
                  : 'text-slate-600 hover:bg-slate-200/40'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>长期轨迹</span>
              </span>
              <span className="text-[10px] opacity-60 italic font-mono uppercase">Tracks</span>
            </button>

            <button
              id="tab-causal"
              onClick={() => { setActiveTab('causal'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'causal'
                  ? 'bg-black text-white'
                  : 'text-slate-600 hover:bg-slate-200/40'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>因果链路</span>
              </span>
              <span className="text-[10px] opacity-60 italic font-mono uppercase">Causal</span>
            </button>

            <button
              id="tab-providers"
              onClick={() => { setActiveTab('providers'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'providers'
                  ? 'bg-black text-white'
                  : 'text-slate-600 hover:bg-slate-200/40'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>提供方聚合</span>
              </span>
              <span className="text-[10px] opacity-60 italic font-mono uppercase">Providers</span>
            </button>

            <button
              id="tab-sources"
              onClick={() => { setActiveTab('sources'); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-all cursor-pointer ${
                activeTab === 'sources'
                  ? 'bg-black text-white'
                  : 'text-slate-600 hover:bg-slate-200/40'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>文献信源</span>
              </span>
              <span className="text-[10px] opacity-60 italic font-mono uppercase">Sources</span>
            </button>

            <div className="pt-4 border-t border-slate-200/60 my-4 space-y-1">
              <span className="block px-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2">
                [CURATOR] 决策策展
              </span>
              <button
                id="tab-workspace"
                onClick={() => { setActiveTab('workspace'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'workspace'
                    ? 'bg-amber-950 text-white'
                    : 'text-amber-800 hover:bg-amber-100/50'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Settings size={14} className="animate-spin-slow" />
                  <span>策展研判工作台</span>
                </span>
                <span className="text-[9px] opacity-60 italic font-mono uppercase">Cockpit</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Footer Brand Info */}
        <div className="p-6 border-t border-slate-200 space-y-4">
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-lg">
            <p className="text-[11px] leading-relaxed text-gray-500 italic">
              “帮助个人创业者在 10 分钟内理解 AI 的长期技术与商业趋势。”
            </p>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>SYS UTC 2026</span>
            <button
              onClick={handleResetSystem}
              className="hover:text-black hover:underline cursor-pointer flex items-center gap-1"
            >
              <RotateCcw size={10} />
              重置沙盒
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN COCKPIT VIEWPORT */}
      <main className="flex-1 flex flex-col pt-16 lg:pt-0 pl-0 lg:pl-0 min-w-0">
        
        {/* VIEWPORT STATUS CONTROL HEADER BAR */}
        <div className="h-16 border-b border-slate-200 bg-white/50 backdrop-blur flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center space-x-4">
            <span className="text-[10px] font-mono px-2 py-0.5 border border-black rounded uppercase">
              {activeTab === 'workspace' ? 'Research Studio' : 'Public Archive'}
            </span>
            <h2 className="font-serif italic text-sm text-slate-800 font-medium">
              {activeTab === 'digest' && '第 2026-W01 期周报（研究主页）'}
              {activeTab === 'timeline' && 'AI 进展时间线轨迹图 (Timeline Track)'}
              {activeTab === 'causal' && '结构化因果流网络 (Causal Connection Graph)'}
              {activeTab === 'providers' && '核心科技提供方群组 (AI Research Leaders)'}
              {activeTab === 'sources' && '公考文献与可追溯信源归档表 (Bibliography)'}
              {activeTab === 'workspace' && '本地离线策展与大模型研判中心 (Curation Studio)'}
            </h2>
          </div>

          {/* Connected Database status indicators */}
          <div className="flex items-center gap-2 text-xs font-mono">
            {activeTab === 'workspace' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 text-amber-850 border border-amber-100 text-[10px] font-semibold uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Private Cockpit</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-100 text-[10px] font-semibold uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Public Archive</span>
              </span>
            )}
          </div>
        </div>

        {/* CONTAINER VIEW WRAPPER WITH MARGINS & BOUNDARIES */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          {activeTab === 'digest' && (
            <WeeklyDigestView
              weeklyBriefs={weeklyBriefs}
              allEvents={events}
              onOpenDetails={handleOpenDetails}
            />
          )}

          {activeTab === 'timeline' && (
            <TrajectoryTimeline
              events={events}
              onOpenDetails={handleOpenDetails}
            />
          )}

          {activeTab === 'causal' && (
            <CausalChainView
              causalLinks={causalLinks}
              onAddCausalLink={handleAddCausalLink}
              onDeleteCausalLink={handleDeleteCausalLink}
              isCurationMode={true} // Allow custom connections to demonstrate interactive workflow!
            />
          )}

          {activeTab === 'providers' && (
            <ProvidersView
              events={events}
              onOpenDetails={handleOpenDetails}
            />
          )}

          {activeTab === 'sources' && (
            <SourcesView
              events={events}
              onOpenDetails={handleOpenDetails}
            />
          )}

          {activeTab === 'workspace' && (
            <CurationWorkspace
              approvedEvents={events}
              onApproveEvent={handleApproveEvent}
              onPublishWeeklyBrief={handlePublishWeeklyBrief}
              activeWeeklyBriefs={weeklyBriefs}
            />
          )}
        </div>
      </main>

      {/* GLOBAL EVENT DETAILS DRAWER (SHEET) */}
      <EventDetailSheet
        event={selectedEventForSheet}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        allEvents={events}
      />
    </div>
  );
}
