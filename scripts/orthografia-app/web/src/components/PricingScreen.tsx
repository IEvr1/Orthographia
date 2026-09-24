import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { useState } from "react";
import type { PlanTier } from "../lib/access";
import { tierLabel } from "../lib/access";
import { isClerkEnabled } from "../lib/subscription";

type CheckoutPlan = "monthly" | "yearly" | "family";

interface PricingScreenProps {
  onBack: () => void;
  tier: PlanTier;
  active: boolean;
  currentPeriodEnd: string | null;
  startCheckout?: (plan: CheckoutPlan) => Promise<string | null>;
  openPortal?: () => Promise<string | null>;
}

const PLANS: Array<{
  id: CheckoutPlan;
  title: string;
  price: string;
  period: string;
  features: string[];
  highlight?: boolean;
}> = [
  {
    id: "yearly",
    title: "Premium — 1 παιδί",
    price: "€39",
    period: "/ έτος",
    highlight: true,
    features: [
      "Όλες οι τάξεις (Β΄–Στ΄)",
      "Όλοι οι τρόποι εξάσκησης",
      "Απεριόριστη εξάσκηση",
      "Συγχρονισμός με άλλες συσκευές",
    ],
  },
  {
    id: "monthly",
    title: "Premium — μηνιαία",
    price: "€4,90",
    period: "/ μήνα",
    features: [
      "Ίδια δυνατότητες με το ετήσιο",
      "Ακύρωση ανά πάσα στιγμή",
    ],
  },
  {
    id: "family",
    title: "Οικογενειακό (2–3 παιδιά)",
    price: "€59",
    period: "/ έτος",
    features: [
      "Έως 3 προφίλ παιδιών",
      "Πλήρης πρόσβαση για κάθε παιδί",
      "Συγχρονισμός με άλλες συσκευές",
    ],
  },
];

function formatPeriodEnd(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("el-GR");
}

export function PricingScreen({
  onBack,
  tier,
  active,
  currentPeriodEnd,
  startCheckout,
  openPortal,
}: PricingScreenProps) {
  const [busy, setBusy] = useState<CheckoutPlan | "portal" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleCheckout = async (plan: CheckoutPlan) => {
    if (!startCheckout) return;
    setMessage(null);
    setBusy(plan);
    try {
      const url = await startCheckout(plan);
      if (url) window.location.href = url;
      else setMessage("Δεν ήταν δυνατή η έναρξη πληρωμής.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Σφάλμα πληρωμής");
    } finally {
      setBusy(null);
    }
  };

  const handlePortal = async () => {
    if (!openPortal) return;
    setMessage(null);
    setBusy("portal");
    try {
      const url = await openPortal();
      if (url) window.location.href = url;
      else setMessage("Δεν βρέθηκε ενεργή συνδρομή.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Σφάλμα");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="screen screen--pricing fade-in">
      <div className="pricing-header">
        <button type="button" className="btn-text" onClick={onBack}>
          ← Πίσω
        </button>
        {isClerkEnabled() && (
          <div className="pricing-auth">
            <SignedOut>
              <SignInButton mode="modal">
                <button type="button" className="btn-text">
                  Σύνδεση
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        )}
      </div>

      <div className="hero">
        <p className="brand">Ορθογραφία</p>
        <h1 className="hero-title">Επέλεξε το πλάνο σου</h1>
      </div>

      <div className="plan-status">
        <p>
          Τρέχον πλάνο: <strong>{tierLabel(tier)}</strong>
          {active && currentPeriodEnd && (
            <> · έως {formatPeriodEnd(currentPeriodEnd)}</>
          )}
        </p>
        {active && openPortal && (
          <button
            type="button"
            className="btn-text"
            disabled={busy === "portal"}
            onClick={() => void handlePortal()}
          >
            Διαχείριση συνδρομής
          </button>
        )}
      </div>

      {message && <p className="error-msg">{message}</p>}

      <div className="pricing-grid">
        {PLANS.map((plan) => (
          <article
            key={plan.id}
            className={`pricing-card${plan.highlight ? " pricing-card--highlight" : ""}`}
          >
            <h2 className="pricing-card-title">{plan.title}</h2>
            <p className="pricing-card-price">
              {plan.price}
              <span>{plan.period}</span>
            </p>
            <ul className="pricing-card-features">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            {isClerkEnabled() ? (
              <>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button type="button" className="btn btn-secondary btn-xl">
                      Σύνδεση
                    </button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <button
                    type="button"
                    className="btn btn-primary btn-xl"
                    disabled={busy !== null || !startCheckout || (active && plan.id !== "family")}
                    onClick={() => void handleCheckout(plan.id)}
                  >
                    {busy === plan.id ? "Μετάβαση…" : active ? "Αλλαγή πλάνου" : "Επιλογή"}
                  </button>
                </SignedIn>
              </>
            ) : (
              <p className="hint-text">Ρύθμισε Clerk για online πληρωμές.</p>
            )}
          </article>
        ))}
      </div>

      <p className="pricing-footnote">
        Οι πρώτες 5 ημέρες είναι δωρεάν με πλήρη πρόσβαση. Η πληρωμή γίνεται με
        ασφάλεια μέσω Stripe. Χωρίς διαφημίσεις για παιδιά.
      </p>
    </main>
  );
}
