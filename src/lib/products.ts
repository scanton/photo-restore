// Source of truth for Stripe products and credit amounts.
// Price IDs come from the Stripe Dashboard — never trust client-supplied values.
// Keep in sync with: https://dashboard.stripe.com/products
//
// Credit-to-render mapping:
//   1 credit = 1K render  ($0.04 cost → $0.50 user price, 92% margin)
//   2 credits = 2K render ($0.06 cost → $1.00 user price, 94% margin)
//   3 credits = 4K render ($0.09 cost → $1.50 user price, 94% margin)

export const CREDIT_PACKS = [
  {
    priceId: "price_1TCsI0E49NyEBPDXLXXYQmue",
    productId: "prod_UBEl2bD0YGMH2u",
    name: "Starter Pack",
    credits: 10,
    price: 4.99,
    type: "one_time" as const,
  },
  {
    priceId: "price_1TCsJcE49NyEBPDX82490PyM",
    productId: "prod_UBEnAnfSodmdpD",
    name: "Power Pack",
    credits: 20,
    price: 9.99,
    type: "one_time" as const,
  },
  {
    priceId: "price_1TCsKfE49NyEBPDXMuHGNQYu",
    productId: "prod_UBEoOcfzo3stUi",
    name: "Value Pack",
    credits: 55,
    price: 24.99,
    type: "one_time" as const,
  },
] as const;

export const SUBSCRIPTIONS = [
  {
    priceId: "price_1TCsMjE49NyEBPDXNBEpezO1",
    productId: "prod_UBEqWrQ3LCkZVR",
    name: "Hobbyist (Monthly)",
    creditsPerMonth: 25,
    price: 9.99,
    interval: "month" as const,
  },
  {
    priceId: "price_1TCsO6E49NyEBPDXfVLc0S7R",
    productId: "prod_UBErmFbNwrlYhb",
    name: "Professional (Monthly)",
    creditsPerMonth: 60,
    price: 19.99,
    interval: "month" as const,
  },
  {
    priceId: "price_1TCsPbE49NyEBPDXtQwSYS21",
    productId: "prod_UBEth4VfIpFrAq",
    name: "Hobbyist (Annual)",
    creditsPerMonth: 25,
    price: 107.89,
    interval: "year" as const,
  },
  {
    priceId: "price_1TCsQTE49NyEBPDXXkIoVUfl",
    productId: "prod_UBEulXI58fsrmq",
    name: "Professional (Annual)",
    creditsPerMonth: 60,
    price: 215.89,
    interval: "year" as const,
  },
] as const;

export type CreditPack = (typeof CREDIT_PACKS)[number];
export type Subscription = (typeof SUBSCRIPTIONS)[number];
export type Product = CreditPack | Subscription;

/** Look up a product by Stripe price ID. Returns null for unknown IDs. */
export function getProductByPriceId(priceId: string): Product | null {
  return (
    ([...CREDIT_PACKS, ...SUBSCRIPTIONS] as Product[]).find(
      (p) => p.priceId === priceId
    ) ?? null
  );
}

/** Type guard: is this product a one-time credit pack? */
export function isCreditPack(product: Product): product is CreditPack {
  return "type" in product && product.type === "one_time";
}

/** Type guard: is this product a subscription? */
export function isSubscription(product: Product): product is Subscription {
  return "interval" in product;
}

/** All valid Stripe price IDs — used to validate incoming priceId params. */
export const VALID_PRICE_IDS = new Set<string>([
  ...CREDIT_PACKS.map((p) => p.priceId),
  ...SUBSCRIPTIONS.map((p) => p.priceId),
]);
