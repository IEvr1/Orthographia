# Ορθογραφία — MVP PWA

Εφαρμογή εξάσκησης για εκμάθηση ελληνικής ορθογραφίας (Β΄–Στ΄ Δημοτικού, ΚΝΕ).

## Γρήγορη εκκίνηση

```powershell
# 1. Python venv + deps
cd c:\AI_apps\Orthographia
python -m venv .venv
.venv\Scripts\pip.exe install -r scripts/orthografia-app/content-pipeline/requirements.txt

# 2. Βάλε GOOGLE_TTS_API_KEY στο .env.local (δες content-pipeline/README.md)

# 3. (Προαιρετικό) Σχολικά λεξικά από PDF στο Downloads
.venv\Scripts\python.exe scripts/orthografia-app/content-pipeline/extract_lexikon.py

# 4. Seed + audio (μόνο νέες λέξεις, όχι --force εκτός αν χρειάζεται)
.venv\Scripts\python.exe scripts/orthografia-app/content-pipeline/generate_seed.py
.venv\Scripts\python.exe scripts/orthografia-app/content-pipeline/generate_audio.py
# Χωρίς API key: ... generate_audio.py --placeholder

# 5. Web
cd scripts/orthografia-app/web
npm install
npm run dev
```

**Οδηγός Google TTS:** [content-pipeline/README.md](content-pipeline/README.md)

## Build PWA

```powershell
cd scripts/orthografia-app/web
npm run build
npm run preview
```

## Λειτουργίες

- Τάξεις Β΄–Στ΄, 2 τρόποι εξάσκησης (πρόταση, επιλογή)
- **Κανόνας της εβδομάδας** — 5 λέξεις ανά ενότητα κανόνα
- **FSRS** επανάληψη (ts-fsrs) + cloud sync προόδου
- Προαιρετική εβδομαδιαία σύνοψη email στον γονέα (opt-in στις Ρυθμίσεις, default off)
- Κανόνες ορθογραφίας, οικογένειες λέξεων, mini-λεξικό μετά από λάθος
- Πηγές: HelexKids, Γλώσσα Β΄, σχολικά λεξικά ΑΒΓ/ΔΕΣΤ, Γραμματική Ε-ΣΤ

### Cloud sync προόδου (Vercel + Neon Postgres)

Το backend είναι serverless API στο Vercel με αποθήκευση σε Neon DB.

- **Χωρίς λογαριασμό:** ανώνυμο `deviceId` ανά συσκευή (όπως πριν)
- **Με λογαριασμό Clerk:** η πρόοδος συγχρονίζεται με το `userId` του Clerk σε όλες τις συσκευές

**Deploy (μία φορά):**

1. Στο [Vercel Dashboard](https://vercel.com) → New Project → repo `Orthographia`, root directory `scripts/orthografia-app/web`
2. Storage → Connect **Neon Postgres** (δημιουργεί `DATABASE_URL` αυτόματα)
3. Deploy

**Τοπικά με API:**

```powershell
cd scripts/orthografia-app/web
npm install
# Βάλε DATABASE_URL στο .env.local (Pull από Vercel: vercel env pull)
npm run db:init

# Terminal 1 — API + frontend
npm run dev:api

# Ή: Terminal 1 `vercel dev`, Terminal 2 `npm run dev` (proxy /api → :3000)
```

Στο production το κουμπί «Συγχρονισμός cloud» καλεί `/api/progress/{ownerId}` (`deviceId` ή `user_…`).

### Λογαριασμοί (Clerk)

Η εφαρμογή χρησιμοποιεί [Clerk](https://clerk.com) για σύνδεση/εγγραφή (κουμπιά «Σύνδεση» / «Εγγραφή» στην αρχική).

**1. Δημιουργία εφαρμογής Clerk**

1. [dashboard.clerk.com](https://dashboard.clerk.com) → **Add application** (π.χ. «Ορθογραφία»)
2. Επίλεξε τρόπους σύνδεσης (email, Google, κ.λπ.)
3. **API Keys** → αντιγράψε:
   - **Publishable key** → `VITE_CLERK_PUBLISHABLE_KEY`
   - **Secret key** → `CLERK_SECRET_KEY` (μόνο server-side)

**2. Τοπική ανάπτυξη**

Αντίγραψε `scripts/orthografia-app/web/.env.example` σε `.env.local` και συμπλήρωσε:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
DATABASE_URL=postgresql://...
```

Για frontend + API με auth:

```powershell
# Terminal 1
npm run dev:api

# Terminal 2
npm run dev
```

**3. Vercel (production)**

Στο Vercel project → **Settings → Environment Variables**:

| Μεταβλητή | Περιβάλλον |
|-----------|------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Production, Preview, Development |
| `CLERK_SECRET_KEY` | Production, Preview, Development |
| `DATABASE_URL` | (από Neon integration) |

Εναλλακτικά: Vercel Marketplace → **Clerk** (`vercel integration add clerk`) για αυτόματη ρύθμιση κλειδιών.

**Σημείωση:** Χωρίς `VITE_CLERK_PUBLISHABLE_KEY` η εφαρμογή λειτουργεί κανονικά χωρίς UI σύνδεσης (μόνο ανώνυμο sync).

### Συνδρομές (Stripe)

Πλάνα: **€39/έτος** ή **€4,90/μήνα** ανά παιδί, **€59/έτος** οικογενειακό (2–3 παιδιά).

**1. Stripe Dashboard**

1. [dashboard.stripe.com](https://dashboard.stripe.com) → Products → δημιούργησε 3 recurring prices (EUR)
2. Αντίγραψε τα `price_…` IDs
3. **Developers → Webhooks** → endpoint `https://<your-app>/api/stripe/webhook`  
   Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

**2. Μεταβλητές Vercel**

| Μεταβλητή | Περιγραφή |
|-----------|-----------|
| `STRIPE_SECRET_KEY` | Secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `STRIPE_PRICE_MONTHLY` | €4,90/μήνα |
| `STRIPE_PRICE_YEARLY` | €39/έτος |
| `STRIPE_PRICE_FAMILY_YEARLY` | €59/έτος |

**3. Schema βάσης**

```powershell
cd scripts/orthografia-app/web
npm run db:init
```

### GDPR — συγκατάθεση γονέα

Πριν την πρώτη χρήση εμφανίζεται οθόνη συγκατάθεσης. Μετά τη σύνδεση Clerk, η συγκατάθεση αποθηκεύεται στον server (`/api/consent`). Νομικά κείμενα: `/privacy`, `/terms`.

## Μετά το MVP

1. GreekLex integration
