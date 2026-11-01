## 2024-05-14 - Add ARIA Labels to Icon-Only Buttons
**Learning:** Found multiple icon-only buttons across components (MobileNav, AudioLectureViewer, etc.) that were missing ARIA labels, making them inaccessible to screen readers.
**Action:** Always verify that icon-only buttons have an `aria-label` attribute describing their action or a `title` attribute, but prioritize `aria-label` for screen reader compatibility. Added `aria-label` to various close, play/pause, refresh, and copy buttons.
