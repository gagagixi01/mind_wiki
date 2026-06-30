# Project TODOs

This file tracks design and feature debt for the AI Progress Curation Workbench and Public Reader.

## Curation Cockpit Design Debt

### 1. Tab 2 Duplicate URL Merge Diff Overlay
* **What:** Build a side-by-side diff modal or drawer to compare and merge duplicate discovery candidate records.
* **Why:** Curators need a clear, visual way to reconcile information when multiple feeds or search queries discover the same source URL.
* **Pros:** Prevents duplicate events from cluttering the weekly brief, saving time and keeping the data clean.
* **Cons:** Requires designing and implementing a clean responsive diff layout.
* **Context:** Highlighted during the June 2026 design review (D11). The overlay should show metadata from both records (extracted titles, trajectories, scores) and let the curator select which fields to retain in the merged record.
* **Depends on / blocked by:** Local backend support for merging candidate endpoints.

### 2. Tab 3 Keyboard Nav for Weekly Brief Fields
* **What:** Implement keyboard shortcuts to navigate and focus fields inside the Weekly Brief Builder tab.
* **Why:** Speed up the curation and assembly workflow for power users who prefer not to use the mouse.
* **Pros:** Enhances keyboard accessibility (a11y) and increases weekly brief publishing speed.
* **Cons:** Adds event handling complexity to the form components.
* **Context:** Highlighted during the June 2026 design review (D12). Keybindings (e.g. `Ctrl + J`/`Ctrl + K` to jump fields, `Ctrl + Enter` to publish) should be clearly documented in a tooltip or legend.
* **Depends on / blocked by:** Base layout stability of Tab 3.
