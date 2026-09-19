# Ορθογραφία Web — Stripe, Clerk, GDPR

## Περιβάλλον (.env.local)

Αντίγραψε `.env.example` σε `.env.local` και συμπλήρωσε:

| Μεταβλητή | Πού |
|-----------|-----|
| `DATABASE_URL` | Neon (Vercel Storage ή `vercel env pull`) |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks (μετά τη δημιουργία endpoint) |
| `STRIPE_PRICE_MONTHLY` | Stripe Product price ID (€4,90/μήνα) |
| `STRIPE_PRICE_YEARLY` | Stripe Product price ID (€39/έτος) |
| `STRIPE_PRICE_FAMILY_YEARLY` | Stripe Product price ID (€59/έτος) |
| `SUPER_ADMIN_EMAIL` | Email με πλήρη πρόσβαση (server API) |
| `VITE_SUPER_ADMIN_EMAIL` | Ίδιο email για client-side badge/έλεγχο |

Ο super admin (`mustrene@gmail.com` by default στο `.env.example`) παίρνει οικογενειακό πλάνο χωρίς Stripe συνδρομή.

## Stripe Dashboard — checklist

1. **Products & Prices** (λειτουργία Subscriptions):
   - «Premium Child Monthly» — €4,90 / month recurring
   - «Premium Child Yearly» — €39 / year recurring
   - «Family Yearly» — €59 / year recurring
2. Αντιγράψε τα `price_…` IDs στα env vars παραπάνω.
3. **Webhooks** → Add endpoint:
   - URL: `https://<your-vercel-domain>/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Αντιγράψε το signing secret → `STRIPE_WEBHOOK_SECRET`
4. **Customer Portal** (Settings → Billing): ενεργοποίησε για ακυρώσεις/αλλαγές πλάνου.
5. Τοπικά webhook testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

## Clerk

1. Δημιούργησε εφαρμογή στο [Clerk Dashboard](https://dashboard.clerk.com).
2. Ρύθμισε sign-up/sign-in (email ή social).
3. Βάλε τα keys στο `.env.local` και στο Vercel Environment Variables.

## GDPR / συγκατάθεση γονέα

- Πριν την πρώτη χρήση: οθόνη συγκατάθεσης (localStorage `privacy-v1`).
- Μετά τη σύνδεση γονέα: καταγραφή στη βάση (`parental_consents`).
- Σελίδες: `/privacy`, `/terms`.

## Τοπική ανάπτυξη

```powershell
cd scripts/orthografia-app/web
npm install
npm run db:init   # απαιτεί DATABASE_URL
npm run dev:api   # Terminal 1 — Vercel dev (API + frontend)
# ή: vercel dev + npm run dev (proxy /api)
```

## API endpoints

| Route | Λειτουργία |
|-------|------------|
| `GET/PUT /api/progress/:deviceId` | Cloud sync προόδου |
| `GET/POST /api/subscription/status` | Κατάσταση συνδρομής + child profiles |
| `POST /api/stripe/checkout` | Stripe Checkout session |
| `POST /api/stripe/portal` | Billing portal |
| `POST /api/stripe/webhook` | Stripe lifecycle events |
| `GET/POST /api/consent` | Καταγραφή συγκατάθεσης γονέα |
