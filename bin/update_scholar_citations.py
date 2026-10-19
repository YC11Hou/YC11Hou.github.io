#!/usr/bin/env python
"""Refresh _data/citations.yml (the build-time fallback for citation badges) from the
site's own /scholar endpoint (cf/likes Worker -> SerpAPI -> Google Scholar), so the
static numbers match the live ones. Scholar itself blocks CI runners, so it is not scraped here."""

import json
import sys
import urllib.request
from datetime import datetime

import yaml

OUTPUT_FILE = "_data/citations.yml"

with open("_config.yml") as f:
    api = (yaml.safe_load(f) or {}).get("likes_api") or ""
if not api:
    sys.exit("likes_api is not set in _config.yml")

req = urllib.request.Request(api + "/scholar", headers={"Origin": "https://yuchenhou.me", "User-Agent": "yuchenhou-site-ci/1.0"})
with urllib.request.urlopen(req, timeout=30) as r:
    live = json.load(r)
if not live.get("papers"):
    sys.exit("No papers from %s/scholar: %s" % (api, live.get("error", "empty response")))

with open(OUTPUT_FILE) as f:
    data = yaml.safe_load(f) or {}
papers = data.get("papers") or {}
changed = False
for pub_id, p in live["papers"].items():
    entry = papers.setdefault(pub_id, {})
    if entry.get("citations") != p["citations"]:
        entry["citations"] = p["citations"]
        changed = True
    print("%s: %s citations" % (entry.get("title", pub_id), p["citations"]))

if not changed:
    print("No changes in citation data.")
    sys.exit(0)
data["papers"] = papers
data["metadata"] = {"last_updated": datetime.utcfromtimestamp(live["updated"]).strftime("%Y-%m-%d")}
with open(OUTPUT_FILE, "w") as f:
    yaml.dump(data, f, width=1000, sort_keys=True, allow_unicode=True)
print("Citation data saved to", OUTPUT_FILE)
