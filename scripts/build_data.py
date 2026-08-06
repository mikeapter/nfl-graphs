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
    cols = ["season", "week", "season_type", "posteam", "defteam", "pass", "rush", "epa",
            "pass_attempt", "rush_attempt", "pass_location", "air_yards", "complete_pass",
            "yards_gained", "run_location", "run_gap",
            "passer_player_id", "receiver_player_id", "rusher_player_id"]
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


def load_ngs(kind: str) -> pd.DataFrame | None:
    p = fetch(f"{REL}/nextgen_stats/ngs_{kind}.parquet", CACHE_DIR / f"ngs_{kind}.parquet")
    return pd.read_parquet(p) if p else None


def load_snaps(season: int) -> pd.DataFrame | None:
    p = fetch(f"{REL}/snap_counts/snap_counts_{season}.csv", CACHE_DIR / f"snaps_{season}.csv")
    return pd.read_csv(p, low_memory=False) if p else None


def pfr_to_gsis() -> dict:
    p = fetch(f"{REL}/players/players.parquet", CACHE_DIR / "players.parquet")
    if not p:
        return {}
    pl = pd.read_parquet(p, columns=["gsis_id", "pfr_id"])
    pl = pl[pl["gsis_id"].notna() & pl["pfr_id"].notna()]
    return dict(zip(pl["pfr_id"], pl["gsis_id"]))


# Next Gen Stats to expose, per kind: (source column, shipped key)
NGS_PASSING = [("avg_time_to_throw", "ngs_ttt"), ("avg_intended_air_yards", "ngs_iay"),
               ("aggressiveness", "ngs_agg"), ("completion_percentage_above_expectation", "ngs_cpoe"),
               ("avg_air_yards_to_sticks", "ngs_ayts"), ("passer_rating", "ngs_rating"),
               ("expected_completion_percentage", "ngs_xcomp")]
NGS_RECEIVING = [("avg_separation", "ngs_sep"), ("avg_cushion", "ngs_cush"),
                 ("avg_yac_above_expectation", "ngs_yacoe"), ("percent_share_of_intended_air_yards", "ngs_airshare"),
                 ("avg_intended_air_yards", "ngs_tay")]
NGS_RUSHING = [("rush_yards_over_expected", "ngs_ryoe"), ("rush_yards_over_expected_per_att", "ngs_ryoe_att"),
               ("efficiency", "ngs_eff"), ("avg_time_to_los", "ngs_ttl"),
               ("percent_attempts_gte_eight_defenders", "ngs_stacked"), ("rush_pct_over_expected", "ngs_rpoe")]


def ngs_season_map(df, season, cols):
    """gsis_id -> {shipped key: value} for season totals (week 0, regular season)."""
    if df is None:
        return {}
    d = df[(df["season"] == season) & (df["week"] == 0) & (df["season_type"] == "REG")]
    out = {}
    for _, r in d.iterrows():
        gid = r.get("player_gsis_id")
        if not isinstance(gid, str):
            continue
        out[gid] = {key: _num(r[src]) for src, key in cols if src in r and _num(r[src]) is not None}
    return out


def enrich_advanced(players_list, season, xwalk):
    """Merge Next Gen Stats + snap share into the shipped player dicts."""
    passing = ngs_season_map(load_ngs("passing"), season, NGS_PASSING)
    receiving = ngs_season_map(load_ngs("receiving"), season, NGS_RECEIVING)
    rushing = ngs_season_map(load_ngs("rushing"), season, NGS_RUSHING)

    snaps = load_snaps(season)
    snap_pct = {}
    if snaps is not None:
        s = snaps[snaps["game_type"] == "REG"]
        by = s.groupby("pfr_player_id")["offense_pct"].mean()
        for pfr, v in by.items():
            gid = xwalk.get(pfr)
            if gid and not pd.isna(v):
                snap_pct[gid] = round(float(v) * 100, 1)

    for p in players_list:
        gid = p.get("id")
        if not gid:
            continue
        for src in (passing, receiving, rushing):
            if gid in src:
                p.update(src[gid])
        if gid in snap_pct:
            p["snap_pct"] = snap_pct[gid]


CFB_URL = "https://raw.githubusercontent.com/sportsdataverse/cfbfastR-data/main"
_cfb_id = lambda v: str(int(v)) if pd.notna(v) else None


def load_cfb(season: int):
    p = fetch(f"{CFB_URL}/player_stats/parquet/player_stats_{season}.parquet", CACHE_DIR / f"cfb_{season}.parquet")
    if not p:
        return None
    cols = ["game_id", "team", "completion_player_id", "completion_player", "completion_yds",
            "incompletion_player_id", "interception_thrown_player_id",
            "rush_player_id", "rush_player", "rush_yds",
            "reception_player_id", "reception_player", "reception_yds", "target_player_id",
            "touchdown_player_id"]
    return pd.read_parquet(p, columns=cols)


def load_cfb_rosters(season: int):
    p = fetch(f"{CFB_URL}/rosters/parquet/cfb_rosters_{season}.parquet", CACHE_DIR / f"cfb_rosters_{season}.parquet")
    if not p:
        return {}, {}
    r = pd.read_parquet(p)
    pos = {str(a): p2 for a, p2 in zip(r["athlete_id"], r["position"]) if pd.notna(a) and isinstance(p2, str)}
    face = {str(a): h for a, h in zip(r["athlete_id"], r.get("headshot_url", pd.Series([None] * len(r)))) if pd.notna(a) and isinstance(h, str) and h}
    return pos, face


def load_cfb_teaminfo(season: int) -> dict:
    """school -> {logo, color, conf, class, abbr}."""
    p = fetch(f"{CFB_URL}/team_info/parquet/cfb_team_info_{season}.parquet", CACHE_DIR / f"cfb_teaminfo_{season}.parquet")
    if not p:
        return {}
    ti = pd.read_parquet(p)
    out = {}
    for r in ti.itertuples(index=False):
        if not isinstance(r.school, str):
            continue
        out[r.school] = {
            "logo": f"https://a.espncdn.com/i/teamlogos/ncaa/500/{int(r.team_id)}.png" if pd.notna(r.team_id) else None,
            "color": r.color if isinstance(r.color, str) and r.color.startswith("#") else "#4da3ff",
            "conf": r.conference if isinstance(r.conference, str) else "",
            "class": (r.classification or "").upper() if isinstance(r.classification, str) else "",
            "abbr": r.abbreviation if isinstance(r.abbreviation, str) else r.school,
        }
    return out


def build_college(df, season: int):
    """Aggregate cfbfastR play rows into per-player season totals. TDs are
    reconstructed using roster positions (the QB is the passer; the other player
    on a pass-TD play is the scorer), which fixes the source's swapped columns."""
    from collections import defaultdict
    pos_map, face_map = load_cfb_rosters(season)
    teaminfo = load_cfb_teaminfo(season)
    acc = defaultdict(lambda: {"team": None, "cmp": 0, "att": 0, "pyd": 0.0, "int": 0,
                               "ptd": 0, "car": 0, "ryd": 0.0, "rtd": 0, "rec": 0, "tgt": 0,
                               "recyd": 0.0, "rectd": 0, "g": set()})
    names = {}
    def setmeta(pid, team, gid):
        a = acc[pid]
        if a["team"] is None:
            a["team"] = team
        a["g"].add(gid)

    for r in df.itertuples(index=False):
        gid, team = r.game_id, r.team
        cp, rp2, ru = _cfb_id(r.completion_player_id), _cfb_id(r.reception_player_id), _cfb_id(r.rush_player_id)
        if cp:
            setmeta(cp, team, gid); a = acc[cp]; a["cmp"] += 1; a["att"] += 1
            if pd.notna(r.completion_yds): a["pyd"] += r.completion_yds
            if isinstance(r.completion_player, str): names.setdefault(cp, r.completion_player)
        if pd.notna(r.incompletion_player_id):
            setmeta(_cfb_id(r.incompletion_player_id), team, gid); acc[_cfb_id(r.incompletion_player_id)]["att"] += 1
        if pd.notna(r.interception_thrown_player_id):
            setmeta(_cfb_id(r.interception_thrown_player_id), team, gid); acc[_cfb_id(r.interception_thrown_player_id)]["int"] += 1
        if ru:
            setmeta(ru, team, gid); a = acc[ru]; a["car"] += 1
            if pd.notna(r.rush_yds): a["ryd"] += r.rush_yds
            if isinstance(r.rush_player, str): names.setdefault(ru, r.rush_player)
        if rp2:
            setmeta(rp2, team, gid); a = acc[rp2]; a["rec"] += 1
            if pd.notna(r.reception_yds): a["recyd"] += r.reception_yds
            if isinstance(r.reception_player, str): names.setdefault(rp2, r.reception_player)
        if pd.notna(r.target_player_id):
            setmeta(_cfb_id(r.target_player_id), team, gid); acc[_cfb_id(r.target_player_id)]["tgt"] += 1
        # touchdowns (position-disambiguated)
        td = _cfb_id(r.touchdown_player_id)
        if td:
            if ru and ru == td:
                acc[ru]["rtd"] += 1
            else:
                inv = [x for x in dict.fromkeys([cp, rp2]) if x]
                if len(inv) == 2:
                    qbs = [x for x in inv if pos_map.get(x) == "QB"]
                    if len(qbs) == 1:
                        passer = qbs[0]; receiver = next(x for x in inv if x != passer)
                    elif td in inv:
                        receiver = td; passer = next(x for x in inv if x != td)
                    else:
                        passer, receiver = inv[0], inv[1]
                    acc[passer]["ptd"] += 1; acc[receiver]["rectd"] += 1

    teams_used, out = {}, []
    for pid, a in acc.items():
        if not (a["att"] >= 30 or a["car"] >= 25 or a["tgt"] >= 15):
            continue
        rp = pos_map.get(pid)
        pos = rp if rp in ("QB", "RB", "FB", "WR", "TE") else ("QB" if a["att"] >= 50 else "RB" if (a["car"] >= a["rec"] and a["car"] >= 20) else "WR")
        ti = teaminfo.get(a["team"], {})
        row = {"id": pid, "player": names.get(pid, pid), "team": a["team"], "pos": pos,
               "conf": ti.get("conf", ""), "class": ti.get("class", ""), "games": len(a["g"])}
        if pid in face_map:
            row["face"] = face_map[pid]
        for k in ("cmp", "att", "int", "ptd", "car", "rtd", "rec", "tgt", "rectd"):
            if a[k]:
                row[k] = a[k]
        for k in ("pyd", "ryd", "recyd"):
            if a[k]:
                row[k] = int(round(a[k]))
        out.append(row)
        if a["team"] and ti:
            teams_used[a["team"]] = ti
    return out, teams_used


def build_field(pbp: pd.DataFrame, ids: set) -> dict:
    """Per-player field maps from play-by-play:
      pass  (QB throws) / tgt (targets) : 3 dirs x 4 depth buckets, [att, comp, yards]
      rush  : 7 gap zones [LE,LT,LG,M,RG,RT,RE], [att, yards]
    Depth buckets by air_yards: <0 behind, 0-9 short, 10-19 mid, 20+ deep."""
    DIR = {"left": 0, "middle": 1, "right": 2}
    def depth(ay):
        if ay < 0: return 0
        if ay < 10: return 1
        if ay < 20: return 2
        return 3
    def blank_grid():
        return [[0, 0, 0] for _ in range(12)]  # (dir*4 + depth)

    out: dict[str, dict] = {}
    df = pbp[pbp["season_type"] == "REG"]

    # passing (by passer) & targets (by receiver)
    pa = df[(df["pass_attempt"] == 1) & df["pass_location"].notna() & df["air_yards"].notna()]
    for _, r in pa.iterrows():
        di = DIR.get(r["pass_location"]); de = depth(r["air_yards"])
        if di is None: continue
        idx = di * 4 + de
        comp = 1 if r.get("complete_pass") == 1 else 0
        yds = int(r["yards_gained"]) if comp and not pd.isna(r.get("yards_gained")) else 0
        for pid, key in [(r.get("passer_player_id"), "pass"), (r.get("receiver_player_id"), "tgt")]:
            if not isinstance(pid, str) or pid not in ids:
                continue
            g = out.setdefault(pid, {}).setdefault(key, blank_grid())
            g[idx][0] += 1; g[idx][1] += comp; g[idx][2] += yds

    # rushing (by rusher)
    GAP = {("left", "end"): 0, ("left", "tackle"): 1, ("left", "guard"): 2, ("middle", None): 3,
           ("right", "guard"): 4, ("right", "tackle"): 5, ("right", "end"): 6}
    ru = df[(df["rush_attempt"] == 1) & df["run_location"].notna()]
    for _, r in ru.iterrows():
        gap = r.get("run_gap"); gap = gap if isinstance(gap, str) else None
        loc = r["run_location"]
        zi = GAP.get((loc, gap))
        if zi is None:
            zi = GAP.get((loc, None), 3)
        pid = r.get("rusher_player_id")
        if not isinstance(pid, str) or pid not in ids:
            continue
        g = out.setdefault(pid, {}).setdefault("rush", [[0, 0] for _ in range(7)])
        g[zi][0] += 1
        if not pd.isna(r.get("yards_gained")):
            g[zi][1] += int(r["yards_gained"])
    return out


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

    XWALK = pfr_to_gsis()  # pfr_id -> gsis_id, for snap-count joins (loaded once)
    print(f"crosswalk: {len(XWALK)} pfr-gsis ids")

    built = []
    college_built = []
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
        ids = {p["id"] for p in players_list if p.get("id")}

        # Next Gen Stats + snap share (merged into player rows)
        try:
            enrich_advanced(players_list, season, XWALK)
        except Exception as e:  # noqa: BLE001
            print(f"  !! advanced stats skipped: {e}")

        # weekly game logs (separate file, lazy-loaded by the profile pages)
        pweek = load_player_week(season)
        if pweek is not None:
            weekly = build_weekly(pweek, ids)
            wf = DATA_DIR / f"weekly_{season}.json"
            wf.write_text(json.dumps({"season": season, "players": weekly}, separators=(",", ":")), encoding="utf-8")
            print(f"  wrote {wf.name}  ({wf.stat().st_size // 1024} KB)")

        # field maps (separate file, lazy-loaded by the profile pages)
        try:
            field = build_field(pbp, ids)
            ff = DATA_DIR / f"field_{season}.json"
            ff.write_text(json.dumps({"season": season, "players": field}, separators=(",", ":")), encoding="utf-8")
            print(f"  wrote {ff.name}  ({ff.stat().st_size // 1024} KB)")
        except Exception as e:  # noqa: BLE001
            print(f"  !! field maps skipped: {e}")

        # college players (separate file, lazy-loaded by the College tab)
        try:
            cfb = load_cfb(season)
            if cfb is not None and len(cfb):
                college, cteams = build_college(cfb, season)
                cf = DATA_DIR / f"college_{season}.json"
                cf.write_text(json.dumps({"season": season, "players": college, "teams": cteams}, separators=(",", ":")), encoding="utf-8")
                print(f"  wrote {cf.name}  ({cf.stat().st_size // 1024} KB, {len(college)} players, {len(cteams)} teams)")
                college_built.append(season)
        except Exception as e:  # noqa: BLE001
            print(f"  !! college skipped: {e}")

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
        "college_seasons": sorted(college_built, reverse=True),
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
