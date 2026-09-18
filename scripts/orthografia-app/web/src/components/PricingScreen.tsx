import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { useState } from "react";
import type { PlanTier } from "../lib/access";
import { tierLabel } from "../lib/access";
import { isClerkEnabled, useSubscription } from "../lib/subscription";

type CheckoutPlan = "monthly" | "yearly" | "family";

interface PricingScreenProps {
  onBack: () => void;
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
      "Όλες οι τάξεις (Α΄–Στ΄)",
      "Όλοι οι τρόποι εξάσκησης",
      "Απεριόριστη εξάσκηση",
      "Συγχρονισμός cloud",
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
      "Συγχρονισμός cloud",
    ],
  },
];

function formatPeriodEnd(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("el-GR");
}

export function PricingScreen({ onBack }: PricingScreenProps) {
  const subscription = useSubscription();
  const [busy, setBusy] = useState<CheckoutPlan | "portal" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleCheckout = async (plan: CheckoutPlan) => {
    setMessage(null);
    setBusy(plan);
    try {
      const url = await subscription.startCheckout(plan);
      if (url) window.location.href = url;
      else setMessage("Δεν ήταν δυνατή η έναρξη πληρωμής.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Σφάλμα πληρωμής");
    } finally {
      setBusy(null);
    }
  };

  const handlePortal = async () => {
    setMessage(null);
    setBusy("portal");
    try {
      const url = await subscription.openPortal();
      if (url) window.location.href = url;
      else setMessage("Δεν βρέθηκε ενεργή συνδρομή.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Σφάλμα");
    } finally {
      setBusy(null);
    }
  };

  const tier = subscription.tier as PlanTier;

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
        <p className="hero-sub">
          Δωρεάν δοκιμή με Α΄–Β΄ τάξη. Premium για πλήρη πρόσβαση χωρίς διαφημίσεις.
        </p>
      </div>

      <div className="plan-status">
        <p>
          Τρέχον πλάνο: <strong>{tierLabel(tier)}</strong>
          {subscription.active && subscription.currentPeriodEnd && (
            <> · έως {formatPeriodEnd(subscription.currentPeriodEnd)}</>
          )}
        </p>
        {subscription.active && (
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
                      Σύνδεση για αγορά
                    </button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <button
                    type="button"
                    className="btn btn-primary btn-xl"
                    disabled={busy !== null || (subscription.active && plan.id !== "family")}
                    onClick={() => void handleCheckout(plan.id)}
                  >
                    {busy === plan.id ? "Μετάβαση…" : subscription.active ? "Αλλαγή πλάνου" : "Επιλογή"}
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
        Η πληρωμή γίνεται με ασφάλεια μέσω Stripe. Χωρίς διαφημίσεις για παιδιά.
      </p>
    </main>
  );
}
