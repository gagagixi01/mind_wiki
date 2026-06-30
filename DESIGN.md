# Design System (DESIGN.md)

This document defines the visual standards, design tokens, and components for the Mind Wiki AI Progress Curation Workbench and Public Reader.

## Typography

- **Primary Font:** Inter, system-ui, sans-serif
  - Used for body copy, buttons, inputs, table headings, and data elements.
  - Prioritizes high legibility and fast scan rates for data-dense interfaces.
- **Monospace Font:** Roboto Mono, Courier New, monospace
  - Used for URLs, ID hashes, model keys, and code snippets.
- **Hierarchy:**
  - `h1`: 24px / line-height 1.2 / Font-weight 600 (bold)
  - `h2`: 20px / line-height 1.25 / Font-weight 600
  - `h3`: 16px / line-height 1.3 / Font-weight 500
  - `body`: 14px (or 16px) / line-height 1.5 / Font-weight 400
  - `small`/`muted`: 12px / line-height 1.4 / Font-weight 400

## Colors

The application uses a neutral slate/zinc base with purposeful accents. Avoid ornamental gradients or high-saturation primary colors.

### Base Colors
- **Background:** `hsl(240, 10%, 3.9%)` (Dark mode default) or `hsl(0, 0%, 100%)` (Light mode default)
- **Foreground:** `hsl(0, 0%, 98%)` (Dark) or `hsl(240, 10%, 3.9%)` (Light)
- **Card Background:** `hsl(240, 10%, 10%)`
- **Border:** `hsl(240, 5.9%, 15%)`
- **Muted Foreground:** `hsl(240, 5%, 64.9%)`

### Semantic Colors
- **Primary / Accent:** Slate/Blue (`hsl(220, 70%, 50%)`)
  - Used for active status, primary buttons, and selected tabs.
- **Success:** Emerald/Green (`hsl(142.1, 70.6%, 45.3%)`)
  - Used for approved drafts, completed runs, and successful tests.
- **Warning:** Amber/Orange (`hsl(37.9, 90.2%, 50.2%)`)
  - Used for offline fallback mode, duplicate warnings, and invalid schemas.
- **Destructive:** Rose/Red (`hsl(346.8, 77.2%, 49.8%)`)
  - Used for failed extractions, pipeline crashes, and reject actions.

## Spacing & Grid

All spacing must adhere to an 8px base grid system (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`).
- **Layout Margins:** 16px padding inside cards, 24px margins between main sections.
- **Component Padding:**
  - Buttons: `8px 16px`
  - Badges: `4px 8px`
  - Input fields: `8px 12px`

## Component Vocabulary

1. **Button:** Neutral border with solid background for primary actions. Border-only for secondary/outline.
2. **Badge:** Rounded labels with 12px text. Use semantic tones (success, danger, warning, info, neutral).
3. **Card:** Subtle border, flat card background, rounded corners (default radius `8px`). No heavy decorative drop shadows.
4. **Empty State:** Centered card containing a title, clear description, and a button leading to the next logical action.
5. **Callout / Alert:** Subtle light background tint of the semantic color with a thick left border of the semantic accent (e.g. 4px solid orange for warnings).

## Curation Workspace Layout

- **Unified Navigation Tabs:** Left-aligned tabs with standard arrow-key navigation. Active tab highlighted in blue/white.
- **Mobile Curation:** Views under 768px must stack layout blocks. Tables of candidates convert to simple card stacks with a touch-friendly 48px minimal layout.
