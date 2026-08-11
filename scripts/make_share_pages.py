"""Generate static share/OG stub pages for player & team profiles.

Social crawlers don't run JS or read URL hash fragments, so a shared SPA link
(`.../#/player/<id>`) only ever shows the generic site card. This writes a tiny
static HTML page per entity with real Open Graph / Twitter meta (name, face or
logo, a stat line) that then redirects a human into the SPA. The profile
"Copy link" button points at these pages.

Run after build_data.py (needs public/data/*.json). No external deps beyond the
standard library.
"""
from __future__ import annotations

import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
OUT = ROOT / "public" / "s"
SITE = "https://mikeapter.github.io/nfl-graphs/"


def face_square(url: str) -> str | None:
    if not isinstance(url, str) or not url:
        return None
    # Cloudinary: square, face-cropped, 600px — a crisp preview thumbnail
    return url.replace("/f_auto,q_auto/", "/f_auto,q_auto,w_600,h_600,c_fill,g_face/")


PAGE = """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="NFL Graphs">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{ogurl}">
<meta property="og:image" content="{img}">
<meta name="twitter:card" content="{card}">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{img}">
<link rel="canonical" href="{hashurl}">
<meta http-equiv="refresh" content="0;url={hashurl}">
<script>location.replace({hashjson});</script>
<style>body{{background:#0b0f17;color:#e8edf6;font-family:system-ui,sans-serif;text-align:center;padding:40px}}a{{color:#4da3ff}}</style>
</head><body>
<p>Opening <a href="{hashurl}">{title}</a> on NFL Graphs…</p>
</body></html>
"""


def write_page(path: Path, *, title, desc, img, card, hashurl, ogurl):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(PAGE.format(
        title=html.escape(title), desc=html.escape(desc), img=html.escape(img or SITE + "og.png"),
        card=card, hashurl=html.escape(hashurl), ogurl=html.escape(ogurl),
        hashjson=json.dumps(hashurl),
    ), encoding="utf-8")


def main():
    meta = json.loads((DATA / "meta.json").read_text(encoding="utf-8"))
    seasons = sorted(meta["seasons"])  # ascending; latest overwrites
    team_names = {a: t["name"] for a, t in meta["teams"].items()}
    team_logos = {a: SITE + t["logo"] for a, t in meta["teams"].items()}

    players: dict[str, dict] = {}   # id -> latest-season info
    latest_teams: list = []
    for s in seasons:
        f = DATA / f"season_{s}.json"
        if not f.exists():
            continue
        payload = json.loads(f.read_text(encoding="utf-8"))
        latest_teams = payload.get("teams", latest_teams)
        for p in payload.get("players", []):
            pid = p.get("id")
            if not pid:
                continue
            players[pid] = {"n": p.get("player", ""), "pos": p.get("pos", ""), "team": p.get("team", ""),
                            "face": p.get("face"), "season": s, "g": p.get("games")}

    np = 0
    for pid, p in players.items():
        tname = team_names.get(p["team"], p["team"])
        pos = p["pos"] or "NFL"
        title = f"{p['n']} — {tname} | NFL Graphs"
        desc = f"{p['n']}: {pos} · {tname}. Percentile ranks, game log, advanced stats and career trends on NFL Graphs."
        img = face_square(p["face"]) or team_logos.get(p["team"], SITE + "og.png")
        card = "summary" if p["face"] else "summary_large_image"
        hashurl = f"{SITE}#/player/{pid}"
        write_page(OUT / "p" / f"{pid}.html", title=title, desc=desc, img=img, card=card,
                   hashurl=hashurl, ogurl=f"{SITE}s/p/{pid}.html")
        np += 1

    rec = {t["team"]: t for t in latest_teams}
    nt = 0
    for abbr, tname in team_names.items():
        r = rec.get(abbr)
        recstr = ""
        if r:
            recstr = f" ({r.get('w', 0)}-{r.get('l', 0)}{('-' + str(r['t'])) if r.get('t') else ''})"
        title = f"{tname} — NFL Graphs"
        desc = f"{tname}{recstr}: team EPA, rankings, schedule, red-zone splits, roster salaries and more on NFL Graphs."
        hashurl = f"{SITE}#/team/{abbr}"
        write_page(OUT / "t" / f"{abbr}.html", title=title, desc=desc, img=team_logos[abbr],
                   card="summary", hashurl=hashurl, ogurl=f"{SITE}s/t/{abbr}.html")
        nt += 1

    print(f"wrote {np} player + {nt} team share pages to public/s/")


if __name__ == "__main__":
    main()
