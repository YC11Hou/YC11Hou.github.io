#!/usr/bin/env python3
"""Report which translated project bodies are missing or stale.

English _projects/<slug>.md is the source. Each translation _project_l10n/<lang>/<slug>.md records the
source_hash of the English title + body it was made from; when the English changes, the hash no longer
matches and the translation is reported stale. A translation is reported broken when its skeleton (anchors,
links, Liquid tags, figures, media, table rows) differs from the source.
Usage: tools/i18n/l10n_status.py [--hash <slug>] [--strict]
"""
import argparse
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "_projects"
L10N = ROOT / "_project_l10n"


def split(path):
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    return (m.group(1), m.group(2)) if m else ("", text)


def field(front, key):
    m = re.search(rf"^{key}:\s*(.+)$", front, re.M)
    return m.group(1).strip().strip('"').strip("'") if m else None


def source_hash(slug):
    front, body = split(SRC / f"{slug}.md")
    return hashlib.sha256(f"{field(front, 'title')}\n{body.strip()}".encode()).hexdigest()[:12]


def skeleton(body):
    pats = [r"\{#[\w-]+\}", r'href="[^"]*"', r'src="[^"]*"', r"\{\{.*?\}\}", r"\{%\s*include\s+\S+\s+name=\"[^\"]+\"",
            r"<(?:video|table|tr|figure|img|nav|ol|li)\b", r"^#{2,3} ", r"^\|"]
    return {p: sorted(re.findall(p, body, re.M)) for p in pats}


def broken(slug, path):
    a, b = skeleton(split(SRC / f"{slug}.md")[1]), skeleton(split(path)[1])
    return [p for p in a if a[p] != b[p]]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hash", metavar="SLUG", help="print the current source hash of one project")
    ap.add_argument("--strict", action="store_true", help="exit 1 if anything is missing or stale")
    a = ap.parse_args()
    if a.hash:
        print(source_hash(a.hash))
        return
    langs = [l.strip() for l in re.search(r"^languages:\s*\[(.*?)\]", (ROOT / "_config.yml").read_text(), re.M).group(1).split(",")]
    langs = [l for l in langs if l != "en"]
    bad = 0
    for src in sorted(SRC.glob("*.md")):
        slug, want = src.stem, source_hash(src.stem)
        row = []
        for lang in langs:
            t = L10N / lang / f"{slug}.md"
            if not t.exists():
                row.append(f"{lang}:missing")
                bad += 1
            elif field(split(t)[0], "source_hash") != want:
                row.append(f"{lang}:stale")
                bad += 1
            elif broken(slug, t):
                row.append(f"{lang}:broken({len(broken(slug, t))})")
                bad += 1
        print(f"{slug:28} {want}  " + (" ".join(row) if row else "all up to date"))
    sys.exit(1 if a.strict and bad else 0)


if __name__ == "__main__":
    main()
