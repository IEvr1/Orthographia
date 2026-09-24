#!/usr/bin/env python3
"""Generate mp3 audio files for dictation words via Google or Azure TTS."""

from __future__ import annotations

import argparse
import base64
import json
import os
import shutil
import struct
import sys
import urllib.error
import urllib.parse
import urllib.request
import wave
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore

ROOT = Path(__file__).resolve().parents[3]
PIPELINE = Path(__file__).resolve().parent
OUTPUT_DIR = PIPELINE / "outputs"
AUDIO_DIR = OUTPUT_DIR / "audio"
WORDS_FILE = OUTPUT_DIR / "words.json"
WEB_CONTENT = PIPELINE.parent / "web" / "public" / "content"
WEB_WORDS = WEB_CONTENT / "words.json"
WEB_AUDIO = WEB_CONTENT / "audio"

GOOGLE_VOICE = "el-GR-Wavenet-A"


def load_env() -> None:
    if load_dotenv is None:
        return
    for candidate in (ROOT / ".env.local", ROOT / ".env", PIPELINE / ".env.local"):
        if candidate.exists():
            load_dotenv(candidate)


def write_silent_wav(path: Path, duration_ms: int = 500) -> None:
    sample_rate = 22050
    n_frames = int(sample_rate * duration_ms / 1000)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack("<" + "h" * n_frames, *([0] * n_frames)))


def generate_google(text: str, out_path: Path) -> bool:
    api_key = os.getenv("GOOGLE_TTS_API_KEY")
    if not api_key:
        return False

    url = "https://texttospeech.googleapis.com/v1/text:synthesize"
    body = json.dumps(
        {
            "input": {"text": text},
            "voice": {"languageCode": "el-GR", "name": GOOGLE_VOICE},
            "audioConfig": {"audioEncoding": "MP3", "speakingRate": 0.92},
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{url}?key={urllib.parse.quote(api_key)}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        print(f"  Google TTS HTTP {err.code}: {detail[:300]}")
        return False
    except urllib.error.URLError as err:
        print(f"  Google TTS network error: {err.reason}")
        return False

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(base64.b64decode(payload["audioContent"]))
    return True


def generate_azure(text: str, out_path: Path) -> bool:
    key = os.getenv("AZURE_SPEECH_KEY")
    region = os.getenv("AZURE_SPEECH_REGION", "westeurope")
    if not key:
        return False
    try:
        import azure.cognitiveservices.speech as speechsdk  # type: ignore
    except ImportError:
        print("Install azure-cognitiveservices-speech for Azure TTS")
        return False

    speech_config = speechsdk.SpeechConfig(subscription=key, region=region)
    speech_config.speech_synthesis_voice_name = "el-GR-AthinaNeural"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    audio_config = speechsdk.audio.AudioOutputConfig(filename=str(out_path))
    synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=audio_config)
    result = synthesizer.speak_text_async(text).get()
    return result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted


def generate_tts(text: str, mp3_out: Path) -> bool:
    if os.getenv("GOOGLE_TTS_API_KEY"):
        return generate_google(text, mp3_out)
    if os.getenv("AZURE_SPEECH_KEY"):
        return generate_azure(text, mp3_out)
    return False


def seed_output_audio_from_web() -> int:
    """Copy existing web audio into outputs/audio so incremental runs stay complete."""
    if not WEB_AUDIO.is_dir():
        return 0
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    copied = 0
    for src in WEB_AUDIO.glob("*.*"):
        if src.suffix.lower() not in {".mp3", ".wav"}:
            continue
        dest = AUDIO_DIR / src.name
        if not dest.exists():
            shutil.copy2(src, dest)
            copied += 1
    return copied


def audio_exists(stem: str) -> bool:
    for folder in (WEB_AUDIO, AUDIO_DIR):
        if (folder / f"{stem}.mp3").exists() or (folder / f"{stem}.wav").exists():
            return True
    return False


def sync_words_audio_paths(words: list[dict]) -> list[dict]:
    synced = []
    for entry in words:
        item = dict(entry)
        stem = Path(item["audioFile"]).stem
        mp3_path = WEB_AUDIO / f"{stem}.mp3"
        wav_path = WEB_AUDIO / f"{stem}.wav"
        if mp3_path.exists():
            item["audioFile"] = f"audio/{stem}.mp3"
        elif wav_path.exists():
            item["audioFile"] = f"audio/{stem}.wav"
        synced.append(item)
    return synced


def copy_audio_to_web(stem: str, ext: str) -> None:
    WEB_AUDIO.mkdir(parents=True, exist_ok=True)
    src = AUDIO_DIR / f"{stem}{ext}"
    if src.exists():
        shutil.copy2(src, WEB_AUDIO / f"{stem}{ext}")


def write_words_payload(words: list[dict]) -> None:
    source = WEB_WORDS if WEB_WORDS.exists() else WORDS_FILE
    version = 2
    if source.exists():
        try:
            version = int(json.loads(source.read_text(encoding="utf-8")).get("version", 2))
        except (json.JSONDecodeError, TypeError, ValueError):
            version = 2
    payload = {"version": version, "grade": 0, "words": words}
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    WORDS_FILE.parent.mkdir(parents=True, exist_ok=True)
    WORDS_FILE.write_text(text, encoding="utf-8")
    WEB_WORDS.parent.mkdir(parents=True, exist_ok=True)
    WEB_WORDS.write_text(text, encoding="utf-8")


def load_words() -> list[dict]:
    path = WEB_WORDS if WEB_WORDS.exists() else WORDS_FILE
    if not path.exists():
        raise SystemExit(f"Missing {WORDS_FILE}. Run generate_seed.py first.")
    return json.loads(path.read_text(encoding="utf-8"))["words"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate dictation audio files.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate all files even if they already exist.",
    )
    parser.add_argument(
        "--placeholder",
        action="store_true",
        help="Create silent .wav placeholders when TTS is unavailable (dev only).",
    )
    args = parser.parse_args()

    load_env()
    words = load_words()
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    WEB_AUDIO.mkdir(parents=True, exist_ok=True)

    seeded = seed_output_audio_from_web()
    if seeded:
        print(f"Seeded {seeded} existing audio files into outputs/audio")

    has_google = bool(os.getenv("GOOGLE_TTS_API_KEY"))
    has_azure = bool(os.getenv("AZURE_SPEECH_KEY"))
    has_tts = has_google or has_azure

    if not has_tts and not args.placeholder:
        print("No TTS API key found.")
        print(f"Create {ROOT / '.env.local'} with GOOGLE_TTS_API_KEY=...")
        print("Or run with --placeholder for silent dev placeholders.")
        print("See scripts/orthografia-app/content-pipeline/README.md for setup steps.")
        sys.exit(1)

    if has_tts:
        provider = "Google" if has_google else "Azure"
        print(f"Using {provider} TTS" + (" (--force)" if args.force else ""))
    else:
        print("Using silent placeholders (--placeholder)")

    ok_count = 0
    fail_count = 0
    placeholder_count = 0
    skipped = 0

    for entry in words:
        text = entry["word"]
        stem = Path(entry["audioFile"]).stem
        mp3_out = AUDIO_DIR / f"{stem}.mp3"
        wav_out = AUDIO_DIR / f"{stem}.wav"

        if not args.force and audio_exists(stem):
            # Keep web/ in sync when the file only lives under outputs/audio.
            if (AUDIO_DIR / f"{stem}.mp3").exists() and not (WEB_AUDIO / f"{stem}.mp3").exists():
                copy_audio_to_web(stem, ".mp3")
            elif (AUDIO_DIR / f"{stem}.wav").exists() and not (WEB_AUDIO / f"{stem}.wav").exists():
                copy_audio_to_web(stem, ".wav")
            ok_count += 1
            continue

        if has_tts and generate_tts(text, mp3_out):
            wav_out.unlink(missing_ok=True)
            copy_audio_to_web(stem, ".mp3")
            ok_count += 1
            print(f"  ok: {stem}.mp3")
            continue

        if args.placeholder:
            write_silent_wav(wav_out)
            copy_audio_to_web(stem, ".wav")
            placeholder_count += 1
            ok_count += 1
            print(f"  placeholder: {stem}.wav")
            continue

        fail_count += 1
        skipped += 1
        print(f"  skip: {stem}")

    synced_words = sync_words_audio_paths(words)
    write_words_payload(synced_words)

    print(
        f"Done — existing/new audio: {ok_count}, placeholders: {placeholder_count}, "
        f"failed/skipped: {fail_count + skipped}"
    )
    if fail_count and not args.placeholder:
        raise SystemExit(f"Failed to generate {fail_count} files. Check API key and billing.")


if __name__ == "__main__":
    main()
