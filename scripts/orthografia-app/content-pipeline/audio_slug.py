"""Greek word → safe ASCII filename slug for audio files."""

from __future__ import annotations

import hashlib
import re
import unicodedata

DIGRAPHS = (
    ("τσ", "ts"),
    ("τζ", "tz"),
    ("μπ", "mp"),
    ("ντ", "nt"),
    ("γκ", "gk"),
    ("αι", "ai"),
    ("ει", "ei"),
    ("οι", "oi"),
    ("ου", "ou"),
    ("υι", "yi"),
)

CHAR_MAP = {
    "α": "a",
    "β": "v",
    "γ": "g",
    "δ": "d",
    "ε": "e",
    "ζ": "z",
    "η": "i",
    "θ": "th",
    "ι": "i",
    "κ": "k",
    "λ": "l",
    "μ": "m",
    "ν": "n",
    "ξ": "x",
    "ο": "o",
    "π": "p",
    "ρ": "r",
    "σ": "s",
    "ς": "s",
    "τ": "t",
    "υ": "y",
    "φ": "f",
    "χ": "ch",
    "ψ": "ps",
    "ω": "o",
}


def strip_accents(text: str) -> str:
    base = unicodedata.normalize("NFD", text)
    return "".join(c for c in base if unicodedata.category(c) != "Mn")


def slugify(word: str) -> str:
    """Transliterate Greek word to ASCII slug (e.g. ήλιος → ilios)."""
    base = strip_accents(word.lower()).replace("ς", "σ")
    out: list[str] = []
    i = 0
    while i < len(base):
        matched = False
        for src, dst in DIGRAPHS:
            if base.startswith(src, i):
                out.append(dst)
                i += len(src)
                matched = True
                break
        if matched:
            continue
        ch = base[i]
        if ch in CHAR_MAP:
            out.append(CHAR_MAP[ch])
        elif ch.isascii() and ch.isalnum():
            out.append(ch)
        i += 1

    slug = re.sub(r"[^a-z0-9]+", "", "".join(out))
    if not slug:
        digest = hashlib.md5(word.encode("utf-8")).hexdigest()[:10]
        slug = f"w{digest}"
    return slug[:60]


def is_broken_audio_path(path: str) -> bool:
    name = path.rsplit("/", 1)[-1]
    stem = name.removesuffix(".mp3") if name.endswith(".mp3") else name
    return not stem or stem in {".mp3", "s", "mp3"} or name.endswith(".mp3.mp3")
