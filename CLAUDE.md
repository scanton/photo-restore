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
