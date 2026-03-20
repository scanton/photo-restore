/**
 * lib/openrouter.ts
 *
 * Era estimation via OpenRouter (google/gemini-flash-1.5).
 *
 * Best-effort: any failure returns null and the pipeline continues.
 * The restore page handles a null eraEstimate gracefully.
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  POST openrouter.ai/api/v1/chat/completions              │
 *   │  model: google/gemini-flash-1.5                          │
 *   │  content: [image_url, text prompt asking for JSON]       │
 *   │    ├─ throws / times out (15s) → return null (silent)    │
 *   │    ├─ non-2xx → return null (silent)                     │
 *   │    ├─ JSON parse fails → return null (silent)            │
 *   │    └─ ok → return { era: "1950s", confidence: 0.85 }     │
 *   └──────────────────────────────────────────────────────────┘
 */

export interface EraResult {
  /** Decade string, e.g. "1950s" */
  era: string;
  /** Confidence score 0–1 */
  confidence: number;
}

/**
 * Estimates the decade a photograph was taken by passing the image URL
 * to a vision model on OpenRouter.
 *
 * Returns null on any failure — never throws.
 */
export async function estimateEra(imageUrl: string): Promise<EraResult | null> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        model: "google/gemini-flash-1.5",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
              {
                type: "text",
                text: [
                  "Analyze this photograph and estimate the decade it was taken.",
                  'Respond with JSON only, no explanation: {"era": "1950s", "confidence": 0.85}',
                  'Use decade strings like "1920s", "1930s", "1940s", etc.',
                  "Confidence is a number between 0 and 1.",
                ].join(" "),
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return null;

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    let parsed: { era?: string; confidence?: number };
    try {
      parsed = JSON.parse(content) as { era?: string; confidence?: number };
    } catch {
      return null;
    }

    if (!parsed.era || typeof parsed.confidence !== "number") return null;

    return {
      era: String(parsed.era).slice(0, 50),                         // cap LLM string length
      confidence: Math.min(1, Math.max(0, parsed.confidence)),      // clamp to [0, 1]
    };
  } catch {
    // Network error, timeout, unexpected error — all silent
    return null;
  }
}
