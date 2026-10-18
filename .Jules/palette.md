## 2024-10-18 - Missing ARIA Labels on Common Controls
**Learning:** Found a recurring pattern in modal components and media viewers where icon-only buttons (like `X` for close, copy icon, and playback controls) rely solely on visible context or the `title` attribute, but lack `aria-label` for screen reader accessibility.
**Action:** When adding new modals or custom media viewers, enforce the addition of explicit `aria-label` attributes on any icon-only buttons to ensure they are accessible.
