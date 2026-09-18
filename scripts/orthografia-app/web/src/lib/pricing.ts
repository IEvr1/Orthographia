export type PlanId = "child_annual" | "child_monthly" | "family_annual";

export interface PricingPlan {
  id: PlanId;
  title: string;
  price: string;
  period: string;
  description: string;
  highlight?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "child_annual",
    title: "Παιδικό — Ετήσιο",
    price: "39€",
    period: "/ έτος",
    description: "Πλήρης πρόσβαση για ένα παιδί. Εξοικονόμηση έναντι μηνιαίας.",
    highlight: true,
  },
  {
    id: "child_monthly",
    title: "Παιδικό — Μηνιαίο",
    price: "4,90€",
    period: "/ μήνα",
    description: "Πλήρης πρόσβαση, ακύρωση ανά πάσα στιγμή.",
  },
  {
    id: "family_annual",
    title: "Οικογενειακό — Ετήσιο",
    price: "59€",
    period: "/ έτος",
    description: "Έως 3 προφίλ παιδιών (2–3 παιδιά) στον ίδιο λογαριασμό.",
  },
];

/** Grades available without premium subscription */
export const FREE_GRADES = new Set([1, 2]);
