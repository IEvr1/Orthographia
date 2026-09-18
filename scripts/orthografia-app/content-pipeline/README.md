# Content Pipeline — Ορθογραφία

Παράγει `words.json` και mp3 ήχο για την PWA.

## Workflow

```powershell
cd scripts/orthografia-app/content-pipeline

# 1. (Προαιρετικό) Λήψη HelexKids CSV → inputs/helexkids/
#    Δες inputs/README.md — CC BY-NC 4.0, non-commercial

# 2. Παραγωγή λεξικού (χειροκίνητο seed + HelexKids αν υπάρχουν CSV)
..\..\..\.venv\Scripts\python.exe generate_seed.py

# 3. Ήχος μόνο για νέες λέξεις (όχι πλήρες TTS run)
..\..\..\.venv\Scripts\python.exe generate_audio.py

# Εναλλακτικά, μόνο HelexKids import:
..\..\..\.venv\Scripts\python.exe import_helexkids.py
```

### HelexKids import

1. Κατέβασε λίστες από [Wordlist Tool](https://gradience.lit.auth.gr/wordlist_tool/) ή HelexKids 2.0 Excel export.
2. Αποθήκευσε σε `inputs/helexkids/` (π.χ. `grade1.csv`, `grade2.csv`).
3. Τρέξε `import_helexkids.py` ή `generate_seed.py` (κάνει merge αυτόματα).

- **Άδεια:** CC BY-NC 4.0 — μη εμπορική χρήση (OK για αυτή την εφαρμογή).
- **Φίλτρα:** ΚΝΕ, ουσιαστικά/επίθετα/ρήματα, hints με `___` (χωρίς διαρροή ορθογραφίας).
- **Όριο:** ~90 λέξεις/τάξη (ρυθμιζόμενο με `--cap`).
- **Δείγμα:** `inputs/helexkids/sample_grade1.csv` για smoke test.

Αν δεν υπάρχουν CSV, το import τερματίζει με οδηγίες (exit 0).

## 1. Seed λέξεων

```powershell
..\..\..\.venv\Scripts\python.exe generate_seed.py
```

Παράγει `words.json` v2 (Α΄/Β΄/Γ΄/Δ΄) και το συγχρονίζει στο `web/public/content/`.

Για νέες λέξεις χωρίς mp3, τρέξε αργότερα `generate_audio.py` (χωρίς `--force` δημιουργεί μόνο τα νέα).

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
..\..\..\.venv\Scripts\python.exe generate_audio.py
```

Χωρίς `--force` δημιουργεί mp3 μόνο για λέξεις που δεν έχουν ήχο. Με `--force` ξαναφτιάχνει όλα.

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
| Δεν ακούς τίποτα | Τρέξε `generate_audio.py` για νέες λέξεις και refresh browser |
| HelexKids: no new words | Έλεγξε στήλες word/grade/pos και φίλτρα ΚΝΕ |

## Azure (εναλλακτικά)

```env
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=westeurope
```

Χρειάζεται: `pip install azure-cognitiveservices-speech`
