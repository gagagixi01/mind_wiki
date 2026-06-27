export type EventType = 'paper' | 'model_release' | 'architecture' | 'business' | 'infra' | 'benchmark' | 'regulation' | 'product';

export type TrajectoryType = 'llm_architecture' | 'multimodal_architecture' | 'provider_releases' | 'commercial_forces';

export type ConfidenceType = 'observed' | 'likely' | 'speculative';

export interface Source {
  title: string;
  url: string;
  category?: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  type: EventType;
  summary: string;
  why_it_matters: string;
  trajectories: TrajectoryType[];
  providers: string[];
  sources: Source[];
  confidence: ConfidenceType;
  watchlist: boolean;
  causal_links?: string[]; // References to causal link IDs
}

export interface WeeklyBrief {
  id: string;
  weekStart: string;
  weekEnd: string;
  weeklyThesis: string;
  headlineEventIds: string[];
  watchlistEventIds: string[];
  closingSynthesis: string;
  body?: string;
}

export type RelationshipType = 'enables' | 'constrains' | 'accelerates' | 'competes' | 'drives' | 'mitigates';

export interface CausalLink {
  id: string;
  sourceId: string; // Event ID or concept name
  sourceTitle: string;
  targetId: string; // Event ID or concept name
  targetTitle: string;
  relationshipType: RelationshipType;
  explanation: string;
  confidence: ConfidenceType;
  sources: Source[];
}

export type ExtractionStatus = 'pending' | 'extracting' | 'fallback_success' | 'success' | 'failed' | 'duplicate_warning' | 'invalid_ai_output' | 'approved' | 'rejected';

export interface QualityReport {
  evidenceCoverage: number; // percentage 0-100
  sourceTrust: number; // percentage 0-100
  causalLinkCompleteness: number; // percentage 0-100
  issues: string[];
}

export interface CurationSource {
  id: string;
  url: string;
  title?: string;
  type: 'arxiv' | 'blog' | 'news' | 'twitter' | 'github' | 'other';
  notes?: string;
  createdAt: string;
  extractionStatus: ExtractionStatus;
  extractionLog?: string[];
  draft?: Partial<Event>;
  qualityReport?: QualityReport;
}
