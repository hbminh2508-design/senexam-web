## 2026-10-15 - Adding aria labels to chat controls
**Learning:** Found multiple instances of icon-only buttons (Minimize/Maximize, Close, Send) and search input fields lacking `aria-label` or `title` in SenChat modal/offline components. This severely hindered screen-reader accessibility and mouse-user tooltip experience.
**Action:** Add `aria-label` and `title` to all icon-only buttons using appropriate Vietnamese translations.
