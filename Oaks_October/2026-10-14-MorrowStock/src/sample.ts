// Original reproducible synthetic cases. Seed 141022; no people or commercial data.
export function sample() {
  let state = 141022;
  const random = () =>
    (state = (1664525 * state + 1013904223) >>> 0) / 4294967296;
  const skus = ["APPLE", "LEAF", "ROOT", "CITRUS"];
  return {
    lots: Array.from({ length: 12 }, (_, i) => ({
      id: `LOT-${String(i + 1).padStart(2, "0")}`,
      sku: skus[i % 4],
      quantity: 4 + Math.floor(random() * 8),
      arrival: i < 8 ? 0 : 2,
      expiry: 2 + Math.floor(random() * 5),
      location: i % 5,
    })),
    orders: Array.from({ length: 12 }, (_, i) => ({
      id: `ORDER-${String(i + 1).padStart(2, "0")}`,
      sku: skus[i % 4],
      quantity: 6 + Math.floor(random() * 8),
      due: 1 + Math.floor(random() * 5),
      priority: 1 + Math.floor(random() * 5),
      location: (i + 2) % 5,
    })),
  };
}
