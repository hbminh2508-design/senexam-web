## 2024-05-14 - Improve Modal and Drawer Accessibility
**Learning:** Custom mobile drawers and modals in this app frequently lack basic ARIA semantics, specifically `role="dialog"`, `aria-modal="true"`, and appropriate `aria-labelledby` or `aria-describedby` attributes. Furthermore, icon-only close buttons often miss `aria-label` attributes.
**Action:** When implementing or updating custom modals and drawers, always ensure they are properly identified as dialogs and their controls (like open/close buttons) have appropriate `aria-expanded`, `aria-controls`, and `aria-label` attributes.
