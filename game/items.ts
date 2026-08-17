export type ItemKind = "good" | "bad";

export interface ItemDef {
  key: string;
  kind: ItemKind;
  points: number;
  size: number;
  /** relative spawn weight */
  weight: number;
  /** round/symmetric shapes can tumble freely without losing readability */
  tumbles?: boolean;
  /** shown in the catch popup, e.g. "Starburst® Tropical Watermelon" */
  label: string;
}

export const GOOD_ITEMS: ItemDef[] = [
  { key: "candy-pink", kind: "good", points: 10, size: 50, weight: 2, tumbles: true, label: "Starburst® Tropical Watermelon" },
  { key: "candy-orange", kind: "good", points: 10, size: 50, weight: 2, tumbles: true, label: "Starburst® Tropical Mango Melon" },
  { key: "candy-green", kind: "good", points: 10, size: 50, weight: 2, tumbles: true, label: "Starburst® Tropical Strawberry Kiwi" },
  { key: "candy-yellow", kind: "good", points: 10, size: 50, weight: 2, tumbles: true, label: "Starburst® Tropical Pineapple Orange" },
  { key: "hotel-key", kind: "good", points: 25, size: 96, weight: 2, label: "Hotel Key" },
  { key: "swimsuit", kind: "good", points: 20, size: 85, weight: 2, label: "Swimsuit" },
  { key: "seashell", kind: "good", points: 15, size: 59, weight: 2.5, label: "Seashell" },
  { key: "ring", kind: "good", points: 40, size: 62, weight: 1.2, label: "Diamond Ring" },
  { key: "credit-card", kind: "good", points: 20, size: 71, weight: 2, label: "Credit Card" },
  { key: "sunglasses", kind: "good", points: 30, size: 78, weight: 1.6, label: "Sunglasses" },
  { key: "innertube", kind: "good", points: 20, size: 63, weight: 2, tumbles: true, label: "Pool Float" },
  { key: "journal", kind: "good", points: 20, size: 80, weight: 1.8, label: "Travel Journal" },
];

export const BAD_ITEMS: ItemDef[] = [
  { key: "bad-fish", kind: "bad", points: -15, size: 76, weight: 2.2, label: "DEAD FISH" },
  { key: "bad-emoji", kind: "bad", points: -15, size: 52, weight: 2, tumbles: true, label: "Bad Vibes" },
  { key: "bad-email", kind: "bad", points: -15, size: 59, weight: 1.8, label: "Work Email" },
  { key: "bad-weather", kind: "bad", points: -15, size: 60, weight: 1.6, label: "Bad Weather" },
  { key: "bad-plane", kind: "bad", points: -15, size: 81, weight: 1.5, label: "Flight delay" },
];

export const ALL_ITEMS = [...GOOD_ITEMS, ...BAD_ITEMS];

export const ITEM_SIZE: Record<string, number> = Object.fromEntries(
  ALL_ITEMS.map((it) => [it.key, it.size])
);

export function pickWeighted(items: ItemDef[]): ItemDef {
  const total = items.reduce((sum, it) => sum + it.weight, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}
