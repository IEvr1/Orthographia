#!/usr/bin/env python3
"""Generate mp3 audio files for dictation words."""

from __future__ import annotations

import json
import os
import struct
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


def load_env() -> None:
    if load_dotenv is None:
        return
    for candidate in (ROOT / ".env.local", ROOT / ".env", PIPELINE / ".env.local"):
        if candidate.exists():
            load_dotenv(candidate)


def write_silent_wav(path: Path, duration_ms: int = 400) -> None:
    """Write a short silent WAV (fallback when no TTS)."""
    sample_rate = 22050
    n_frames = int(sample_rate * duration_ms / 1000)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack("<" + "h" * n_frames, *([0] * n_frames)))


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


def generate_google(text: str, out_path: Path) -> bool:
    api_key = os.getenv("GOOGLE_TTS_API_KEY")
    if not api_key:
        return False
    try:
        import urllib.parse
        import urllib.request
    except ImportError:
        return False

    url = "https://texttospeech.googleapis.com/v1/text:synthesize"
    body = json.dumps(
        {
            "input": {"text": text},
            "voice": {"languageCode": "el-GR", "name": "el-GR-Wavenet-A"},
            "audioConfig": {"audioEncoding": "MP3"},
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{url}?key={urllib.parse.quote(api_key)}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    import base64

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(base64.b64decode(payload["audioContent"]))
    return True


def generate_placeholder(out_path: Path) -> None:
    """Write short silent WAV for offline dev when no TTS keys."""
    wav_path = out_path.with_suffix(".wav")
    write_silent_wav(wav_path, duration_ms=500)
    print(f"  placeholder: {wav_path.name}")


def sync_words_audio_paths(words: list[dict]) -> list[dict]:
    """Point audioFile to .wav when only placeholder exists."""
    synced = []
    for entry in words:
        item = dict(entry)
        rel = item["audioFile"]
        stem = Path(rel).stem
        wav_rel = f"audio/{stem}.wav"
        mp3_path = OUTPUT_DIR / "audio" / f"{stem}.mp3"
        wav_path = OUTPUT_DIR / "audio" / f"{stem}.wav"
        if wav_path.exists() and not mp3_path.exists():
            item["audioFile"] = wav_rel
        synced.append(item)
    return synced


def copy_to_web(words: list[dict]) -> None:
    WEB_AUDIO.mkdir(parents=True, exist_ok=True)
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
    load_env()
    if not WORDS_FILE.exists():
        raise SystemExit(f"Missing {WORDS_FILE}. Run generate_seed.py first.")

    data = json.loads(WORDS_FILE.read_text(encoding="utf-8"))
    words = data["words"]
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    has_tts = bool(os.getenv("AZURE_SPEECH_KEY") or os.getenv("GOOGLE_TTS_API_KEY"))
    if not has_tts:
        print("No TTS keys found — generating placeholder audio (silent wav as mp3).")

    for entry in words:
        text = entry["word"]
        rel = entry["audioFile"]
        out_path = OUTPUT_DIR / rel.replace("audio/", "audio/")
        if out_path.exists() and has_tts:
            continue
        ok = False
        if has_tts:
            ok = generate_azure(text, out_path) or generate_google(text, out_path)
        if not ok:
            generate_placeholder(out_path)

    synced_words = sync_words_audio_paths(words)
    OUTPUT_DIR.joinpath("words.json").write_text(
        json.dumps({"version": 1, "grade": 3, "words": synced_words}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    copy_to_web(synced_words)
    count = len(list(AUDIO_DIR.glob("*.mp3"))) + len(list(AUDIO_DIR.glob("*.wav")))
    print(f"Done — {count} audio files in {AUDIO_DIR}")


if __name__ == "__main__":
    main()
