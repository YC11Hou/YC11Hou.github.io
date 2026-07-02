#!/usr/bin/env python3
"""Transform _data/cv.yml (al-folio website format) into a strict RenderCV input file.

The website keeps extra fields (logo, url, studyType, label, image, summary, icon,
level) that RenderCV's schema rejects. This script maps/strips them so the
"Render a CV" workflow can produce a PDF without changing the website data.

Usage: python3 bin/rendercv_transform.py _data/cv.yml _data/cv_rendercv.yaml
"""

import sys

import yaml

DEGREE_MAP = {
    "Master of Science": "M.Sc.",
    "Bachelor of Engineering": "B.Eng.",
    "Master of Engineering": "M.Eng.",
    "Bachelor of Science": "B.Sc.",
    "Doctor of Philosophy": "Ph.D.",
}


def norm_date(value):
    """Normalize dates: keep YYYY / YYYY-MM / YYYY-MM-DD strings, map Present -> present."""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    if s.lower() == "present":
        return "present"
    return s


def education_entry(e):
    out = {
        "institution": e.get("institution", ""),
        "area": e.get("area", ""),
    }
    degree = e.get("studyType") or e.get("degree")
    if degree:
        out["degree"] = DEGREE_MAP.get(degree, degree)
    for src, dst in (("start_date", "start_date"), ("end_date", "end_date"), ("location", "location")):
        v = e.get(src)
        if src.endswith("date"):
            v = norm_date(v)
        if v:
            out[dst] = v
    if e.get("highlights"):
        out["highlights"] = list(e["highlights"])
    return out


def experience_entry(e):
    out = {
        "company": e.get("company") or e.get("name", ""),
        "position": e.get("position", ""),
    }
    for key in ("location", "summary"):
        if e.get(key):
            out[key] = e[key]
    for key in ("start_date", "end_date"):
        v = norm_date(e.get(key))
        if v:
            out[key] = v
    if e.get("highlights"):
        out["highlights"] = list(e["highlights"])
    return out


def award_entry(a):
    label = a.get("title", "")
    details = a.get("awarder", "")
    if a.get("date"):
        details = f"{details} ({a['date']})" if details else str(a["date"])
    return {"label": label, "details": details}


def skill_entry(s):
    return {"label": s.get("name", ""), "details": str(s.get("keywords", ""))}


def language_entry(lang):
    return {"label": lang.get("name", ""), "details": lang.get("summary", "")}


def main(src_path, dst_path):
    with open(src_path) as f:
        data = yaml.safe_load(f)

    cv = data["cv"]
    out_cv = {}
    for key in ("name", "location", "email", "phone", "website"):
        if cv.get(key):
            out_cv[key] = cv[key]
    if cv.get("social_networks"):
        out_cv["social_networks"] = cv["social_networks"]

    sections = {}
    if cv.get("summary"):
        sections["Summary"] = [cv["summary"]]

    src_sections = cv.get("sections", {})
    if src_sections.get("Education"):
        sections["Education"] = [education_entry(e) for e in src_sections["Education"]]
    if src_sections.get("Experience"):
        sections["Experience"] = [experience_entry(e) for e in src_sections["Experience"]]
    if src_sections.get("Awards"):
        sections["Awards"] = [award_entry(a) for a in src_sections["Awards"]]
    if src_sections.get("Skills"):
        sections["Skills"] = [skill_entry(s) for s in src_sections["Skills"]]
    if src_sections.get("Languages"):
        sections["Languages"] = [language_entry(lang) for lang in src_sections["Languages"]]

    out_cv["sections"] = sections

    with open(dst_path, "w") as f:
        yaml.safe_dump({"cv": out_cv}, f, sort_keys=False, allow_unicode=True)
    print(f"Wrote {dst_path}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
