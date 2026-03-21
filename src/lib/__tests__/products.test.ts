import { describe, it, expect } from "vitest";
import {
  CREDIT_PACKS,
  SUBSCRIPTIONS,
  VALID_PRICE_IDS,
  getProductByPriceId,
  isCreditPack,
  isSubscription,
} from "@/lib/products";

describe("products.ts", () => {
  // ── CREDIT_PACKS ──────────────────────────────────────────────────────────

  describe("CREDIT_PACKS", () => {
    it("has 3 packs", () => {
      expect(CREDIT_PACKS).toHaveLength(3);
    });

    it("Starter Pack: 10 credits at $4.99", () => {
      const starter = CREDIT_PACKS.find((p) => p.name === "Starter Pack");
      expect(starter).toBeDefined();
      expect(starter?.credits).toBe(10);
      expect(starter?.price).toBe(4.99);
      expect(starter?.type).toBe("one_time");
    });

    it("Power Pack: 20 credits at $9.99", () => {
      const power = CREDIT_PACKS.find((p) => p.name === "Power Pack");
      expect(power?.credits).toBe(20);
      expect(power?.price).toBe(9.99);
    });

    it("Value Pack: 55 credits at $24.99", () => {
      const value = CREDIT_PACKS.find((p) => p.name === "Value Pack");
      expect(value?.credits).toBe(55);
      expect(value?.price).toBe(24.99);
    });

    it("all packs have valid Stripe price IDs (price_ prefix)", () => {
      for (const pack of CREDIT_PACKS) {
        expect(pack.priceId).toMatch(/^price_/);
      }
    });
  });

  // ── SUBSCRIPTIONS ─────────────────────────────────────────────────────────

  describe("SUBSCRIPTIONS", () => {
    it("has 4 subscription tiers", () => {
      expect(SUBSCRIPTIONS).toHaveLength(4);
    });

    it("Hobbyist Monthly: 25 credits/mo at $9.99", () => {
      const tier = SUBSCRIPTIONS.find(
        (s) => s.name === "Hobbyist (Monthly)"
      );
      expect(tier?.creditsPerMonth).toBe(25);
      expect(tier?.price).toBe(9.99);
      expect(tier?.interval).toBe("month");
    });

    it("Professional Monthly: 60 credits/mo at $19.99", () => {
      const tier = SUBSCRIPTIONS.find(
        (s) => s.name === "Professional (Monthly)"
      );
      expect(tier?.creditsPerMonth).toBe(60);
      expect(tier?.price).toBe(19.99);
    });

    it("Hobbyist Annual: 25 credits/mo at $107.89", () => {
      const tier = SUBSCRIPTIONS.find(
        (s) => s.name === "Hobbyist (Annual)"
      );
      expect(tier?.creditsPerMonth).toBe(25);
      expect(tier?.price).toBe(107.89);
      expect(tier?.interval).toBe("year");
    });

    it("Professional Annual: 60 credits/mo at $215.89", () => {
      const tier = SUBSCRIPTIONS.find(
        (s) => s.name === "Professional (Annual)"
      );
      expect(tier?.creditsPerMonth).toBe(60);
      expect(tier?.price).toBe(215.89);
    });

    it("all subscriptions have valid Stripe price IDs (price_ prefix)", () => {
      for (const sub of SUBSCRIPTIONS) {
        expect(sub.priceId).toMatch(/^price_/);
      }
    });
  });

  // ── getProductByPriceId ───────────────────────────────────────────────────

  describe("getProductByPriceId", () => {
    it("returns the correct pack for a valid pack price ID", () => {
      const product = getProductByPriceId(
        "price_1TCsI0E49NyEBPDXLXXYQmue"
      );
      expect(product).not.toBeNull();
      expect(product?.name).toBe("Starter Pack");
    });

    it("returns the correct subscription for a valid subscription price ID", () => {
      const product = getProductByPriceId(
        "price_1TCsMjE49NyEBPDXNBEpezO1"
      );
      expect(product).not.toBeNull();
      expect(product?.name).toBe("Hobbyist (Monthly)");
    });

    it("returns null for an unknown price ID", () => {
      expect(getProductByPriceId("price_UNKNOWN_123")).toBeNull();
    });

    it("returns null for an empty string", () => {
      expect(getProductByPriceId("")).toBeNull();
    });

    it("covers all 7 price IDs in VALID_PRICE_IDS", () => {
      for (const priceId of VALID_PRICE_IDS) {
        expect(getProductByPriceId(priceId)).not.toBeNull();
      }
    });
  });

  // ── Type guards ───────────────────────────────────────────────────────────

  describe("isCreditPack", () => {
    it("returns true for a credit pack", () => {
      expect(isCreditPack(CREDIT_PACKS[0])).toBe(true);
    });

    it("returns false for a subscription", () => {
      expect(isCreditPack(SUBSCRIPTIONS[0])).toBe(false);
    });
  });

  describe("isSubscription", () => {
    it("returns true for a subscription", () => {
      expect(isSubscription(SUBSCRIPTIONS[0])).toBe(true);
    });

    it("returns false for a credit pack", () => {
      expect(isSubscription(CREDIT_PACKS[0])).toBe(false);
    });
  });

  // ── VALID_PRICE_IDS ───────────────────────────────────────────────────────

  describe("VALID_PRICE_IDS", () => {
    it("contains exactly 8 price IDs (3 packs + 4 subscriptions + 1 single download)", () => {
      expect(VALID_PRICE_IDS.size).toBe(8);
    });

    it("all IDs are unique (no duplicates)", () => {
      const allIds = [
        ...CREDIT_PACKS.map((p) => p.priceId),
        ...SUBSCRIPTIONS.map((p) => p.priceId),
      ];
      expect(new Set(allIds).size).toBe(allIds.length);
    });

    it("accepts known valid price IDs", () => {
      expect(VALID_PRICE_IDS.has("price_1TCsI0E49NyEBPDXLXXYQmue")).toBe(true);
      expect(VALID_PRICE_IDS.has("price_1TCsQTE49NyEBPDXXkIoVUfl")).toBe(true);
    });

    it("rejects unknown price IDs", () => {
      expect(VALID_PRICE_IDS.has("price_FAKE")).toBe(false);
      expect(VALID_PRICE_IDS.has("")).toBe(false);
    });
  });
});
