# Content Pipeline — Ορθογραφία

Παράγει `words.json` και αρχεία ήχου για την PWA.

## Απαιτήσεις

- Python 3.12+
- Root venv: `../../../.venv`

## Χρήση

```powershell
# Από root Orthographia
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r scripts/orthografia-app/content-pipeline/requirements.txt

cd scripts/orthografia-app/content-pipeline
..\..\..\.venv\Scripts\python.exe generate_seed.py
..\..\..\.venv\Scripts\python.exe generate_audio.py
```

## TTS (προαιρετικό)

Δημιούργησε `.env.local` στο root `Orthographia/`:

```env
# Azure Speech
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=westeurope

# ή Google Cloud TTS
GOOGLE_TTS_API_KEY=...
```

Χωρίς κλειδιά, δημιουργούνται placeholder mp3 (σίγαση) για smoke test.

## Έξοδος

- `outputs/words.json` — 50 λέξεις Γ΄ τάξης
- `outputs/audio/*.mp3` — προ-γεννημένα mp3

Αντίγραψε στο web:

```powershell
Copy-Item outputs/words.json ../web/public/content/
Copy-Item outputs/audio/*.mp3 ../web/public/content/audio/
```
