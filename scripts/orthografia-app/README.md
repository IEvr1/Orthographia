# Ορθογραφία — MVP PWA

Εφαρμογή υπαγόρευσης για εκμάθηση ελληνικής ορθογραφίας (Γ΄ Δημοτικού, ΚΝΕ).

## Εγκατάσταση

```powershell
# Από root Orthographia
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r scripts/orthografia-app/content-pipeline/requirements.txt

cd scripts/orthografia-app/content-pipeline
..\..\..\.venv\Scripts\python.exe generate_seed.py
..\..\..\.venv\Scripts\python.exe generate_audio.py

cd ../web
npm install
npm run dev
```

Linux/macOS: αντικατάστησε `.venv\Scripts\python.exe` με `.venv/bin/python`.

## TTS (προαιρετικό)

Δημιούργησε `.env.local` στο root:

```env
AZURE_SPEECH_KEY=your-key
AZURE_SPEECH_REGION=westeurope
# ή
GOOGLE_TTS_API_KEY=your-key
```

Χωρίς κλειδιά, δημιουργούνται placeholder αρχεία ήχου (σίγαση) για offline dev.

## Build PWA

```powershell
cd scripts/orthografia-app/web
npm run build
npm run preview
```

## Manual test checklist

- [ ] Play audio λειτουργεί
- [ ] «ήλιος» σωστά → πράσινο, επόμενη λέξη
- [ ] «ηλιος» χωρίς τόνο → feedback τόνου
- [ ] «ηλιοσ» → κόκκινο + υποχρεωτική επανάγραφη
- [ ] Συνεδρία 10 λέξεων (8+2) ολοκληρώνεται
- [ ] Refresh διατηρεί πρόοδο (localStorage)
- [ ] `npm run build` χωρίς errors

## Μετά το MVP

1. Pipeline HelexKids + GreekLex
2. Ενότητες κανόνων (άξονας Κ)
3. Οικογένειες λέξεων (άξονας Ρ)
4. Υπαγόρευση προτάσεων
5. Backend + FSRS
