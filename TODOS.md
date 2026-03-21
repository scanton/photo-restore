# TODOS

## P2 — Post-Launch

### Physical Print Ordering Integration
**What:** After download, CTA to order the restored photo as a print, canvas, or photo book page via Printful or Prodigi API.
**Why:** Purchase intent peaks right at the download moment. High-margin, zero-inventory revenue stream. Each physical product is a brand advertisement with the logo on the back.
**Pros:** Additional revenue stream with high emotional fit; word-of-mouth via physical product.
**Cons:** Fulfillment dependency, returns policy needed, print quality QA across partner printers.
**Context:** Deferred from v1 CEO review (2026-03-18). Core digital product must be stable and generating revenue before adding fulfillment complexity. Evaluate Printful vs Prodigi based on print quality and API maturity.
**Effort:** M (human: ~3 days / CC: ~25 min)
**Priority:** P2
**Depends on:** Stable core product with paying users, print partner selected and tested

---

### Genealogy Platform Integrations (Ancestry, FamilySearch, MyHeritage)
**What:** 'Save to Ancestry' / 'Save to FamilySearch' buttons post-restore. Restored photo pushes directly into user's family tree on partner platforms.
**Why:** Ancestry has 4M+ paying subscribers who are the exact target demographic. Integration = distribution partnership. Photos appearing in family trees drive referral virality (cousin sees it, clicks through).
**Pros:** Best available distribution channel; photos in family trees are viral by nature.
**Cons:** API access and partnership terms take time; some platforms may not have open APIs or may require business agreements.
**Context:** Deferred from v1 CEO review (2026-03-18). Build the integration hooks in the codebase early; flip the switch when partnership is secured. Priority is getting traffic metrics first to strengthen the partnership pitch.
**Effort:** M (human: ~2 days for integration / CC: ~20 min; partnership negotiation is separate)
**Priority:** P2
**Depends on:** Meaningful traffic/revenue metrics to present to partners; API access approval from each platform

---

### Referral Program — Refer a Friend, Get Credits
**What:** Every user gets a unique referral link. When a referred user makes their first purchase, the referrer earns bonus credits (e.g., 2 free restorations).
**Why:** Referral is the highest-ROI acquisition channel for consumer products with strong emotional outcomes. A restored family photo is inherently shareable.
**Pros:** Viral coefficient multiplier; self-funding (bonus credits only issued when referral converts); aligns incentives.
**Cons:** Fraud potential (fake accounts generating fake referrals); needs rate limiting and fraud detection logic.
**Context:** Deferred from v1 CEO review (2026-03-18). Design referral to require verified email + first real purchase to trigger reward — prevents most abuse.
**Effort:** M (human: ~2 days / CC: ~20 min)
**Priority:** P2
**Depends on:** Stable user + credit system; email verification flow in place

---

### Completion Email for Anonymous Users
**What:** At purchase, prompt anonymous users for an optional email address. After restoration completes (status = "complete"), send the download link to that address via Resend — no account required.
**Why:** Anonymous users are a significant top-of-funnel segment and currently have no fallback if they close the tab after purchasing. The photo is stored for 30 days; without an email link, it's effectively lost.
**Pros:** Captures revenue from users unwilling to create accounts; dramatically reduces "I lost my photo" support requests.
**Cons:** Requires storing the email on the restoration record and adding validation at purchase; increases Resend send volume for unverified addresses.
**Context:** Identified during /plan-eng-review (2026-03-20). The restoration pipeline sends email only when userId is non-null. Anonymous purchases set status = "complete" silently. Implement by adding an optional `notificationEmail` field to the purchase endpoint body and storing it on the restorations record.
**Effort:** S (human: ~1 day / CC: ~15 min)
**Priority:** P2
**Depends on:** Stable email flow for authenticated users (completed in restoration pipeline PR)

---

### kie.ai Retry Discrimination: 4xx vs 5xx
**What:** In `/api/jobs/restore` and `/api/jobs/restore-hires`, distinguish permanent kie.ai errors (inner code 402 = insufficient credits, 401 = bad API key) from transient errors (5xx = kie.ai downtime). On permanent errors, return 200 so QStash stops retrying and immediately fires the failure path.
**Why:** `createKieTask()` now throws on any non-200 inner code, so QStash retries all failures. But retrying a 402 (out of credits) wastes 3 API calls before the job dies — and leaves the user waiting. Faster failure detection = better UX.
**Pros:** Prevents wasted API calls and credit usage on permanent errors; faster failure detection post-launch.
**Cons:** Requires kie.ai's inner status codes to be reliable in production — not yet verified under real load.
**Context:** Inner json.code validation was added in feat/restoration-pipeline (2026-03-20). The remaining work is teaching the job routes to classify which codes are permanent vs transient. Revisit once we have real production error data from kie.ai callbacks.
**Effort:** XS (human: ~1 hr / CC: ~5 min)
**Priority:** P3
**Depends on:** Stable kie.ai API with predictable inner status codes in production

---

### Orphaned Blob Cleanup Job
**What:** A periodic job (cron or manual trigger) that lists Vercel Blob objects under `originals/` and cross-references them against the `restorations` table. Any blob with no corresponding DB record (or with a DB record at status="failed") older than 48 hours is deleted.
**Why:** When `qstash.publishJSON()` fails after a blob upload, the original image file is uploaded to Vercel Blob but the restoration is marked "failed". Over time these orphaned files accumulate and cost storage money (small but nonzero).
**Pros:** Keeps storage clean; prevents runaway costs at scale; blob storage cleanup is idempotent and safe.
**Cons:** Requires Vercel Blob list() pagination across potentially many objects; need to be careful not to delete blobs for very recent restorations still in-flight.
**Context:** Identified during /plan-eng-review (2026-03-20). The fix for QStash publish failure (upload route) correctly marks the restoration as "failed", but the blob file is still orphaned. Implement as a Next.js route handler protected by cron auth (`CRON_SECRET`), or as a Vercel cron job triggered daily. Cross-reference: `Blob.list({ prefix: "originals/" })` vs `db.select({ inputBlobUrl }).from(restorations)`.
**Effort:** S (human: ~1 day / CC: ~15 min)
**Priority:** P3
**Depends on:** Stable core product in production; meaningful upload volume to justify the cleanup overhead

---

### Developer API
**What:** Public REST API allowing photography studios, print shops, and genealogy services to integrate photo restoration into their own products. Per-call or subscription pricing for API access.
**Why:** B2B revenue channel with much higher LTV per customer than consumer. API customers bring their own distribution.
**Pros:** Opens B2B market; studios/shops have recurring high-volume needs that justify subscription.
**Cons:** API versioning, documentation, SLAs, and support burden.
**Context:** Surfaced during v1 CEO review (2026-03-18). Not surfaced as cherry-pick — deferred for post-launch.
**Effort:** L (human: ~1 week / CC: ~1 hour)
**Priority:** P3
**Depends on:** Proven product quality; stable internal API that can be exposed externally

---

### Family Album / Shared Gallery
**What:** Users can organize restored photos into named albums and share a read-only gallery link with family members.
**Why:** Increases retention (users come back to see and manage their collection) and drives word-of-mouth (sharing a gallery link is a referral).
**Pros:** Retention feature; natural referral mechanism.
**Cons:** Significant UX scope; storage complexity.
**Context:** Surfaced during v1 CEO review (2026-03-18). Part of the 10x platform vision. Build after proving single-photo restore.
**Effort:** L (human: ~2 weeks / CC: ~1.5 hours)
**Priority:** P3
**Depends on:** Stable user accounts; image storage system proven at scale

---

## Completed

### kie.ai Webhook Security + Failure Handling
**Completed:** feat/restoration-pipeline (2026-03-20)

Full kie.ai webhook hardening: (1) HMAC-SHA256 verification — `X-Webhook-Timestamp` + `X-Webhook-Signature` headers via `base64(HMAC-SHA256(taskId + "." + timestamp, webhookHmacKey))`; (2) ±5 min timestamp window to prevent replay attacks; (3) `data.state="fail"` handling — marks restoration as `"failed"` and returns 200 so kie.ai stops retrying (previously left restorations permanently stuck at "analyzing"); (4) inner `json.code` validation in `createKieTask()` — HTTP 200 with code=402 now throws descriptively. 174 tests passing.

---

### Billing UI, Resolution Picker + Analytics (v0.3.1.0 — 2026-03-19)
**Completed:** v0.3.1.0 (2026-03-19)

`/billing` page with credit pack and subscription cards (monthly/annual toggle), resolution picker on the restore page (1k/2k/4k with live credit cost), `POST /api/billing/portal` Customer Portal endpoint, and Vercel Analytics. The full purchase experience — from browsing plans through checkout to subscription management — is now accessible to users.

---

### QA Fixes — Auth Route, Error States, UUID Validation (2026-03-19)
**Completed:** /qa run on feat/scaffold (2026-03-20)

Four bugs found and fixed: (1) missing NextAuth API route caused all auth to fail silently; (2) restore page heading stuck on "Loading…" when an error occurred; (3) upload API returned 500 instead of 400 for malformed requests; (4) status/purchase routes returned 500 on non-UUID IDs. Health score 72 → 87. All 93 tests passing.

---

### Stripe Checkout + Credit Purchase Flow (v0.3.0.0 — 2026-03-19)
**Completed:** v0.3.0.0 (2026-03-19)

`POST /api/checkout/create`, `POST /api/restore/[id]/purchase`, `invoice.payment_succeeded` webhook handler, `src/lib/products.ts` product registry, and `resolution` column on `restorations`. 93 tests passing. The full payment funnel — from "Use Credits" / "Buy Credits" CTAs through Stripe Checkout to monthly subscription renewal — is now wired.
