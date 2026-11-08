## 2025-05-18 - Password toggle buttons lack aria-labels and focus styles
**Learning:** Icon-only buttons used for toggling password visibility in auth forms lack ARIA labels (`aria-label`) making them inaccessible to screen readers. They also lack clear keyboard focus states making it difficult for keyboard users to navigate.
**Action:** Always verify icon-only buttons have `aria-label`s and `focus-visible` classes to ensure they are accessible.
