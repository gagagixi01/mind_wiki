# AI Progress Weekly Digest Public Site UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the static public site into a Chinese editorial research cockpit while preserving the approved-content-only boundary.

**Architecture:** Keep the existing Next.js public site and shadcn/ui primitives. Refine `apps/site/components/public-site.tsx` and styling so the public reader flow starts from the latest weekly brief, event cards open a Sheet, trajectory navigation is contextual, and Sources exposes only approved event source metadata.

**Tech Stack:** Next.js App Router, React, shadcn/ui, Tailwind CSS, `@mind-wiki/core` approved content loaders.

---

## Task 1: Sidebar And Homepage Reading Flow

**Files:**
- Modify: `apps/site/components/public-site.tsx`

- [ ] **Step 1: Update global navigation labels**

Replace the existing `navGroups` in `apps/site/components/public-site.tsx` with:

```ts
const navGroups = [
  {
    label: "问题",
    items: [
      { href: "/", label: "本周", icon: CalendarDays },
      { href: "/trajectories", label: "长期趋势", icon: Waypoints },
      { href: "/causal-chains", label: "因果链", icon: GitBranch },
      { href: "/providers", label: "提供方", icon: Library },
      { href: "/sources", label: "来源", icon: BookOpen }
    ]
  }
];
```

- [ ] **Step 2: Verify no global trajectory group remains**

Run:

```bash
rg -n "LLM 架构|多模态|供应商策略|商业与基础设施" apps/site/components/public-site.tsx
```

Expected: matches are allowed in contextual trajectory components only, not in `navGroups`.

- [ ] **Step 3: Confirm homepage section order**

In `WeekView`, ensure rendered order is:

```tsx
<section aria-label="最新周报">...</section>
<section aria-label="主线聚焦">...</section>
{watchlistEvents.length > 0 ? <section aria-label="观察清单">...</section> : null}
<section aria-label="因果链上下文">...</section>
```

If the causal-chain context is already represented by the closing synthesis panel inside the first viewport, keep it there and add the `aria-label="因果链上下文"` to that aside.

- [ ] **Step 4: Verify site build**

Run:

```bash
pnpm --filter @mind-wiki/site lint
pnpm --filter @mind-wiki/site build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/site/components/public-site.tsx
git commit -m "feat: refine public question navigation"
```

## Task 2: Event Card Actions And Sheet Hierarchy

**Files:**
- Modify: `apps/site/components/public-site.tsx`

- [ ] **Step 1: Make card primary action open Sheet**

In the event card component, make the main interactive element a button:

```tsx
<button
  type="button"
  className="event-card-main"
  onClick={() => onOpenEvent(event)}
>
  <span className="event-card-title">{event.title}</span>
  <span className="event-card-summary">{event.summary}</span>
</button>
```

- [ ] **Step 2: Add separate trajectory link**

In the same event card component, add:

```tsx
<Link
  className="event-card-secondary"
  href={`/trajectories/${event.primaryTrajectory}?event=${event.id}`}
>
  View in trajectory <ArrowRight className="size-3" aria-hidden="true" />
</Link>
```

Expected behavior: clicking the card opens the Sheet; clicking `View in trajectory` navigates and does not open the Sheet.

- [ ] **Step 3: Reorder Sheet content**

In `EventSheet`, render sections in this order:

```tsx
<section>
  <h3>为什么关键</h3>
  <p>{event.whyItMatters}</p>
</section>
<section>
  <h3>摘要</h3>
  <p>{event.summary}</p>
</section>
<section>
  <h3>来源</h3>
  {event.sources.map((source) => (
    <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
      {source.title}
    </a>
  ))}
</section>
<section>
  <h3>置信度</h3>
  <Badge>{confidenceLabels[event.confidence]}</Badge>
</section>
```

After these sections, render related trajectories, provider tags, and causal links.

- [ ] **Step 4: Verify site build**

Run:

```bash
pnpm --filter @mind-wiki/site lint
pnpm --filter @mind-wiki/site build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/site/components/public-site.tsx
git commit -m "feat: separate event sheet and trajectory actions"
```

## Task 3: Trajectory And Sources Boundaries

**Files:**
- Modify: `apps/site/components/public-site.tsx`

- [ ] **Step 1: Make trajectory choices contextual**

Ensure `/trajectories` renders the four trajectory sections top-to-bottom with:

```tsx
<h2>{trajectory.title}</h2>
<p>{trajectory.primer}</p>
<p>{narrative.phase}</p>
<p>{narrative.weeklyRelevance}</p>
<p>{narrative.nextWatch}</p>
<Link href={`/trajectories/${trajectory.id}`}>聚焦这条轨迹</Link>
```

Ensure `/trajectories/[trajectory]` renders `TrajectoryContextHeader` with visible `当前轨迹` and compact switching.

- [ ] **Step 2: Guard public Sources**

In `SourcesView`, use only `data.events` and `event.sources`. Do not import from `@mind-wiki/curation`, do not read `.curation`, and do not mention source packs or discovery records.

Run:

```bash
rg -n "@mind-wiki/curation|\\.curation|source-packs|discovery-records|run-logs|drafts|rejected" apps/site
```

Expected: no matches in public site source files.

- [ ] **Step 3: Verify site build**

Run:

```bash
pnpm --filter @mind-wiki/site lint
pnpm --filter @mind-wiki/site build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/site/components/public-site.tsx
git commit -m "feat: preserve public sources boundary"
```

## Task 4: Visual System Cleanup

**Files:**
- Modify: `apps/site/app/globals.css`
- Modify: `packages/core/src/styles/tokens.css`
- Modify: `apps/site/components/public-site.tsx`

- [ ] **Step 1: Add editorial utility classes**

Add to `apps/site/app/globals.css`:

```css
.font-metadata {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}

.font-editorial {
  font-family: Georgia, "Times New Roman", "Songti SC", "SimSun", serif;
}
```

- [ ] **Step 2: Enforce radius ceiling**

In `packages/core/src/styles/tokens.css`, ensure radius remains at or below 8px:

```css
:root {
  --radius: 0.5rem;
}
```

- [ ] **Step 3: Scan for unwanted visual patterns**

Run:

```bash
rg -n "purple|violet|gradient|blur-3xl|rounded-2xl|rounded-3xl" apps/site packages/core/src/styles
```

Expected: no decorative purple gradients or large rounded card classes remain in public site surfaces. If a match is a shadcn primitive default, leave it only when not visible as decorative page chrome.

- [ ] **Step 4: Verify site build**

Run:

```bash
pnpm --filter @mind-wiki/site lint
pnpm --filter @mind-wiki/site build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/site/app/globals.css packages/core/src/styles/tokens.css apps/site/components/public-site.tsx
git commit -m "style: tune public editorial cockpit"
```
