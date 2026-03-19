# Design System — Photo Restore

## Product Context
- **What this is:** A commercial web app where users upload old, faded, or damaged photographs and receive AI-restored results. Includes a marketing landing page, single-photo restore flow, batch processing, gift-a-restoration flow, credit pack/subscription billing, and an admin panel.
- **Who it's for:** Adults 35–55 — primarily adult children dealing with a box of old family photos, often with high emotional stakes (aging parents, recent inheritances, memorial gifts). Secondary: genealogy enthusiasts restoring photos regularly.
- **Space/industry:** AI photo restoration, consumer SaaS, family memory preservation
- **Project type:** Consumer web app + marketing landing page

## Aesthetic Direction
- **Direction:** Refined Artisan — warm, unhurried, treats photographs as precious objects. Not a tech tool. Not a social media filter. The product should feel like a skilled conservator, not a productivity app.
- **Decoration level:** Intentional — subtle film grain texture on hero and marketing surfaces. References analogue photography and darkroom chemistry. The restore/app flows stay clean and focused.
- **Mood:** The product feels like a museum for your family. Photos arrive, are handled with care, and are returned transformed. The experience is never rushed. The user at 45, dealing with something emotionally significant, should feel the product is on their side.
- **Reference research:** Competitors (Let's Enhance, VanceAI, Remini, MyHeritage, Photomyne) all use blue/purple tech palettes and geometric sans-serif fonts. The warm cognac + archival cream + optical serif system is unclaimed territory in this space.

## Typography
- **Display/Hero:** [Fraunces](https://fonts.google.com/specimen/Fraunces) — A variable optical serif with beautiful italic alternates and wide weight range (100–900). Literary, warm, precious. Used by editorial and luxury brands; nobody in AI photo tools has this. Apply at hero headlines, section titles, product name, and pricing display sizes.
- **Body:** [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) — Humanist, warm, very readable. Not generic. Has personality without distraction. Use for all body copy, UI labels, buttons, nav, and form elements.
- **UI/Labels:** Plus Jakarta Sans — keep consistent with body. Use weight 600 + `letter-spacing: 0.06em` + `text-transform: uppercase` for section labels and small caps-style callouts.
- **Data/Tables:** [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) with `font-variant-numeric: tabular-nums` — for credit balances, pricing, timestamps, era estimates, and any numerical data. Gives precision and a subtle analogue-tool reference.
- **Code:** JetBrains Mono
- **Loading:** Google Fonts CDN
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  ```
- **Scale:**
  | Token     | Size  | Usage                                    |
  |-----------|-------|------------------------------------------|
  | `text-xs` | 11px  | Captions, section labels, mono callouts  |
  | `text-sm` | 13px  | Table cells, secondary UI, hints         |
  | `text-md` | 15px  | Body copy default                        |
  | `text-lg` | 18px  | Lead text, subtitles                     |
  | `text-xl` | 22px  | Page titles, card headings               |
  | `text-2xl`| 28px  | Section headings                         |
  | `text-3xl`| 40px  | Hero subheadings                         |
  | `text-4xl`| 56px  | Hero headlines (clamp to viewport)       |
  | `text-5xl`| 80px  | Max display size (Fraunces)              |

## Color
- **Approach:** Balanced — cognac amber as the single accent, supported by a warm neutral system. Color is used with intention: the accent appears on CTAs, selected states, brand moments, and the "Restored" label on before/after sliders. It does not appear gratuitously.

### Light Mode
| Token               | Hex       | Usage                                               |
|---------------------|-----------|-----------------------------------------------------|
| `--accent`          | `#B5622A` | Primary CTA, selected states, brand accent          |
| `--accent-light`    | `#D4874E` | Hover states on accent elements                     |
| `--accent-dark`     | `#8A4520` | Pressed states, darkened accent text                |
| `--accent-muted`    | `#E8C5A8` | Accent background (badge, selected card, eyebrow)  |
| `--bg`              | `#FAF7F2` | Page background — archival cream                    |
| `--surface-1`       | `#F2EDE5` | Cards, sidebars, upload zone                        |
| `--surface-2`       | `#E8E0D4` | Hover states on surface-1                           |
| `--surface-3`       | `#DDD3C3` | Active states, pressed surfaces                     |
| `--n-100`           | `#EDE5D8` | Subtle borders, dividers                            |
| `--n-200`           | `#D9CDB8` | Default borders                                     |
| `--n-300`           | `#C9BAA8` | Input borders, stronger dividers                    |
| `--n-400`           | `#A89380` | Placeholder text                                    |
| `--n-500`           | `#8A7A6E` | Muted text                                          |
| `--n-600`           | `#6B5D52` | Secondary text                                      |
| `--n-700`           | `#4A3F35` | Default body text                                   |
| `--n-800`           | `#2E251D` | Dark text                                           |
| `--n-900`           | `#1C1410` | Primary text, dark surfaces                         |
| `--text-primary`    | `#1C1410` | Primary text                                        |
| `--text-secondary`  | `#4A3F35` | Secondary text                                      |
| `--text-muted`      | `#8A7A6E` | Muted/helper text                                   |
| `--text-inverse`    | `#FAF7F2` | Text on dark/accent backgrounds                     |

### Semantic
| Token            | Hex       |
|------------------|-----------|
| `--success`      | `#3D7A4F` |
| `--success-bg`   | `#E8F4EC` |
| `--warning`      | `#C17A2A` |
| `--warning-bg`   | `#FDF3E7` |
| `--error`        | `#B83B3B` |
| `--error-bg`     | `#FCEAEA` |
| `--info`         | `#2A5D8C` |
| `--info-bg`      | `#E8F0F8` |

### Dark Mode
Reduce saturation ~15% on accent, invert surfaces. Keep the warm undertone — avoid going blue-black.
| Token          | Hex       |
|----------------|-----------|
| `--bg`         | `#0E0B08` |
| `--surface-1`  | `#1C1410` |
| `--surface-2`  | `#2A1E17` |
| `--surface-3`  | `#382820` |
| `--accent`     | `#B5622A` (same — holds well on dark) |

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable — more generous than typical SaaS. The user is dealing with something emotionally significant. Don't rush them.
- **Scale:**
  | Token   | Value  |
  |---------|--------|
  | `sp-1`  | 4px    |
  | `sp-2`  | 8px    |
  | `sp-3`  | 12px   |
  | `sp-4`  | 16px   |
  | `sp-5`  | 24px   |
  | `sp-6`  | 32px   |
  | `sp-7`  | 48px   |
  | `sp-8`  | 64px   |
  | `sp-9`  | 96px   |
  | `sp-10` | 128px  |

## Layout
- **Approach:** Hybrid — editorial and expressive on marketing/landing pages (asymmetric grid, breathing room, grain texture), grid-disciplined on restore/app flows (focused, clean, efficient, no distractions during the core task).
- **Grid:** 12 columns. Max content width: 1140px. Side padding: 24px.
- **Breakpoints:** sm 640px / md 768px / lg 1024px / xl 1280px
- **Border radius (hierarchical):**
  | Token    | Value  | Usage                                    |
  |----------|--------|------------------------------------------|
  | `r-sm`   | 4px    | Badges, small chips                      |
  | `r-md`   | 8px    | Buttons, inputs, small cards             |
  | `r-lg`   | 12px   | Cards, panels, preset tiles              |
  | `r-xl`   | 16px   | App chrome, modals, large containers     |
  | `r-full` | 9999px | Pills, tags, avatars, credit badge       |

## Motion
- **Approach:** Intentional — transitions that aid comprehension and add ceremony to key moments. The before/after reveal and the restoration result "arriving" get special treatment.
- **Easing:**
  - Enter: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out — snappy start, smooth landing)
  - Exit: `cubic-bezier(0.4, 0, 1, 1)` (ease-in — quick departure)
  - Move: `cubic-bezier(0.4, 0, 0.2, 1)` (ease-in-out — balanced)
- **Duration:**
  | Token        | Value     | Usage                                |
  |--------------|-----------|--------------------------------------|
  | `dur-micro`  | 80ms      | Focus rings, checkbox ticks          |
  | `dur-short`  | 200ms     | Hover states, button presses         |
  | `dur-medium` | 350ms     | Panel transitions, modal appear      |
  | `dur-long`   | 600ms     | Result reveal, before/after slider   |
- **Special moments:**
  - Before/after slider handle: `transition: transform 600ms ease-out`
  - Restoration result reveal: fade in over 600ms with a 200ms delay — let it arrive
  - Upload zone on hover: border-color transition 200ms + subtle background shift
  - Credit balance update (post-purchase): count-up animation, 400ms

## Decoration
- **Film grain texture:** Apply to hero and marketing surfaces using an SVG filter or base64-encoded noise texture. `mix-blend-mode: multiply` in light mode, `screen` in dark mode. Opacity ~0.04–0.06 — subtle, not noisy.
- **App surfaces:** No grain. Keep the restore flow clean and focused.
- **Photography in UI:** When showing before/after examples, always use warm-toned imagery. Never cold, clinical, or stock-photo-blue.

## Design Anti-patterns (never do these)
- Purple/violet gradients as accent
- Generic feature grids with icons in colored circles
- Gradient buttons as primary CTA (use flat cognac `#B5622A`)
- Pure white `#FFFFFF` backgrounds — always use cream `#FAF7F2`
- Inter, Roboto, Montserrat, or Poppins as primary fonts
- Cold gray neutrals — all grays must have a warm golden undertone
- Centered-everything layouts on marketing pages — use editorial asymmetry

## Decisions Log
| Date       | Decision                                          | Rationale                                                                 |
|------------|---------------------------------------------------|---------------------------------------------------------------------------|
| 2026-03-18 | Initial design system created                     | Created by /design-consultation based on product context + competitive research |
| 2026-03-18 | Fraunces as display font                          | Optical serif differentiates from every AI photo tool using geometric sans; matches emotional register of old photographs |
| 2026-03-18 | Cognac amber `#B5622A` as accent                  | Unclaimed territory in the AI tools space; directly references darkroom chemistry and vintage photo warmth |
| 2026-03-18 | Archival cream `#FAF7F2` as background            | Warmer and more precious than clinical white; references archival paper and photo albums |
| 2026-03-18 | Comfortable spacing density (8px base)            | User is 35–55 dealing with emotionally significant content; product should feel unhurried |
| 2026-03-18 | Intentional decoration (film grain on marketing)  | References analogue photography; adds warmth without being noisy; keep app surfaces clean |
