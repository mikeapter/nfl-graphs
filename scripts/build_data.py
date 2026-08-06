#!/usr/bin/env python3
"""
Build the static JSON data files for the NFL Graphs site from nflverse data.

Sources (all free, public, no auth):
  - Play-by-play parquet  -> team offensive/defensive EPA per play + weekly EPA
  - stats_player_reg CSV  -> player leaderboards
  - nfldata games.csv     -> standings, scores, weekly point differential

Outputs (written to public/data/):
  - meta.json             -> season list + team metadata (names, colors, logos)
  - season_<year>.json    -> everything the app needs for one season

Run:  python scripts/build_data.py
Env:  NFL_SEASONS="2023,2024,2025"  (override which seasons to build)
      NFL_CACHE=<dir>               (where downloads are cached)
"""
from __future__ import annotations
import io
import json
import os
import sys
import csv
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "public" / "data"
CACHE_DIR = Path(os.environ.get("NFL_CACHE", ROOT / ".cache"))

DEFAULT_SEASONS = [2023, 2024, 2025]
SEASONS = [int(s) for s in os.environ.get("NFL_SEASONS", "").split(",") if s.strip()] or DEFAULT_SEASONS

REL = "https://github.com/nflverse/nflverse-data/releases/download"
GAMES_URL = "https://github.com/nflverse/nfldata/raw/master/data/games.csv"

TOP_N = 30  # leaderboard depth

# ---------------------------------------------------------------------------
# Team metadata: division, conference, primary color, ESPN logo code
# ---------------------------------------------------------------------------
TEAMS = {
    "ARI": ("Arizona Cardinals",      "NFC", "West",  "#97233F", "ari"),
    "ATL": ("Atlanta Falcons",        "NFC", "South", "#A71930", "atl"),
    "BAL": ("Baltimore Ravens",       "AFC", "North", "#241773", "bal"),
    "BUF": ("Buffalo Bills",          "AFC", "East",  "#00338D", "buf"),
    "CAR": ("Carolina Panthers",      "NFC", "South", "#0085CA", "car"),
    "CHI": ("Chicago Bears",          "NFC", "North", "#0B162A", "chi"),
    "CIN": ("Cincinnati Bengals",     "AFC", "North", "#FB4F14", "cin"),
    "CLE": ("Cleveland Browns",       "AFC", "North", "#311D00", "cle"),
    "DAL": ("Dallas Cowboys",         "NFC", "East",  "#003594", "dal"),
    "DEN": ("Denver Broncos",         "AFC", "West",  "#FB4F14", "den"),
    "DET": ("Detroit Lions",          "NFC", "North", "#0076B6", "det"),
    "GB":  ("Green Bay Packers",      "NFC", "North", "#203731", "gb"),
    "HOU": ("Houston Texans",         "AFC", "South", "#03202F", "hou"),
    "IND": ("Indianapolis Colts",     "AFC", "South", "#002C5F", "ind"),
    "JAX": ("Jacksonville Jaguars",   "AFC", "South", "#006778", "jax"),
    "KC":  ("Kansas City Chiefs",     "AFC", "West",  "#E31837", "kc"),
    "LV":  ("Las Vegas Raiders",      "AFC", "West",  "#000000", "lv"),
    "LAC": ("Los Angeles Chargers",   "AFC", "West",  "#0080C6", "lac"),
    "LA":  ("Los Angeles Rams",       "NFC", "West",  "#003594", "lar"),
    "MIA": ("Miami Dolphins",         "AFC", "East",  "#008E97", "mia"),
    "MIN": ("Minnesota Vikings",      "NFC", "North", "#4F2683", "min"),
    "NE":  ("New England Patriots",   "AFC", "East",  "#002244", "ne"),
    "NO":  ("New Orleans Saints",     "NFC", "South", "#D3BC8D", "no"),
    "NYG": ("New York Giants",        "NFC", "East",  "#0B2265", "nyg"),
    "NYJ": ("New York Jets",          "AFC", "East",  "#125740", "nyj"),
    "PHI": ("Philadelphia Eagles",    "NFC", "East",  "#004C54", "phi"),
    "PIT": ("Pittsburgh Steelers",    "AFC", "North", "#FFB612", "pit"),
    "SEA": ("Seattle Seahawks",       "NFC", "West",  "#69BE28", "sea"),
    "SF":  ("San Francisco 49ers",    "NFC", "West",  "#AA0000", "sf"),
    "TB":  ("Tampa Bay Buccaneers",   "NFC", "South", "#D50A0A", "tb"),
    "TEN": ("Tennessee Titans",       "AFC", "South", "#0C2340", "ten"),
    "WAS": ("Washington Commanders",  "NFC", "East",  "#5A1414", "was"),
}
LOGO_DIR = ROOT / "public" / "logos"
ESPN_LOGO = lambda abbr: f"https://a.espncdn.com/i/teamlogos/nfl/500/{TEAMS[abbr][4]}.png"


def download_logos():
    """Fetch team logos to public/logos/ so they are served same-origin.
    Same-origin images don't taint the <canvas>, which lets the charts export
    to PNG. Missing ones fall back to nothing (chart still renders)."""
    LOGO_DIR.mkdir(parents=True, exist_ok=True)
    for abbr in TEAMS:
        fetch(ESPN_LOGO(abbr), LOGO_DIR / f"{abbr}.png")


# ---------------------------------------------------------------------------
# Download helpers (cached)
# ---------------------------------------------------------------------------
def fetch(url: str, dest: Path, force: bool = False) -> Path | None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and not force and dest.stat().st_size > 0:
        return dest
    try:
        print(f"  downloading {url}")
        req = urllib.request.Request(url, headers={"User-Agent": "nfl-graphs-build"})
        with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
            f.write(r.read())
        return dest
    except Exception as e:  # noqa: BLE001
        print(f"  !! failed: {e}")
        if dest.exists():
            dest.unlink(missing_ok=True)
        return None


def load_pbp(season: int) -> pd.DataFrame | None:
    p = fetch(f"{REL}/pbp/play_by_play_{season}.parquet", CACHE_DIR / f"pbp_{season}.parquet")
    if not p:
        return None
    cols = ["season", "week", "season_type", "posteam", "defteam", "pass", "rush", "epa"]
    return pd.read_parquet(p, columns=cols)


def load_player_reg(season: int) -> pd.DataFrame | None:
    p = fetch(f"{REL}/stats_player/stats_player_reg_{season}.csv", CACHE_DIR / f"player_reg_{season}.csv")
    if not p:
        return None
    return pd.read_csv(p, low_memory=False)


def load_team_reg(season: int) -> pd.DataFrame | None:
    p = fetch(f"{REL}/stats_team/stats_team_reg_{season}.csv", CACHE_DIR / f"team_reg_{season}.csv")
    if not p:
        return None
    return pd.read_csv(p, low_memory=False)


def load_player_week(season: int) -> pd.DataFrame | None:
    p = fetch(f"{REL}/stats_player/stats_player_week_{season}.csv", CACHE_DIR / f"player_week_{season}.csv")
    if not p:
        return None
    return pd.read_csv(p, low_memory=False)


def build_weekly(pweek: pd.DataFrame, ids: set) -> dict:
    """Compact per-player weekly (regular-season) game log for the shipped players."""
    df = pweek[(pweek["season_type"] == "REG") & (pweek["player_id"].isin(ids))]
    g = lambda r, c: (0 if pd.isna(r.get(c)) else r.get(c))
    out: dict[str, dict] = {}
    for pid, grp in df.groupby("player_id"):
        grp = grp.sort_values("week")
        rec = {"wk": [], "py": [], "ry": [], "recy": [], "rec": [], "td": [], "ppr": []}
        for _, r in grp.iterrows():
            rec["wk"].append(int(r["week"]))
            rec["py"].append(int(g(r, "passing_yards")))
            rec["ry"].append(int(g(r, "rushing_yards")))
            rec["recy"].append(int(g(r, "receiving_yards")))
            rec["rec"].append(int(g(r, "receptions")))
            rec["td"].append(int(g(r, "passing_tds") + g(r, "rushing_tds") + g(r, "receiving_tds")))
            rec["ppr"].append(round(float(g(r, "fantasy_points_ppr")), 1))
        out[pid] = rec
    return out


# Raw stat columns shipped to the browser (the UI's stat catalog picks from these
# and derives rates like completion% client-side).
PLAYER_FIELDS = [
    "games",
    "completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions",
    "passing_epa", "passing_cpoe", "passing_air_yards", "passing_first_downs", "sacks_suffered",
    "carries", "rushing_yards", "rushing_tds", "rushing_epa", "rushing_first_downs", "rushing_fumbles_lost",
    "targets", "receptions", "receiving_yards", "receiving_tds", "receiving_epa",
    "receiving_first_downs", "receiving_air_yards", "receiving_yards_after_catch",
    "target_share", "air_yards_share", "wopr", "racr",
    "fantasy_points", "fantasy_points_ppr",
]
TEAM_FIELDS = [
    "completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions",
    "passing_epa", "passing_first_downs", "passing_air_yards", "sacks_suffered",
    "carries", "rushing_yards", "rushing_tds", "rushing_epa", "rushing_first_downs",
    "def_sacks", "def_interceptions", "def_tds", "def_pass_defended",
    "penalties", "penalty_yards", "fg_made", "fg_att",
]


# ---------------------------------------------------------------------------
# Computations
# ---------------------------------------------------------------------------
def _num(v, nd=2):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    f = float(v)
    return int(f) if f.is_integer() else round(f, nd)


def build_teams(pbp: pd.DataFrame, team_df, team_record: dict) -> list[dict]:
    """One rich row per team: EPA per play + selected season totals + record."""
    df = pbp[(pbp["season_type"] == "REG") & (pbp["epa"].notna())]
    df = df[(df["pass"] == 1) | (df["rush"] == 1)]
    off = df.groupby("posteam")["epa"].agg(["mean", "count"])
    dfn = df.groupby("defteam")["epa"].mean()

    tmap = {}
    if team_df is not None:
        tdf = team_df[team_df["season_type"] == "REG"] if "season_type" in team_df.columns else team_df
        tmap = {r["team"]: r for _, r in tdf.iterrows()}

    out = []
    for abbr in TEAMS:
        if abbr not in off.index:
            continue
        row = {
            "team": abbr,
            "off_epa": _num(off.loc[abbr, "mean"], 4),
            "def_epa": _num(dfn.loc[abbr], 4) if abbr in dfn.index else None,
            "off_plays": int(off.loc[abbr, "count"]),
        }
        tr = tmap.get(abbr)
        if tr is not None:
            for f in TEAM_FIELDS:
                if f in tr:
                    v = _num(tr[f])
                    if v is not None:
                        row[f] = v
        rec = team_record.get(abbr)
        if rec:
            row.update({"w": rec["w"], "l": rec["l"], "t": rec["t"],
                        "pf": rec["pf"], "pa": rec["pa"], "pd": rec["pf"] - rec["pa"]})
        out.append(row)
    return out


def compute_team_weekly_epa(pbp: pd.DataFrame) -> dict[str, dict]:
    """Per-team weekly off/def EPA per play (regular season)."""
    df = pbp[(pbp["season_type"] == "REG") & (pbp["epa"].notna())]
    df = df[(df["pass"] == 1) | (df["rush"] == 1)]
    off = df.groupby(["posteam", "week"])["epa"].mean().round(4)
    dfn = df.groupby(["defteam", "week"])["epa"].mean().round(4)
    res: dict[str, dict] = {}
    for abbr in TEAMS:
        o = off.loc[abbr] if abbr in off.index.get_level_values(0) else pd.Series(dtype=float)
        d = dfn.loc[abbr] if abbr in dfn.index.get_level_values(0) else pd.Series(dtype=float)
        weeks = sorted(set(o.index) | set(d.index))
        if not weeks:
            continue
        res[abbr] = {
            "weeks": [int(w) for w in weeks],
            "off_epa": [float(o.get(w)) if w in o.index else None for w in weeks],
            "def_epa": [float(d.get(w)) if w in d.index else None for w in weeks],
        }
    return res


def build_players(pdf: pd.DataFrame) -> list[dict]:
    """One row per relevant offensive player with a broad set of season stats."""
    keep = pd.Series(False, index=pdf.index)
    for col, thr in [("attempts", 5), ("carries", 5), ("targets", 3), ("fantasy_points_ppr", 1)]:
        if col in pdf.columns:
            keep = keep | (pdf[col].fillna(0) >= thr)
    out = []
    for _, r in pdf[keep].iterrows():
        hs = r.get("headshot_url")
        item = {
            "id": r.get("player_id"),
            "player": r.get("player_display_name") or r.get("player_name"),
            "team": r.get("recent_team"),
            "pos": r.get("position"),
            "grp": r.get("position_group"),
            "face": hs if isinstance(hs, str) and hs else None,
        }
        item = {k: v for k, v in item.items() if v is not None}
        for f in PLAYER_FIELDS:
            if f in r:
                v = _num(r[f])
                if v is not None:
                    item[f] = v
        out.append(item)
    return out


def build_standings_scores_trends(games_path: Path, season: int):
    """Standings (REG), scores (all game types), and weekly point-diff trends."""
    rows = []
    with open(games_path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if int(r["season"]) != season:
                continue
            rows.append(r)

    # --- Standings (regular season, completed games only) ---
    rec: dict[str, dict] = {a: {"w": 0, "l": 0, "t": 0, "pf": 0, "pa": 0} for a in TEAMS}
    for r in rows:
        if r["game_type"] != "REG" or r["home_score"] == "" or r["away_score"] == "":
            continue
        h, a = r["home_team"], r["away_team"]
        hs, as_ = int(r["home_score"]), int(r["away_score"])
        if h not in rec or a not in rec:
            continue
        rec[h]["pf"] += hs; rec[h]["pa"] += as_
        rec[a]["pf"] += as_; rec[a]["pa"] += hs
        if hs > as_:
            rec[h]["w"] += 1; rec[a]["l"] += 1
        elif as_ > hs:
            rec[a]["w"] += 1; rec[h]["l"] += 1
        else:
            rec[h]["t"] += 1; rec[a]["t"] += 1

    standings: dict[str, list] = {}
    for abbr, d in rec.items():
        gp = d["w"] + d["l"] + d["t"]
        if gp == 0:
            continue
        conf, div = TEAMS[abbr][1], TEAMS[abbr][2]
        key = f"{conf} {div}"
        pct = (d["w"] + 0.5 * d["t"]) / gp if gp else 0
        standings.setdefault(key, []).append({
            "team": abbr, "w": d["w"], "l": d["l"], "t": d["t"],
            "pf": d["pf"], "pa": d["pa"], "pd": d["pf"] - d["pa"], "pct": round(pct, 3),
        })
    for key in standings:
        standings[key].sort(key=lambda x: (-x["pct"], -x["pd"]))

    # --- Scores by week (completed games, REG + POST) ---
    scores: dict[str, list] = {}
    for r in rows:
        if r["home_score"] == "" or r["away_score"] == "":
            continue
        wk = f"{r['game_type']}-{int(r['week']):02d}" if r["game_type"] != "REG" else f"{int(r['week']):02d}"
        scores.setdefault(wk, []).append({
            "away": r["away_team"], "home": r["home_team"],
            "as": int(r["away_score"]), "hs": int(r["home_score"]),
            "date": r.get("gameday", ""),
        })

    # --- Weekly point-differential trend (REG) ---
    trends: dict[str, dict] = {a: {"weeks": [], "pd": [], "result": []} for a in TEAMS}
    for r in sorted(rows, key=lambda x: (x["game_type"] != "REG", int(x["week"]))):
        if r["game_type"] != "REG" or r["home_score"] == "" or r["away_score"] == "":
            continue
        h, a = r["home_team"], r["away_team"]
        hs, as_ = int(r["home_score"]), int(r["away_score"])
        wk = int(r["week"])
        if h in trends:
            trends[h]["weeks"].append(wk); trends[h]["pd"].append(hs - as_)
            trends[h]["result"].append("W" if hs > as_ else "L" if hs < as_ else "T")
        if a in trends:
            trends[a]["weeks"].append(wk); trends[a]["pd"].append(as_ - hs)
            trends[a]["result"].append("W" if as_ > hs else "L" if as_ < hs else "T")
    trends = {k: v for k, v in trends.items() if v["weeks"]}
    return standings, scores, trends


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    games_path = fetch(GAMES_URL, CACHE_DIR / "games.csv", force=True)  # always refresh schedule
    if not games_path:
        print("FATAL: could not fetch games.csv")
        sys.exit(1)

    built = []
    for season in SEASONS:
        print(f"\n== Season {season} ==")
        pbp = load_pbp(season)
        players = load_player_reg(season)
        if pbp is None or players is None:
            print(f"  skipping {season} (missing pbp or player data)")
            continue

        team_df = load_team_reg(season)
        weekly_epa = compute_team_weekly_epa(pbp)
        standings, scores, trends = build_standings_scores_trends(games_path, season)

        team_record = {row["team"]: row for lst in standings.values() for row in lst}
        teams = build_teams(pbp, team_df, team_record)
        players_list = build_players(players)

        # weekly game logs (separate file, lazy-loaded by the profile pages)
        pweek = load_player_week(season)
        if pweek is not None:
            ids = {p["id"] for p in players_list if p.get("id")}
            weekly = build_weekly(pweek, ids)
            wf = DATA_DIR / f"weekly_{season}.json"
            wf.write_text(json.dumps({"season": season, "players": weekly}, separators=(",", ":")), encoding="utf-8")
            print(f"  wrote {wf.name}  ({wf.stat().st_size // 1024} KB)")

        # merge weekly EPA into the point-diff trends
        for abbr, wk in weekly_epa.items():
            t = trends.setdefault(abbr, {"weeks": [], "pd": [], "result": []})
            t["epa_weeks"] = wk["weeks"]
            t["off_epa"] = wk["off_epa"]
            t["def_epa"] = wk["def_epa"]

        payload = {
            "season": season,
            "teams": teams,
            "players": players_list,
            "standings": standings,
            "scores": scores,
            "trends": trends,
        }
        out = DATA_DIR / f"season_{season}.json"
        out.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        print(f"  wrote {out.name}  ({out.stat().st_size // 1024} KB)")
        built.append(season)

    if not built:
        print("FATAL: no seasons built")
        sys.exit(1)

    print("\n== Logos ==")
    download_logos()

    meta = {
        "seasons": sorted(built, reverse=True),
        "latest": max(built),
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "teams": {
            a: {"name": TEAMS[a][0], "conf": TEAMS[a][1], "div": TEAMS[a][2],
                "color": TEAMS[a][3], "logo": f"logos/{a}.png"}
            for a in TEAMS
        },
    }
    (DATA_DIR / "meta.json").write_text(json.dumps(meta, separators=(",", ":")), encoding="utf-8")
    print(f"\nwrote meta.json  (seasons: {meta['seasons']})")
    print("done.")


if __name__ == "__main__":
    main()
