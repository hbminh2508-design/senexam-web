## 2026-10-14 - Add explicit htmlFor and id mapping to form inputs
**Learning:** In React/Next.js, using implicit label wrapping or no linking at all can make forms less accessible for screen readers and harder for users to tap/click, especially on mobile. Explicitly linking a `<label htmlFor="id">` to an `<input id="id">` ensures optimal accessibility, making the label text clickable to focus the input field.
**Action:** Always map labels to inputs using explicit `htmlFor` and `id` pairs across the application's forms to enhance usability and adhere to a11y standards.
