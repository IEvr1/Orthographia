# Content Pipeline — Ορθογραφία

Παράγει `words.json` και mp3 ήχο για την PWA.

## 1. Seed λέξεων

```powershell
cd scripts/orthografia-app/content-pipeline
..\..\..\.venv\Scripts\python.exe generate_seed.py
```

Παράγει `words.json` v2 (Β΄/Γ΄/Δ΄) και το συγχρονίζει στο `web/public/content/`.

Για νέες λέξεις χωρίς mp3, τρέξε αργότερα `generate_audio.py` (χωρίς `--force` δημιουργεί μόνο τα νέα).

### HelexKids import (προαιρετικό)

Δες `inputs/README.md` και `import_helexkids.py`.

## 2. Google Cloud TTS — ρύθμιση (μία φορά)

### Βήμα Α: Project & API

1. Άνοιξε [Google Cloud Console](https://console.cloud.google.com/)
2. Δημιούργησε project (π.χ. `orthografia-tts`) ή διάλεξε υπάρχον
3. **APIs & Services → Library** → αναζήτησε **Cloud Text-to-Speech API** → **Enable**
4. **APIs & Services → Billing** → σύνδεσε billing account (υπάρχει free tier ~4M chars/μήνα)

### Βήμα Β: API key

1. **APIs & Services → Credentials → Create credentials → API key**
2. (Προαιρετικό αλλά συνιστάται) **Restrict key**:
   - Application restrictions: None (για local dev) ή IP αν deploy
   - API restrictions: **Cloud Text-to-Speech API** μόνο
3. Αντίγραψε το κλειδί

### Βήμα Γ: `.env.local`

Στο root `Orthographia/` (δίπλα στο `.gitignore`):

```env
GOOGLE_TTS_API_KEY=AIza...το-κλειδί-σου
```

> **Μην** κάνεις commit το `.env.local` — είναι ήδη στο `.gitignore`.

## 3. Παραγωγή ήχου

```powershell
# Από root Orthographia
.venv\Scripts\pip.exe install -r scripts/orthografia-app/content-pipeline/requirements.txt

cd scripts/orthografia-app/content-pipeline
..\..\..\.venv\Scripts\python.exe generate_audio.py --force
```

Το `--force` ξαναφτιάχνει όλα τα mp3 (χρειάζεται μετά την πρώτη ρύθμιση για να αντικαταστήσει τα silent wav).

## 4. Τρέξε την εφαρμογή

```powershell
cd ../web
npm run dev
```

Κάνε refresh και πάτα **«Άκου ξανά»**.

## Αντιμετώπιση προβλημάτων

| Σφάλμα | Λύση |
|--------|------|
| `403 API key not valid` | Λάθος κλειδί ή API δεν enabled |
| `403 Cloud Text-to-Speech API has not been used` | Enable το API (Βήμα Α.3) |
| `400 billing` | Ενεργοποίησε billing στο project |
| Δεν ακούς τίποτα | Τρέξε `generate_audio.py --force` και refresh browser |

## Azure (εναλλακτικά)

```env
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=westeurope
```

Χρειάζεται: `pip install azure-cognitiveservices-speech`
