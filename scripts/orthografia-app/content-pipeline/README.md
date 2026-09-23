# Content Pipeline — Ορθογραφία

Παράγει `words.json` και mp3 ήχο για την PWA.

## Reset περιεχομένου

Αν θέλεις να ξαναχτίσεις λέξεις/προτάσεις/κανόνες από την αρχή:

```powershell
cd scripts/orthografia-app/content-pipeline
..\..\..\.venv\Scripts\python.exe reset_content.py
```

Καθαρίζει `words.json`, `rules.json`, `families.json`, audio, CSV inputs και overrides. Μετά γέμισε `word_lists.py` / inputs και τρέξε `generate_seed.py`.

## Workflow

```powershell
cd scripts/orthografia-app/content-pipeline

# 1. (Προαιρετικό) Λήψη HelexKids CSV → inputs/helexkids/
#    Δες inputs/README.md — CC BY-NC 4.0, non-commercial

# 1β. (Προαιρετικό) Λέξεις από Γλώσσα Β΄ (PDF βιβλία μαθητή)
#     python extract_textbook.py --extract-only

# 1γ. (Προαιρετικό) Σχολικά λεξικά ΑΒΓ + ΔΕΣΤ + Γραμματική Ε-ΣΤ (PDF στο Downloads)
#     python extract_lexikon.py
#     python extract_grammar.py

# 2. Παραγωγή λεξικού (seed + textbooks + HelexKids + lexika)
..\..\..\.venv\Scripts\python.exe generate_seed.py

# 3. Ήχος μόνο για νέες λέξεις (χωρίς --force)
..\..\..\.venv\Scripts\python.exe generate_audio.py
# Dev χωρίς API key: generate_audio.py --placeholder

# Εναλλακτικά, μόνο HelexKids import:
..\..\..\.venv\Scripts\python.exe import_helexkids.py
```

### HelexKids import

1. Κατέβασε λίστες από [Wordlist Tool](https://gradience.lit.auth.gr/wordlist_tool/) ή HelexKids 2.0 Excel export.
2. Αποθήκευσε σε `inputs/helexkids/` (π.χ. `grade2.csv`, `grade3.csv`).
3. Τρέξε `import_helexkids.py` ή `generate_seed.py` (κάνει merge αυτόματα).

- **Άδεια:** CC BY-NC 4.0 — μη εμπορική χρήση (OK για αυτή την εφαρμογή).
- **Φίλτρα:** ΚΝΕ, ουσιαστικά/επίθετα/ρήματα, hints με `___` (χωρίς διαρροή ορθογραφίας). Η Α΄ τάξη αγνοείται.
- **Όριο:** ~90 λέξεις/τάξη (ρυθμιζόμενο με `--cap`).
- **Δείγμα:** `inputs/helexkids/sample_grade2.csv.example` για format reference (δεν εισάγεται αυτόματα).

Αν δεν υπάρχουν CSV, το import τερματίζει με οδηγίες (exit 0).

### Γλώσσα Β΄ Δημοτικού (βιβλία μαθητή)

Από τα PDF `b_dim_glossa_tefchos_1_vivlio_mathiti.pdf` και `..._tefchos_2_...` (Downloads ή `inputs/textbooks/`):

```powershell
python extract_textbook.py --extract-only
python generate_seed.py
```

Γράφει `inputs/textbooks/grade2.csv` (λέξεις + σύντομα cloze με `___`). Τα PDF και το raw κείμενο **δεν** μπαίνουν στο git.

### Γλώσσα Γ΄ Δημοτικού

Curated λίστα: `inputs/textbooks/grade3.csv` (+ canvas review). Import στο app:

```powershell
python generate_seed.py
python generate_audio.py
```

Ids: `tb-g3-…`, `grade: 3`.

### Σχολικά λεξικά & Γραμματική (Β΄–Στ΄)

Βάλε στο `Downloads` (ή `inputs/lexika/`):

- `a_b_c_lexiko.pdf` — Το Πρώτο μου Λεξικό (πηγή Α΄–Γ΄· η Α΄ ανακατανέμεται σε Β΄–Γ΄)
- `d_e_st_lexiko.pdf` — Ορθογραφικό–Ερμηνευτικό (Δ΄–Στ΄)
- `e_st_grammatiki_vivlio_mathiti.pdf` — Γραμματική Ε΄ & Στ΄

```powershell
python extract_lexikon.py
python extract_grammar.py
python generate_seed.py
```

Παράγει `inputs/lexika/grade{2-6}.csv`, `families.json`, `rules.json`, `declension_tables.json` και επεκτείνει το `words.json` (τάξεις Ε΄/Στ΄).

## 1. Seed λέξεων

```powershell
..\..\..\.venv\Scripts\python.exe generate_seed.py
```

Παράγει `words.json` v2 (Β΄/Γ΄/Δ΄/…) και το συγχρονίζει στο `web/public/content/`.

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

Για τοπική ανάπτυξη **χωρίς** Google/Azure key:

```powershell
python generate_audio.py --placeholder
```

Δημιουργεί σιωπηλά `.wav` placeholders ώστε η εφαρμογή να μην σπάει στο κουμπί «Άκου».

## 4. Review λέξεων / προτάσεων / παραδειγμάτων ανά τάξη

Για ανθρώπινο QA ανά τάξη (λέξη + cloze πρόταση + παραδείγματα κανόνων):

```powershell
cd scripts/orthografia-app/content-pipeline
..\..\..\.venv\Scripts\python.exe grade_review.py              # σύνοψη Β΄–Στ΄
..\..\..\.venv\Scripts\python.exe grade_review.py --export-all # packs + HTML reviewer
```

Έπειτα άνοιξε τον reviewer (το `fetch` χρειάζεται local server):

```powershell
python -m http.server 8765 --directory review
# browser: http://localhost:8765/?grade=2
```

Στο UI μπορείς να φιλτράρεις κατά προτεραιότητα (high/medium/low), να μαρκάρεις OK / χρειάζεται διόρθωση / παράβλεψη / λάθος τάξη, και να εξάγεις `grade_review_status.json`.

Επαναφορά status στο repo και εφαρμογή διορθώσεων:

```powershell
python grade_review.py --import-status path\to\grade_review_status.json
python grade_review.py --apply-status   # γράφει inputs/hint_overrides.json
python fix_hints.py                     # εφαρμόζει overrides στο words.json
```

Προτεραιότητες:
- **high** — garbled / leaks word / empty / english
- **medium** — generic, διπλότυπα hints, κενά rule examples, λείπει ορισμός (Δ΄+)
- **low** — καθαρά curated entries

Τα παραγόμενα packs είναι στο `review/` (δεν μπαίνουν στο git).

## 5. Τρέξε την εφαρμογή

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
