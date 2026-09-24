# -*- coding: utf-8 -*-
"""Extract PDF exercise examples for missing ending contrasts."""
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
text = open(r"c:\AI_apps\Orthographia\_pdf_extract.txt", encoding="utf-8").read()

# Split by pages for context
pages = text.split("===== PAGE")

targets = [
    (r"-ι\s*και\s*-υ|-ι\s*ή\s*-υ|κατάληξη.{0,20}-υ", "i-y"),
    (r"-οι\s*ή\s*-εις|καταλήξεις\s*-οι", "oi-eis"),
    (r"κατάληξη \(α ή ες\)|κατάληξη \(α ή", "a-es"),
    (r"-σε ή -σαι|-σαι", "se-sai"),
    (r"-ήστε|-ίστε|-είστε", "iste"),
    (r"-ισσα|-ησα|-ισα", "issa"),
    (r"-ειο ή -ιο|-ειο", "eio-io"),
    (r"-ποιος|-ποιώ|ποίηση|ποιείο", "poios"),
    (r"αι, ει ή ω|κατάληξη \(αι", "ai-ei-o"),
    (r"κατάληξη -ος\.|κατάληξη -ος ", "os"),
    (r"η, ι ή ει|κατάληξη \(η, ι", "h-i-ei"),
]

for pat, label in targets:
    print("\n" + "=" * 60)
    print("LABEL:", label)
    print("=" * 60)
    for m in re.finditer(pat, text, re.I):
        start = max(0, m.start() - 80)
        end = min(len(text), m.end() + 500)
        chunk = re.sub(r"\s+", " ", text[start:end])
        print(chunk[:600])
        print("---")
        break  # first hit with context; get more below

# Broader: dump sections around each exercise instruction
print("\n\n#### FULLER CONTEXTS ####\n")
instrs = [
    "καταλήξεις -οι ή -εις",
    "κατάληξη (α ή ες)",
    "-σε ή -σαι",
    "-ήστε, -ίστε και -είστε",
    "-ισσα, -ησα ή -ισα",
    "-ειο ή -ιο",
    "-ποιος, -ποιώ",
    "κατάληξη (αι, ει ή ω)",
    "κατάληξη -ος",
    "καταλήξεις σε -ι και -υ",
    "κατάληξη (η, ι ή ει)",
]
for needle in instrs:
    idx = text.lower().find(needle.lower())
    if idx < 0:
        print("NOT FOUND:", needle)
        continue
    chunk = re.sub(r"\s+", " ", text[idx : idx + 700])
    print("\n>>>", needle)
    print(chunk)
