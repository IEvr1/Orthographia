# Inputs — εξωτερικές πηγές λέξεων

## HelexKids / Wordlist Tool

### Λήψη δεδομένων

1. Άνοιξε το [Wordlist Tool](https://gradience.lit.auth.gr/wordlist_tool/) (HelexKids 2.0 / Gradience).
2. Επίλεξε λέξεις **ΚΝΕ** για τάξεις Β΄–Δ΄ (2–4). Η Α΄ τάξη δεν υποστηρίζεται.
3. Εξήγαγε σε CSV ή Excel.
4. Αποθήκευσε τα αρχεία στο φάκελο:

   `inputs/helexkids/`

   Παραδείγματα ονομάτων: `grade2.csv`, `grade3.csv`, ή ένα αρχείο με στήλη `grade`.

### Άδεια χρήσης

Τα δεδομένα HelexKids διατίθενται υπό **[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)** — μόνο **μη εμπορική** χρήση. Η εφαρμογή Ορθογραφία είναι non-commercial.

### Υποστηριζόμενες στήλες

| Στήλη | Εναλλακτικά ονόματα | Περιγραφή |
|-------|---------------------|-----------|
| `word` | `lemma`, `λέξη` | Η λέξη-στόχος |
| `grade` | `τάξη`, `class` | 2–4 ή Β΄–Δ΄ |
| `pos` | `μέρος λόγου` | noun, verb, adj (ουσιαστικό, ρήμα, επίθετο) |
| `frequency` | `συχνότητα`, `rank` | Προαιρετικό — για top-N ανά τάξη |

Το script φιλτράρει: μόνο ΚΝΕ, ουσιαστικά/επίθετα/ρήματα, χωρίς κύρια ονόματα/συντομογραφίες. Η Α΄ τάξη αγνοείται.

### Δείγμα

Δες `inputs/helexkids/sample_grade2.csv.example` (~10 λέξεις Β΄) για μορφή smoke test.

### Εκτέλεση

```powershell
cd scripts/orthografia-app/content-pipeline

# Προαιρετικό: μόνο HelexKids (αν υπάρχουν CSV)
python import_helexkids.py

# Πλήρης pipeline: seed + HelexKids merge
python generate_seed.py

# Ήχος μόνο για νέες λέξεις (χωρίς --force)
python generate_audio.py
```

Αν δεν υπάρχουν CSV, το `import_helexkids.py` εμφανίζει οδηγίες και τερματίζει χωρίς σφάλμα.

## Γλώσσα Β΄ Δημοτικού (βιβλία μαθητή)

Βάλε τα PDF στο Downloads ή στο `inputs/textbooks/`:

- `b_dim_glossa_tefchos_1_vivlio_mathiti.pdf`
- `b_dim_glossa_tefchos_2_vivlio_mathiti.pdf`

```powershell
python extract_textbook.py --extract-only
python generate_seed.py
```

Το script παίρνει λέξεις ορθογραφίας (λίστες «Μάθε να γράφεις» + συχνές λέξεις κειμένου) και σύντομες προτάσεις με `___`. Δεν αποθηκεύει ολόκληρο το βιβλίο.
