## 2024-05-24 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found multiple icon-only buttons (like password visibility toggles, close buttons, and info triggers) missing `aria-label` attributes. This makes screen readers announce them poorly (e.g. as just "button" or reading the SVG code).
**Action:** Always add descriptive `aria-label`s to any interactive element that relies solely on an icon to communicate its purpose, especially in forms (password toggles) and overlays (close buttons).
