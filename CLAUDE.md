# gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools directly.

Available gstack skills:
- `/office-hours` — async Q&A and coaching session
- `/plan-ceo-review` — prepare a plan for CEO review
- `/plan-eng-review` — prepare a plan for engineering review
- `/plan-design-review` — prepare a plan for design review
- `/design-consultation` — get design feedback and guidance
- `/review` — code review
- `/ship` — ship a feature end-to-end
- `/browse` — web browsing (use this for all web browsing)
- `/qa` — QA testing with browser automation
- `/qa-only` — QA testing only (no code changes)
- `/design-review` — review designs
- `/setup-browser-cookies` — configure browser cookies for authenticated browsing
- `/retro` — run a retrospective
- `/debug` — debug an issue
- `/document-release` — document a release

If gstack skills aren't working, run the following to build the binary and register skills:

```
cd .claude/skills/gstack && ./setup
```

## Design System
Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.

Key rules at a glance:
- **Fonts:** Fraunces (display/headings), Plus Jakarta Sans (body/UI), JetBrains Mono (data/credits)
- **Accent color:** `#B5622A` (cognac amber) — never purple, never blue as primary
- **Background:** `#FAF7F2` (archival cream) — never pure `#FFFFFF`
- **Aesthetic:** Refined Artisan — warm, unhurried, treats photos as precious objects
- **Spacing:** 8px base, comfortable density — never rushed or cramped
- In QA mode, flag any code or UI that doesn't match DESIGN.md.

## Animation & Motion (Non-Negotiable)
PicRenew is a playful, lively product. Animated transitions are a core part of the experience — not optional polish.

**Always animate:**
- **Accordion/panel open-close** — use CSS `transition` or Framer Motion `AnimatePresence`. Never toggle visibility with an instant show/hide. Duration: 250–350ms, ease-out.
- **Page scroll from nav links** — never `jump`. Use smooth scroll behavior. When a user clicks "How it works" or any in-page anchor, the page should animate to that section. Use CSS `scroll-behavior: smooth` on `html`, or JS-based smooth scroll for more control.
- **Page transitions** — between route changes, use a fade or slide-up transition.
- **Interactive elements appearing** — new cards, panels, or content sliding into view should animate in (fade + slight translateY), not pop.
- **State changes** — selected/deselected states on presets, pickers, and toggles should transition (background color, border) over 150–200ms.

**Easing defaults:**
- Expand/open: `cubic-bezier(0.16, 1, 0.3, 1)` (spring-like, fast settle)
- Collapse/close: `cubic-bezier(0.4, 0, 0.6, 1)` (ease-in)
- Color/opacity transitions: `ease-out` 150ms

**In QA mode:** Flag any panel that appears/disappears instantly (no animation) as a medium severity issue.

**Accessibility note:** Always respect `prefers-reduced-motion`. Wrap animations in `@media (prefers-reduced-motion: no-preference)` or use Framer Motion's `useReducedMotion()` hook.

## Accessibility (Non-Negotiable)
WCAG 2.1 AA compliance is required on every sprint — not deferred, not optional.

**Every sprint must:**
- Fix all `axe-core` critical and serious violations before shipping
- Ensure all interactive elements are keyboard-navigable (Tab, Enter, Space, arrow keys where appropriate)
- Maintain minimum 4.5:1 contrast ratio for normal text, 3:1 for large text
- Provide `alt` text on all meaningful images; `alt=""` on decorative ones
- Associate all form inputs with `<label>` or `aria-label`
- Add `role` and `aria-*` attributes to custom interactive components (sliders, file zones, pickers)
- Ensure modals/drawers trap focus when open and release it on close (Escape key)

**Scope per sprint:** Run `axe-core` on all pages modified that sprint, plus the 5 core pages: `/` (home), `/billing`, `/restore/[id]`, `/studio`, `/account`.

**When reviewing or QA-ing:** Flag any accessibility violation as at least medium severity. Critical and serious axe-core violations are P1 blockers — they block ship.
