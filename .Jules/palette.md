## 2025-02-09 - Missing ARIA Labels on Icon-only Buttons
**Learning:** Found multiple instances where icon-only buttons (like Close or Send buttons) lack `aria-label` or `title` attributes. This makes them invisible/unclear to screen reader users. This is a common accessibility issue across various components.
**Action:** When working on UX/a11y improvements, prioritize adding `aria-label` or `title` attributes to all icon-only interactive elements to ensure they are accessible.
