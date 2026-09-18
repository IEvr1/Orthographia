#!/usr/bin/env python3
"""Generate mp3 audio files for dictation words via Google or Azure TTS."""

from __future__ import annotations

import argparse
import base64
import json
import os
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
WEB_AUDIO = PIPELINE.parent / "web" / "public" / "content" / "audio"

GOOGLE_VOICE = "el-GR-Wavenet-A"


def load_env() -> None:
    if load_dotenv is None:
        return
    for candidate in (ROOT / ".env.local", ROOT / ".env", PIPELINE / ".env.local"):
        if candidate.exists():
            load_dotenv(candidate)


def write_silent_wav(path: Path, duration_ms: int = 400) -> None:
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


def generate_placeholder(stem: str) -> None:
    wav_path = AUDIO_DIR / f"{stem}.wav"
    write_silent_wav(wav_path, duration_ms=500)
    print(f"  placeholder: {wav_path.name}")


def sync_words_audio_paths(words: list[dict]) -> list[dict]:
    synced = []
    for entry in words:
        item = dict(entry)
        stem = Path(item["audioFile"]).stem
        mp3_path = AUDIO_DIR / f"{stem}.mp3"
        wav_path = AUDIO_DIR / f"{stem}.wav"
        if mp3_path.exists():
            item["audioFile"] = f"audio/{stem}.mp3"
        elif wav_path.exists():
            item["audioFile"] = f"audio/{stem}.wav"
        synced.append(item)
    return synced


def copy_to_web(words: list[dict]) -> None:
    WEB_AUDIO.mkdir(parents=True, exist_ok=True)
    for old in WEB_AUDIO.glob("*.*"):
        if old.suffix.lower() in {".mp3", ".wav"}:
            old.unlink()
    for audio in AUDIO_DIR.glob("*.*"):
        if audio.suffix.lower() not in {".mp3", ".wav"}:
            continue
        dest = WEB_AUDIO / audio.name
        dest.write_bytes(audio.read_bytes())
    words_dest = PIPELINE.parent / "web" / "public" / "content" / "words.json"
    words_dest.parent.mkdir(parents=True, exist_ok=True)
    payload = {"version": 1, "grade": 3, "words": words}
    words_dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Copied content to {words_dest.parent}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate dictation audio files.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate all files even if they already exist.",
    )
    args = parser.parse_args()

    load_env()
    if not WORDS_FILE.exists():
        raise SystemExit(f"Missing {WORDS_FILE}. Run generate_seed.py first.")

    has_google = bool(os.getenv("GOOGLE_TTS_API_KEY"))
    has_azure = bool(os.getenv("AZURE_SPEECH_KEY"))
    has_tts = has_google or has_azure

    if not has_tts:
        print("No TTS API key found.")
        print(f"Create {ROOT / '.env.local'} with GOOGLE_TTS_API_KEY=...")
        print("See scripts/orthografia-app/content-pipeline/README.md for setup steps.")
        sys.exit(1)

    provider = "Google" if has_google else "Azure"
    print(f"Using {provider} TTS" + (" (--force)" if args.force else ""))

    data = json.loads(WORDS_FILE.read_text(encoding="utf-8"))
    words = data["words"]
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    ok_count = 0
    fail_count = 0

    for entry in words:
        text = entry["word"]
        stem = Path(entry["audioFile"]).stem
        mp3_out = AUDIO_DIR / f"{stem}.mp3"
        wav_out = AUDIO_DIR / f"{stem}.wav"

        if mp3_out.exists() and not args.force:
            ok_count += 1
            continue

        if generate_tts(text, mp3_out):
            wav_out.unlink(missing_ok=True)
            ok_count += 1
            print(f"  ok: {stem}.mp3")
        else:
            fail_count += 1
            print(f"  FAIL: {stem}")

    if fail_count:
        raise SystemExit(f"Failed to generate {fail_count} files. Check API key and billing.")

    synced_words = sync_words_audio_paths(words)
    OUTPUT_DIR.joinpath("words.json").write_text(
        json.dumps({"version": 1, "grade": 3, "words": synced_words}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    copy_to_web(synced_words)
    print(f"Done — {ok_count} mp3 files in {AUDIO_DIR}")


if __name__ == "__main__":
    main()
