# Inputs — εξωτερικές πηγές λέξεων

## HelexKids (μελλοντικό import)

Για μαζική εισαγωγή λέξεων από HelexKids, τοποθέτησε CSV εδώ:

`inputs/helexkids.csv`

Απαιτούμενες στήλες:

| Στήλη | Περιγραφή |
|-------|-----------|
| `word` | Η λέξη-στόχος |
| `grade` | 2, 3 ή 4 |
| `axis` | `R` ή `K` |
| `hintSentence` | Πρόταση με `___` αντί για τη λέξη (να μην διαρρέει η ορθογραφία) |
| `feedbackRule` | Σύντομος κανόνας για feedback |
| `root` | Ρίζα (morphemes) |
| `suffix` | Κατάληξη (morphemes) |

```powershell
cd scripts/orthografia-app/content-pipeline
python import_helexkids.py --input inputs/helexkids.csv --merge
python generate_audio.py
```

> **Σημείωση:** Μέχρι να υπάρχει CSV, οι λέξεις παράγονται από `generate_seed.py` (χειροκίνητη επιλογή ΚΝΕ).
