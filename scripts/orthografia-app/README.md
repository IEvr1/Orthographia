# Ορθογραφία — MVP PWA

Εφαρμογή υπαγόρευσης για εκμάθηση ελληνικής ορθογραφίας (Γ΄ Δημοτικού, ΚΝΕ).

## Γρήγορη εκκίνηση

```powershell
# 1. Python venv + deps
cd c:\AI_apps\Orthographia
python -m venv .venv
.venv\Scripts\pip.exe install -r scripts/orthografia-app/content-pipeline/requirements.txt

# 2. Βάλε GOOGLE_TTS_API_KEY στο .env.local (δες content-pipeline/README.md)

# 3. Seed + audio
.venv\Scripts\python.exe scripts/orthografia-app/content-pipeline/generate_seed.py
.venv\Scripts\python.exe scripts/orthografia-app/content-pipeline/generate_audio.py --force

# 4. Web
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

## Μετά το MVP

1. Pipeline HelexKids + GreekLex
2. Ενότητες κανόνων (άξονας Κ)
3. Οικογένειες λέξεων (άξονας Ρ)
4. Υπαγόρευση προτάσεων
5. Backend + FSRS
