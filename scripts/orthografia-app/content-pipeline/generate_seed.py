#!/usr/bin/env python3
"""Generate words.json v2 with multi-grade KNE spelling words."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from import_helexkids import INPUTS_DIR, append_helexkids, count_by_grade
from word_lists import GRADE_2, GRADE_3_EXTRA, GRADE_4

OUTPUT_DIR = Path(__file__).resolve().parent / "outputs"
OUTPUT_FILE = OUTPUT_DIR / "words.json"
WEB_WORDS = Path(__file__).resolve().parent.parent / "web" / "public" / "content" / "words.json"

# Original 50 Γ΄ words (keep ids word-001..word-050 for existing progress)
GRADE_3_BASE: list[dict] = [
    {
        "id": "word-001",
        "word": "ήλιος",
        "grade": 3,
        "axis": "K",
        "hintSentence": "Ο ήλιος λάμπει ψηλά στον ουρανό.",
        "feedbackRule": "Ίδια ρίζα με ήλιο· -ος στο τέλος.",
        "audioFile": "audio/ilios.mp3",
        "morphemes": {"root": "ήλι", "suffix": "ος"},
        "difficulty": 1,
        "ruleId": "tonos-basic",
    },
    {
        "id": "word-002",
        "word": "θάλασσα",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Η θάλασσα είναι γαλάζια το καλοκαίρι.",
        "feedbackRule": "Διπλό σ στο τέλος της λέξης.",
        "audioFile": "audio/thalassa.mp3",
        "morphemes": {"root": "θαλασσ", "suffix": "α"},
        "ruleId": "double-consonant",
    },
    {
        "id": "word-003",
        "word": "σχολείο",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Πηγαίνω στο σχολείο κάθε πρωί.",
        "feedbackRule": "Ρίζα σχολ- + -είο.",
        "audioFile": "audio/scholeio.mp3",
        "morphemes": {"root": "σχολ", "suffix": "είο"},
    },
    {
        "id": "word-004",
        "word": "βιβλίο",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Διάβασα ένα ωραίο βιβλίο.",
        "feedbackRule": "Διπλό β στην αρχή.",
        "audioFile": "audio/vivlio.mp3",
        "morphemes": {"root": "βιβλ", "suffix": "ίο"},
    },
    {
        "id": "word-005",
        "word": "φίλος",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Ο καλύτερός μου φίλος μένει δίπλα.",
        "feedbackRule": "Φίλ- + -ος.",
        "audioFile": "audio/filos.mp3",
        "morphemes": {"root": "φίλ", "suffix": "ος"},
    },
    {
        "id": "word-006",
        "word": "γάτα",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Η γάτα κοιμάται στον καναπέ.",
        "feedbackRule": "Γάτ- + -α.",
        "audioFile": "audio/gata.mp3",
        "morphemes": {"root": "γάτ", "suffix": "α"},
    },
    {
        "id": "word-007",
        "word": "σκύλος",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Ο σκύλος μας τρέχει στην αυλή.",
        "feedbackRule": "Σκύλ- + -ος.",
        "audioFile": "audio/skylos.mp3",
        "morphemes": {"root": "σκύλ", "suffix": "ος"},
    },
    {
        "id": "word-008",
        "word": "ποτάμι",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Το ποτάμι ρέει γρήγορα.",
        "feedbackRule": "Ποτ- + -άμι.",
        "audioFile": "audio/potami.mp3",
        "morphemes": {"root": "ποτ", "suffix": "άμι"},
    },
    {
        "id": "word-009",
        "word": "βουνό",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Το βουνό έχει χιόνι το χειμώνα.",
        "feedbackRule": "Βουν- + -ό.",
        "audioFile": "audio/vouno.mp3",
        "morphemes": {"root": "βουν", "suffix": "ό"},
    },
    {
        "id": "word-010",
        "word": "λουλούδι",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Μύρισε το κόκκινο λουλούδι.",
        "feedbackRule": "Διπλό λ και διπλό ού.",
        "audioFile": "audio/louloudi.mp3",
        "morphemes": {"root": "λουλουδ", "suffix": "ι"},
        "ruleId": "double-consonant",
    },
    {
        "id": "word-011",
        "word": "κήπος",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Παίζουμε στον κήπο του σπιτιού.",
        "feedbackRule": "Κήπ- + -ος (τελικό σ).",
        "audioFile": "audio/kipos.mp3",
        "morphemes": {"root": "κήπ", "suffix": "ος"},
    },
    {
        "id": "word-012",
        "word": "ψωμί",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Φάγαμε φρέσκο ψωμί στο πρωινό.",
        "feedbackRule": "Ψωμ- + -ί.",
        "audioFile": "audio/psomi.mp3",
        "morphemes": {"root": "ψωμ", "suffix": "ί"},
    },
    {
        "id": "word-013",
        "word": "γάλα",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Ήπιε γάλα πριν κοιμηθεί.",
        "feedbackRule": "Γάλ- + -α.",
        "audioFile": "audio/gala.mp3",
        "morphemes": {"root": "γάλ", "suffix": "α"},
    },
    {
        "id": "word-014",
        "word": "μήλο",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Έφαγα ένα κόκκινο μήλο.",
        "feedbackRule": "Μήλ- + -ο.",
        "audioFile": "audio/milo.mp3",
        "morphemes": {"root": "μήλ", "suffix": "ο"},
    },
    {
        "id": "word-015",
        "word": "πορτοκάλι",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Το πορτοκάλι είναι γλυκό.",
        "feedbackRule": "Πορτοκαλ- + -ι.",
        "audioFile": "audio/portokali.mp3",
        "morphemes": {"root": "πορτοκαλ", "suffix": "ι"},
    },
    {
        "id": "word-016",
        "word": "χειμώνας",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Τον ___ βρέχει πολύ.",
        "feedbackRule": "Χειμων- + -ας.",
        "audioFile": "audio/cheimonas.mp3",
        "morphemes": {"root": "χειμων", "suffix": "ας"},
    },
    {
        "id": "word-017",
        "word": "καλοκαίρι",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Το καλοκαίρι πάμε στη θάλασσα.",
        "feedbackRule": "Καλοκαιρ- + -ι.",
        "audioFile": "audio/kalokairi.mp3",
        "morphemes": {"root": "καλοκαιρ", "suffix": "ι"},
    },
    {
        "id": "word-018",
        "word": "άνεμος",
        "grade": 3,
        "axis": "K",
        "hintSentence": "Ο άνεμος φύσηξε δυνατά.",
        "feedbackRule": "Ανεμ- + -ος.",
        "audioFile": "audio/anemos.mp3",
        "morphemes": {"root": "ανεμ", "suffix": "ος"},
        "ruleId": "tonos-basic",
    },
    {
        "id": "word-019",
        "word": "βροχή",
        "grade": 3,
        "axis": "K",
        "hintSentence": "Η βροχή έπεσε όλη μέρα.",
        "feedbackRule": "Βροχ- + -ή.",
        "audioFile": "audio/vrochi.mp3",
        "morphemes": {"root": "βροχ", "suffix": "ή"},
        "ruleId": "tonos-basic",
    },
    {
        "id": "word-020",
        "word": "χιόνι",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Έπεσε πολύ χιόνι χθες.",
        "feedbackRule": "Χιον- + -ι.",
        "audioFile": "audio/chioni.mp3",
        "morphemes": {"root": "χιον", "suffix": "ι"},
    },
    {
        "id": "word-021",
        "word": "αετός",
        "grade": 3,
        "axis": "K",
        "hintSentence": "Ο αετός πέταξε ψηλά.",
        "feedbackRule": "Αετ- + -ός.",
        "audioFile": "audio/aetos.mp3",
        "morphemes": {"root": "αετ", "suffix": "ός"},
        "ruleId": "tonos-basic",
    },
    {
        "id": "word-022",
        "word": "πεταλούδα",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Μια πεταλούδα κάθισε στο λουλούδι.",
        "feedbackRule": "Πεταλουδ- + -α.",
        "audioFile": "audio/petalouda.mp3",
        "morphemes": {"root": "πεταλουδ", "suffix": "α"},
    },
    {
        "id": "word-023",
        "word": "δέντρο",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Το δέντρο έχει πολλά φύλλα.",
        "feedbackRule": "Δέντρ- + -ο.",
        "audioFile": "audio/dentro.mp3",
        "morphemes": {"root": "δέντρ", "suffix": "ο"},
    },
    {
        "id": "word-024",
        "word": "φύλλο",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Έπεσε ένα κίτρινο φύλλο.",
        "feedbackRule": "Φυλλ- + -ο (διπλό λ).",
        "audioFile": "audio/fyllo.mp3",
        "morphemes": {"root": "φυλλ", "suffix": "ο"},
        "ruleId": "double-consonant",
    },
    {
        "id": "word-025",
        "word": "σπίτι",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Το σπίτι μας είναι μπλε.",
        "feedbackRule": "Σπιτ- + -ι.",
        "audioFile": "audio/spiti.mp3",
        "morphemes": {"root": "σπιτ", "suffix": "ι"},
    },
    {
        "id": "word-026",
        "word": "παράθυρο",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Άνοιξε το παράθυρο για αέρα.",
        "feedbackRule": "Παραθυρ- + -ο.",
        "audioFile": "audio/parathyro.mp3",
        "morphemes": {"root": "παραθυρ", "suffix": "ο"},
    },
    {
        "id": "word-027",
        "word": "πόρτα",
        "grade": 3,
        "axis": "K",
        "hintSentence": "Χτύπησε στην πόρτα.",
        "feedbackRule": "Πορτ- + -α.",
        "audioFile": "audio/porta.mp3",
        "morphemes": {"root": "πορτ", "suffix": "α"},
        "ruleId": "tonos-basic",
    },
    {
        "id": "word-028",
        "word": "τραπέζι",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Βάλαμε τα πιάτα στο τραπέζι.",
        "feedbackRule": "Τραπεζ- + -ι.",
        "audioFile": "audio/trapezi.mp3",
        "morphemes": {"root": "τραπεζ", "suffix": "ι"},
    },
    {
        "id": "word-029",
        "word": "καρέκλα",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Κάθισε στην καρέκλα.",
        "feedbackRule": "Καρεκλ- + -α.",
        "audioFile": "audio/karekla.mp3",
        "morphemes": {"root": "καρεκλ", "suffix": "α"},
    },
    {
        "id": "word-030",
        "word": "κρεβάτι",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Πήγε για ύπνο στο κρεβάτι.",
        "feedbackRule": "Κρεβατ- + -ι.",
        "audioFile": "audio/krevati.mp3",
        "morphemes": {"root": "κρεβατ", "suffix": "ι"},
    },
    {
        "id": "word-031",
        "word": "μάθημα",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Το μάθημα των μαθηματικών ξεκίνησε.",
        "feedbackRule": "Μαθημ- + -α.",
        "audioFile": "audio/mathima.mp3",
        "morphemes": {"root": "μαθημ", "suffix": "α"},
    },
    {
        "id": "word-032",
        "word": "τετράδιο",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Έγραψα στο τετράδιό μου.",
        "feedbackRule": "Τετραδ- + -ιο.",
        "audioFile": "audio/tetradio.mp3",
        "morphemes": {"root": "τετραδ", "suffix": "ιο"},
    },
    {
        "id": "word-033",
        "word": "μολύβι",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Έσπασε το μολύβι μου.",
        "feedbackRule": "Μολυβ- + -ι.",
        "audioFile": "audio/molyvi.mp3",
        "morphemes": {"root": "μολυβ", "suffix": "ι"},
    },
    {
        "id": "word-034",
        "word": "γόμα",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Διόρθωσε με τη γόμα το λάθος.",
        "feedbackRule": "Γόμ- + -α.",
        "audioFile": "audio/goma.mp3",
        "morphemes": {"root": "γόμ", "suffix": "α"},
    },
    {
        "id": "word-035",
        "word": "κραγιόνι",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Ζωγράφισε με κόκκινο κραγιόνι.",
        "feedbackRule": "Κραγιον- + -ι.",
        "audioFile": "audio/kraggioni.mp3",
        "morphemes": {"root": "κραγιον", "suffix": "ι"},
    },
    {
        "id": "word-036",
        "word": "ποδήλατο",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Πήγα σχολείο με ποδήλατο.",
        "feedbackRule": "Ποδηλατ- + -ο.",
        "audioFile": "audio/podilato.mp3",
        "morphemes": {"root": "ποδηλατ", "suffix": "ο"},
    },
    {
        "id": "word-037",
        "word": "αυτοκίνητο",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Το αυτοκίνητο σταμάτησε στο φανάρι.",
        "feedbackRule": "Αυτοκινητ- + -ο.",
        "audioFile": "audio/aftokinito.mp3",
        "morphemes": {"root": "αυτοκινητ", "suffix": "ο"},
    },
    {
        "id": "word-038",
        "word": "λεωφορείο",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Πήραμε το λεωφορείο για την πόλη.",
        "feedbackRule": "Λεωφορ- + -είο.",
        "audioFile": "audio/leoforeio.mp3",
        "morphemes": {"root": "λεωφορ", "suffix": "είο"},
    },
    {
        "id": "word-039",
        "word": "γέφυρα",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Περάσαμε τη γέφυρα πάνω από το ποτάμι.",
        "feedbackRule": "Γεφυρ- + -α.",
        "audioFile": "audio/gefyra.mp3",
        "morphemes": {"root": "γεφυρ", "suffix": "α"},
    },
    {
        "id": "word-040",
        "word": "πλατεία",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Παίξαμε στην πλατεία του χωριού.",
        "feedbackRule": "Πλατει- + -α.",
        "audioFile": "audio/plateia.mp3",
        "morphemes": {"root": "πλατει", "suffix": "α"},
    },
    {
        "id": "word-041",
        "word": "αγορά",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Πήγαμε στην αγορά για ψωμί.",
        "feedbackRule": "Αγορ- + -ά.",
        "audioFile": "audio/agora.mp3",
        "morphemes": {"root": "αγορ", "suffix": "ά"},
    },
    {
        "id": "word-042",
        "word": "νοσοκομείο",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Ο γιατρός δούλεψε στο νοσοκομείο.",
        "feedbackRule": "Νοσοκομ- + -είο.",
        "audioFile": "audio/nosokomeio.mp3",
        "morphemes": {"root": "νοσοκομ", "suffix": "είο"},
    },
    {
        "id": "word-043",
        "word": "γιατρός",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Ο γιατρός μας εξέτασε.",
        "feedbackRule": "Γιατρ- + -ός.",
        "audioFile": "audio/giatros.mp3",
        "morphemes": {"root": "γιατρ", "suffix": "ός"},
    },
    {
        "id": "word-044",
        "word": "δάσκαλος",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Στο σχολείο, ___ μας διάβασε μια ιστορία.",
        "feedbackRule": "Δασκαλ- + -ος.",
        "audioFile": "audio/daskalos.mp3",
        "morphemes": {"root": "δασκαλ", "suffix": "ος"},
    },
    {
        "id": "word-045",
        "word": "μαθητής",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Ο μαθητής απάντησε σωστά.",
        "feedbackRule": "Μαθητ- + -ής.",
        "audioFile": "audio/mathitis.mp3",
        "morphemes": {"root": "μαθητ", "suffix": "ής"},
    },
    {
        "id": "word-046",
        "word": "γονιός",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Ο γονιός μου με πήγε στο σχολείο.",
        "feedbackRule": "Γον- + -ιός.",
        "audioFile": "audio/gonios.mp3",
        "morphemes": {"root": "γον", "suffix": "ιός"},
    },
    {
        "id": "word-047",
        "word": "αδελφός",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Η ___ μου παίζει μαζί μου.",
        "feedbackRule": "Αδελφ- + -ός.",
        "audioFile": "audio/adelphos.mp3",
        "morphemes": {"root": "αδελφ", "suffix": "ός"},
    },
    {
        "id": "word-048",
        "word": "γειτονιά",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Η γειτονιά μας είναι ήσυχη.",
        "feedbackRule": "Γειτον- + -ιά.",
        "audioFile": "audio/geitonia.mp3",
        "morphemes": {"root": "γειτον", "suffix": "ιά"},
    },
    {
        "id": "word-049",
        "word": "χαρά",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Ένιωσα χαρά όταν κέρδισα.",
        "feedbackRule": "Χαρ- + -ά.",
        "audioFile": "audio/chara.mp3",
        "morphemes": {"root": "χαρ", "suffix": "ά"},
    },
    {
        "id": "word-050",
        "word": "ελπίδα",
        "grade": 3,
        "axis": "R",
        "hintSentence": "Έχω ελπίδα ότι θα τα καταφέρω.",
        "feedbackRule": "Ελπιδ- + -α.",
        "audioFile": "audio/elpida.mp3",
        "morphemes": {"root": "ελπιδ", "suffix": "α"},
    },
]


def assign_ids(words: list[dict], prefix: str) -> list[dict]:
    result = []
    for i, word in enumerate(words, start=1):
        entry = dict(word)
        entry["id"] = f"{prefix}-{i:03d}"
        result.append(entry)
    return result


def build_words() -> list[dict]:
    grade_2 = assign_ids(GRADE_2[:50], "g2")
    grade_3_extra = assign_ids(GRADE_3_EXTRA[:100], "g3")
    grade_4 = assign_ids(GRADE_4[:50], "g4")
    return grade_2 + GRADE_3_BASE + grade_3_extra + grade_4


def main() -> None:
    words = build_words()
    seed_count = len(words)
    words, hk_counts, imported = append_helexkids(words, INPUTS_DIR)
    by_grade = count_by_grade(words)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"version": 2, "grade": 0, "words": words}
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    OUTPUT_FILE.write_text(text, encoding="utf-8")
    WEB_WORDS.parent.mkdir(parents=True, exist_ok=True)
    WEB_WORDS.write_text(text, encoding="utf-8")

    print(f"Wrote {len(words)} words to {OUTPUT_FILE} ({seed_count} seed + {imported} HelexKids)")
    print(f"Synced to {WEB_WORDS}")
    print(
        f"By grade: G1={by_grade[1]}, G2={by_grade[2]}, G3={by_grade[3]}, G4={by_grade[4]}"
    )
    if imported:
        print(
            f"HelexKids added: G1={hk_counts[1]}, G2={hk_counts[2]}, "
            f"G3={hk_counts[3]}, G4={hk_counts[4]}"
        )


if __name__ == "__main__":
    main()
