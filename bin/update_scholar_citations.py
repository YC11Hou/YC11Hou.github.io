#!/usr/bin/env python
"""Scrape the Google Scholar profile, update _data/citations.yml (the build-time fallback)
and push the counts to the site's /scholar endpoint (cf/likes Worker), which pages read live.
A plain page request works from GitHub runners; scholarly's multi-step session did not.
Exit 1 only when the data has not been refreshed for STALE_DAYS, so a one-off block stays quiet."""

import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone

import yaml

OUTPUT_FILE = "_data/citations.yml"
STALE_DAYS = 3
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"

with open("_data/socials.yml") as f:
    user = yaml.safe_load(f)["scholar_userid"]
with open("_config.yml") as f:
    api = (yaml.safe_load(f) or {}).get("likes_api") or ""
with open(OUTPUT_FILE) as f:
    data = yaml.safe_load(f) or {}


def fetch():
    url = "https://scholar.google.com/citations?user=%s&hl=en&pagesize=100" % user
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=30) as r:
        html = r.read().decode("utf-8", "replace")
    papers = {}
    for row in html.split('class="gsc_a_tr"')[1:]:
        pid = re.search(r"citation_for_view=[\w-]+:([\w-]+)", row)
        if not pid:
            continue
        n = re.search(r'gsc_a_ac gs_ibl"[^>]*>(\d*)<', row)
        cites = re.search(r"cites=(\d+)", row)
        title = re.search(r'class="gsc_a_at"[^>]*>([^<]+)<', row)
        year = re.search(r'gsc_a_h gsc_a_hc gs_ibl"[^>]*>(\d*)<', row)
        papers[pid.group(1)] = {
            "citations": int(n.group(1)) if n and n.group(1) else 0,
            "cites": cites.group(1) if cites else None,
            "title": title.group(1) if title else "",
            "year": year.group(1) if year else "",
        }
    if not papers:
        raise RuntimeError("captcha or layout change" if "captcha" in html.lower() else "no publication rows")
    return papers


def stale_exit(reason):
    last = str((data.get("metadata") or {}).get("last_updated", "1970-01-01"))
    age = (datetime.now(timezone.utc).date() - datetime.strptime(last, "%Y-%m-%d").date()).days
    print("Scholar fetch failed (%s); data is %d day(s) old." % (reason, age))
    sys.exit(1 if age >= STALE_DAYS else 0)


papers = None
for attempt in range(3):
    try:
        papers = fetch()
        break
    except Exception as e:
        err = e
        time.sleep(10)
if papers is None:
    stale_exit(err)

for pid, p in papers.items():
    print("%s: %d citations" % (p["title"] or pid, p["citations"]))

if api and os.environ.get("SCHOLAR_TOKEN"):
    body = json.dumps({"papers": {k: {"citations": v["citations"], "cites": v["cites"]} for k, v in papers.items()}}).encode()
    req = urllib.request.Request(
        api + "/scholar",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + os.environ["SCHOLAR_TOKEN"], "User-Agent": "yuchenhou-site-ci/1.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        print("Pushed to %s/scholar: HTTP %d" % (api, r.status))
else:
    print("SCHOLAR_TOKEN not set; live endpoint not updated.")

old = data.get("papers") or {}
new = {k: {"citations": v["citations"], "title": v["title"] or (old.get(k) or {}).get("title", ""), "year": v["year"] or (old.get(k) or {}).get("year", "")} for k, v in papers.items()}
if {k: v["citations"] for k, v in new.items()} == {k: (v or {}).get("citations") for k, v in old.items()}:
    # Counts unchanged: only advance the date when it is stale, so the file is not committed every hour.
    last = str((data.get("metadata") or {}).get("last_updated", ""))
    if last == datetime.now(timezone.utc).strftime("%Y-%m-%d"):
        print("No changes in citation data.")
        sys.exit(0)
data = {"metadata": {"last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%d")}, "papers": new}
with open(OUTPUT_FILE, "w") as f:
    yaml.dump(data, f, width=1000, sort_keys=True, allow_unicode=True)
print("Citation data saved to", OUTPUT_FILE)
