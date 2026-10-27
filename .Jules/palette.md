## 2026-10-27 - Added ARIA labels to close buttons
**Learning:** The application extensively uses an icon-only 'close' button pattern (e.g., `<X className="h-4 w-4" />`) across various modal components like `FepnMobileNav`, `FepnDeviceSecurityModal`, and `FepnQrScannerModal`. These buttons lacked `aria-label` attributes, making them inaccessible to screen readers.
**Action:** Add `aria-label="Đóng"` (since the UI is primarily in Vietnamese) to all icon-only close buttons containing the `<X />` icon to ensure screen reader compatibility and improve accessibility.
