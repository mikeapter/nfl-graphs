/* NFL Graphs — static app: customizable explorers, profiles, compare, sharing. */
(() => {
  "use strict";

  const THEME_VALS = {
    dark:  ["#93a1b8", "#263145", "#e8edf6", "#0f1622", "#0b0f17"],
    light: ["#5b6675", "#dbe1ea", "#1a2230", "#ffffff", "#f4f6fa"],
  };
  let AXIS, LINE, TEXT, TIP, BG, theme = "dark";
  [AXIS, LINE, TEXT, TIP, BG] = THEME_VALS.dark;

  const ICON_SUN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8"/></svg>';
  const ICON_MOON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const TABS = ["home", "teams", "players", "contracts", "standings", "trends", "college", "tendencies", "fantasy"];

  const state = {
    meta: null, season: null, data: null, weekly: {},
    teamChart: "scatter", teamX: "off_epa", teamY: "def_epa", teamRank: "off_epa", teamSet: "Offense",
    playerPos: "QB", playerChart: "bar", playerRank: "passing_yards", playerX: "attempts", playerY: "passing_epa", playerSet: "Passing",
    teamHeat: [], playerHeat: [], playerQual: true, playerSort: null,
    team: null, focus: null, searchIndex: {}, prevTab: "teams", profileEntity: null, logStat: "py",
    field: {}, fieldMap: null, careers: null, careerStat: null,
    college: {}, collegeCat: "Passing", collegeConf: "", collegeRank: "pyd", collegeFilter: "", collegeSort: null,
    collegeScope: "National", collegeClass: "FBS", collegeMode: "players", collegeTeamRank: "pd", collegeTeamSort: null,
    tend: {}, tendTeam: null, tendSide: "off", tendMetric: "grp", tendBreak: "down", tendPtype: "", tendGame: "",
    fanView: "rankings", fanPos: "QB", fanScoring: "ppr", fanPassTd6: false, fanSort: null,
    contracts: null, conPos: "ALL", conTeam: "", conSort: "apy", conFind: "",
    wkFrom: 1, wkTo: 99, wkMax: 18, rangePlayers: null, rangeKey: null,
    teamWkFrom: 1, teamWkTo: 99, rangeTeams: null, teamRangeKey: null, playerSeasonType: "reg", teamSeasonType: "reg",
  };
  const TEAM_WK_SUM = ["completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions", "passing_epa", "passing_first_downs", "passing_air_yards", "sacks_suffered", "carries", "rushing_yards", "rushing_tds", "rushing_epa", "rushing_first_downs", "def_sacks", "def_interceptions", "def_tds", "def_pass_defended", "penalties", "penalty_yards", "fg_made", "fg_att", "pf", "pa", "w", "l", "t", "oe", "opl", "de", "dpl"];
  const charts = {};

  // ---- Stat catalogs ------------------------------------------------------
  const games = (t) => (t.w || 0) + (t.l || 0) + (t.t || 0);
  const TEAM_STATS = [
    { k: "off_epa", l: "Offense EPA/play", hi: true, d: 3 },
    { k: "def_epa", l: "Defense EPA/play", hi: false, d: 3 },
    { k: "net_epa", l: "Net EPA/play", hi: true, d: 3, fn: (t) => (t.off_epa != null && t.def_epa != null) ? t.off_epa - t.def_epa : null },
    { k: "ppg", l: "Points / game", hi: true, d: 1, fn: (t) => games(t) ? (t.pf || 0) / games(t) : null },
    { k: "papg", l: "Points allowed / game", hi: false, d: 1, fn: (t) => games(t) ? (t.pa || 0) / games(t) : null },
    { k: "pf", l: "Points for", hi: true },
    { k: "pa", l: "Points against", hi: false },
    { k: "pd", l: "Point differential", hi: true },
    { k: "w", l: "Wins", hi: true },
    { k: "ypp", l: "Yards / play (off)", hi: true, d: 2, fn: (t) => t.off_plays ? ((t.passing_yards || 0) + (t.rushing_yards || 0)) / t.off_plays : null },
    { k: "total_yards", l: "Total yards", hi: true, fn: (t) => (t.passing_yards || 0) + (t.rushing_yards || 0) },
    { k: "passing_yards", l: "Passing yards", hi: true },
    { k: "rushing_yards", l: "Rushing yards", hi: true },
    { k: "total_tds", l: "Total TDs (off)", hi: true, fn: (t) => (t.passing_tds || 0) + (t.rushing_tds || 0) },
    { k: "passing_tds", l: "Passing TDs", hi: true },
    { k: "rushing_tds", l: "Rushing TDs", hi: true },
    { k: "first_downs", l: "First downs (off)", hi: true, fn: (t) => (t.passing_first_downs || 0) + (t.rushing_first_downs || 0) },
    { k: "passing_epa", l: "Passing EPA (total)", hi: true, d: 1 },
    { k: "rushing_epa", l: "Rushing EPA (total)", hi: true, d: 1 },
    { k: "def_sacks", l: "Sacks (defense)", hi: true },
    { k: "def_interceptions", l: "Interceptions (def)", hi: true },
    { k: "def_pass_defended", l: "Passes defended", hi: true },
    { k: "def_tds", l: "Defensive TDs", hi: true },
    { k: "sacks_suffered", l: "Sacks allowed", hi: false },
    { k: "penalties", l: "Penalties", hi: false },
    { k: "penalty_yards", l: "Penalty yards", hi: false },
    { k: "fg_made", l: "Field goals made", hi: true },
    // situational
    { k: "td3", l: "3rd down conv %", hi: true, d: 1 },
    { k: "rztd", l: "Red-zone TD %", hi: true, d: 1 },
    { k: "rztrips", l: "Red-zone trips", hi: true },
    { k: "def3", l: "3rd down allowed %", hi: false, d: 1 },
    { k: "def_rztd", l: "Red-zone TD allowed %", hi: false, d: 1 },
  ];
  const TEAM_SETS = {
    Offense: ["off_epa", "ppg", "ypp", "passing_yards", "rushing_yards", "total_tds"],
    Defense: ["def_epa", "papg", "def_sacks", "def_interceptions", "def_pass_defended", "def_tds"],
    Overall: ["net_epa", "pd", "w", "ppg", "papg", "first_downs"],
    Situational: ["td3", "rztd", "rztrips", "def3", "def_rztd"],
  };
  const PLAYER_STATS = [
    { k: "passing_yards", l: "Passing yards", hi: true },
    { k: "pass_ypg", l: "Passing yards / game", hi: true, d: 1, fn: (p) => (p.games && p.passing_yards != null) ? p.passing_yards / p.games : null },
    { k: "passing_tds", l: "Passing TDs", hi: true },
    { k: "passing_epa", l: "Passing EPA", hi: true, d: 1 },
    { k: "passing_cpoe", l: "CPOE", hi: true, d: 2 },
    { k: "cmp_pct", l: "Completion %", hi: true, d: 1, fn: (p) => p.attempts ? 100 * p.completions / p.attempts : null },
    { k: "ypa", l: "Yards / attempt", hi: true, d: 2, fn: (p) => p.attempts ? p.passing_yards / p.attempts : null },
    { k: "td_pct", l: "TD % (pass)", hi: true, d: 1, fn: (p) => p.attempts ? 100 * (p.passing_tds || 0) / p.attempts : null },
    { k: "int_pct", l: "INT % (pass)", hi: false, d: 1, fn: (p) => p.attempts ? 100 * (p.passing_interceptions || 0) / p.attempts : null },
    { k: "passing_interceptions", l: "Interceptions", hi: false },
    { k: "attempts", l: "Pass attempts", hi: true },
    { k: "completions", l: "Completions", hi: true },
    { k: "passing_first_downs", l: "Passing 1st downs", hi: true },
    { k: "passing_air_yards", l: "Air yards (passing)", hi: true },
    { k: "sacks_suffered", l: "Sacks taken", hi: false },
    { k: "carries", l: "Carries", hi: true },
    { k: "rushing_yards", l: "Rushing yards", hi: true },
    { k: "rush_ypg", l: "Rushing yards / game", hi: true, d: 1, fn: (p) => p.games ? (p.rushing_yards || 0) / p.games : null },
    { k: "rushing_tds", l: "Rushing TDs", hi: true },
    { k: "rushing_epa", l: "Rushing EPA", hi: true, d: 1 },
    { k: "ypc", l: "Yards / carry", hi: true, d: 2, fn: (p) => p.carries ? p.rushing_yards / p.carries : null },
    { k: "rushing_first_downs", l: "Rush 1st downs", hi: true },
    { k: "targets", l: "Targets", hi: true },
    { k: "receptions", l: "Receptions", hi: true },
    { k: "receiving_yards", l: "Receiving yards", hi: true },
    { k: "rec_ypg", l: "Receiving yards / game", hi: true, d: 1, fn: (p) => p.games ? (p.receiving_yards || 0) / p.games : null },
    { k: "receiving_tds", l: "Receiving TDs", hi: true },
    { k: "receiving_epa", l: "Receiving EPA", hi: true, d: 1 },
    { k: "ypr", l: "Yards / reception", hi: true, d: 2, fn: (p) => p.receptions ? p.receiving_yards / p.receptions : null },
    { k: "catch_pct", l: "Catch %", hi: true, d: 1, fn: (p) => p.targets ? 100 * p.receptions / p.targets : null },
    { k: "ypt", l: "Yards / target", hi: true, d: 2, fn: (p) => p.targets ? p.receiving_yards / p.targets : null },
    { k: "adot", l: "aDOT (air yds/tgt)", hi: true, d: 2, fn: (p) => p.targets ? (p.receiving_air_yards || 0) / p.targets : null },
    { k: "receiving_first_downs", l: "Receiving 1st downs", hi: true },
    { k: "target_share", l: "Target share", hi: true, d: 3 },
    { k: "air_yards_share", l: "Air yards share", hi: true, d: 3 },
    { k: "wopr", l: "WOPR", hi: true, d: 2 },
    { k: "racr", l: "RACR", hi: true, d: 2 },
    { k: "receiving_yards_after_catch", l: "Yards after catch", hi: true },
    { k: "yds_scrim", l: "Yards from scrimmage", hi: true, fn: (p) => (p.rushing_yards || 0) + (p.receiving_yards || 0) },
    { k: "total_tds", l: "Total TDs", hi: true, fn: (p) => (p.passing_tds || 0) + (p.rushing_tds || 0) + (p.receiving_tds || 0) },
    { k: "touches", l: "Touches (car+rec)", hi: true, fn: (p) => (p.carries || 0) + (p.receptions || 0) },
    { k: "yptouch", l: "Yards / touch", hi: true, d: 2, fn: (p) => { const t = (p.carries || 0) + (p.receptions || 0); return t ? ((p.rushing_yards || 0) + (p.receiving_yards || 0)) / t : null; } },
    { k: "fantasy_points", l: "Fantasy points", hi: true, d: 1 },
    { k: "fantasy_points_ppr", l: "Fantasy points (PPR)", hi: true, d: 1 },
    { k: "fppg", l: "Fantasy pts/game (PPR)", hi: true, d: 2, fn: (p) => (p.games && p.fantasy_points_ppr != null) ? p.fantasy_points_ppr / p.games : null },
    { k: "games", l: "Games played", hi: true },
    // Next Gen Stats + snap share
    { k: "snap_pct", l: "Snap share %", hi: true, d: 1 },
    { k: "ngs_ttt", l: "Time to throw (s)", hi: false, d: 2 },
    { k: "ngs_iay", l: "Intended air yards", hi: true, d: 2 },
    { k: "ngs_agg", l: "Aggressiveness %", hi: true, d: 1 },
    { k: "ngs_cpoe", l: "Comp % over expected", hi: true, d: 1 },
    { k: "ngs_ayts", l: "Air yards to sticks", hi: true, d: 2 },
    { k: "ngs_rating", l: "Passer rating (NGS)", hi: true, d: 1 },
    { k: "ngs_xcomp", l: "Expected comp %", hi: true, d: 1 },
    { k: "ngs_sep", l: "Avg separation (yds)", hi: true, d: 2 },
    { k: "ngs_cush", l: "Avg cushion (yds)", hi: true, d: 2 },
    { k: "ngs_yacoe", l: "YAC over expected", hi: true, d: 2 },
    { k: "ngs_airshare", l: "Air-yards share %", hi: true, d: 1 },
    { k: "ngs_tay", l: "Targeted air yards", hi: true, d: 2 },
    { k: "ngs_ryoe", l: "Rush yds over expected", hi: true, d: 1 },
    { k: "ngs_ryoe_att", l: "RYOE / attempt", hi: true, d: 2 },
    { k: "ngs_eff", l: "Rush efficiency", hi: false, d: 2 },
    { k: "ngs_ttl", l: "Time to line (s)", hi: false, d: 2 },
    { k: "ngs_stacked", l: "% vs 8+ defenders", hi: true, d: 1 },
    { k: "ngs_rpoe", l: "Rush % over expected", hi: true, d: 2 },
    // IDP (defense)
    { k: "tackles", l: "Tackles", hi: true, fn: (p) => (p.def_tackles_solo || 0) + (p.def_tackle_assists || 0) },
    { k: "def_tackles_solo", l: "Solo tackles", hi: true },
    { k: "def_sacks", l: "Sacks", hi: true, d: 1 },
    { k: "def_tackles_for_loss", l: "Tackles for loss", hi: true },
    { k: "def_qb_hits", l: "QB hits", hi: true },
    { k: "def_interceptions", l: "Interceptions (def)", hi: true },
    { k: "def_pass_defended", l: "Passes defended", hi: true },
    { k: "def_fumbles_forced", l: "Forced fumbles", hi: true },
    { k: "def_tds", l: "Defensive TDs", hi: true },
    // Kicking
    { k: "fg_made", l: "FG made", hi: true },
    { k: "fg_att", l: "FG attempts", hi: true },
    { k: "fg_pct", l: "FG %", hi: true, d: 1, fn: (p) => p.fg_att ? 100 * (p.fg_made || 0) / p.fg_att : null },
    { k: "fg_50plus", l: "FG made 50+", hi: true, fn: (p) => (p.fg_made_50_59 || 0) + (p.fg_made_60_ || 0) },
    { k: "fg_long", l: "Longest FG", hi: true },
    { k: "pat_made", l: "XP made", hi: true },
    { k: "k_points", l: "Points (kicking)", hi: true, fn: (p) => (p.fg_made || 0) * 3 + (p.pat_made || 0) },
    // red zone
    { k: "rz_tgt", l: "Red-zone targets", hi: true },
    { k: "rz_rec", l: "Red-zone receptions", hi: true },
    { k: "rz_car", l: "Red-zone carries", hi: true },
    { k: "rz_touch", l: "Red-zone touches", hi: true, fn: (p) => (p.rz_car || 0) + (p.rz_tgt || 0) },
    { k: "rz_td", l: "Red-zone TDs", hi: true },
  ];
  const PLAYER_SETS = {
    Passing: ["passing_yards", "passing_tds", "passing_epa", "cmp_pct", "ypa", "passing_cpoe"],
    Rushing: ["rushing_yards", "rushing_tds", "rushing_epa", "ypc", "carries", "yds_scrim"],
    Receiving: ["receiving_yards", "receptions", "receiving_tds", "receiving_epa", "ypr", "target_share"],
    Fantasy: ["fantasy_points_ppr", "fppg", "total_tds", "yds_scrim", "touches"],
    "Next Gen · pass": ["ngs_cpoe", "ngs_ttt", "ngs_agg", "ngs_ayts", "ngs_rating", "ngs_xcomp"],
    "Next Gen · rec": ["ngs_sep", "ngs_cush", "ngs_yacoe", "ngs_airshare", "ngs_tay", "snap_pct"],
    "Next Gen · rush": ["ngs_ryoe", "ngs_ryoe_att", "ngs_eff", "ngs_ttl", "ngs_stacked", "snap_pct"],
    "Red zone": ["rz_tgt", "rz_car", "rz_td", "rz_touch", "rz_rec"],
    Defense: ["def_sacks", "tackles", "def_tackles_for_loss", "def_qb_hits", "def_interceptions", "def_pass_defended"],
    Kicking: ["fg_made", "fg_pct", "fg_50plus", "fg_long", "k_points"],
  };
  const TSTAT = Object.fromEntries(TEAM_STATS.map((s) => [s.k, s]));
  const PSTAT = Object.fromEntries(PLAYER_STATS.map((s) => [s.k, s]));

  // Stat groups for the dropdowns (offense/defense separation, etc.)
  const TEAM_DEF = new Set(["def_epa", "papg", "pa", "def_sacks", "def_interceptions", "def_pass_defended", "def_tds", "def3", "def_rztd"]);
  const TEAM_OTHER = new Set(["net_epa", "pd", "w", "penalties", "penalty_yards", "fg_made"]);
  const teamGroupOf = (k) => TEAM_DEF.has(k) ? "Defense" : TEAM_OTHER.has(k) ? "Overall" : "Offense";
  const TEAM_GROUP_ORDER = ["Offense", "Defense", "Overall"];
  const PL_PASS = new Set(["passing_yards", "pass_ypg", "passing_tds", "passing_epa", "passing_cpoe", "cmp_pct", "ypa", "td_pct", "int_pct", "passing_interceptions", "attempts", "completions", "passing_first_downs", "passing_air_yards", "sacks_suffered"]);
  const PL_RUSH = new Set(["carries", "rushing_yards", "rush_ypg", "rushing_tds", "rushing_epa", "ypc", "rushing_first_downs"]);
  const PL_REC = new Set(["targets", "receptions", "receiving_yards", "rec_ypg", "receiving_tds", "receiving_epa", "ypr", "catch_pct", "ypt", "adot", "receiving_first_downs", "target_share", "air_yards_share", "wopr", "racr", "receiving_yards_after_catch"]);
  const playerGroupOf = (k) => (k.startsWith("ngs_") || k === "snap_pct") ? "Next Gen" : k.startsWith("rz_") ? "Red zone" : (k.startsWith("def_") || k === "tackles") ? "Defense" : (k.startsWith("fg_") || k.startsWith("pat_") || k === "k_points") ? "Kicking" : PL_PASS.has(k) ? "Passing" : PL_RUSH.has(k) ? "Rushing" : PL_REC.has(k) ? "Receiving" : "Overall";
  const PL_GROUP_ORDER = ["Passing", "Rushing", "Receiving", "Red zone", "Overall", "Next Gen", "Defense", "Kicking"];

  // College stat catalog (reliable cfbfastR aggregates — no TDs in the source)
  const CSTAT = {
    pyd: { k: "pyd", l: "Passing yards", hi: true }, ptd: { k: "ptd", l: "Passing TDs", hi: true },
    cmp: { k: "cmp", l: "Completions", hi: true }, att: { k: "att", l: "Pass attempts", hi: true },
    int: { k: "int", l: "Interceptions", hi: false },
    cmp_pct: { k: "cmp_pct", l: "Completion %", hi: true, d: 1, fn: (p) => p.att ? 100 * (p.cmp || 0) / p.att : null },
    ypa: { k: "ypa", l: "Yards / attempt", hi: true, d: 2, fn: (p) => p.att ? (p.pyd || 0) / p.att : null },
    car: { k: "car", l: "Carries", hi: true }, ryd: { k: "ryd", l: "Rushing yards", hi: true }, rtd: { k: "rtd", l: "Rushing TDs", hi: true },
    ypc: { k: "ypc", l: "Yards / carry", hi: true, d: 2, fn: (p) => p.car ? (p.ryd || 0) / p.car : null },
    rec: { k: "rec", l: "Receptions", hi: true }, tgt: { k: "tgt", l: "Targets", hi: true },
    recyd: { k: "recyd", l: "Receiving yards", hi: true }, rectd: { k: "rectd", l: "Receiving TDs", hi: true },
    ypr: { k: "ypr", l: "Yards / reception", hi: true, d: 2, fn: (p) => p.rec ? (p.recyd || 0) / p.rec : null },
    catch_pct: { k: "catch_pct", l: "Catch %", hi: true, d: 1, fn: (p) => p.tgt ? 100 * (p.rec || 0) / p.tgt : null },
    games: { k: "games", l: "Games", hi: true },
  };
  const COLLEGE_CAT = {
    Passing: { filter: (p) => (p.att || 0) >= 50, rank: "pyd", stats: ["pyd", "ptd", "cmp", "att", "cmp_pct", "ypa", "int"] },
    Rushing: { filter: (p) => (p.car || 0) >= 25, rank: "ryd", stats: ["ryd", "rtd", "car", "ypc"] },
    Receiving: { filter: (p) => (p.rec || 0) >= 15 || (p.tgt || 0) >= 15, rank: "recyd", stats: ["recyd", "rectd", "rec", "tgt", "ypr", "catch_pct"] },
  };
  const CTEAM_STAT = {
    pd: { k: "pd", l: "Point differential", hi: true }, w: { k: "w", l: "Wins", hi: true },
    pf: { k: "pf", l: "Points for", hi: true }, pa: { k: "pa", l: "Points against", hi: false },
    ppg: { k: "ppg", l: "Points / game", hi: true, d: 1, fn: (t) => t.g ? (t.pf || 0) / t.g : null },
    papg: { k: "papg", l: "Points allowed / game", hi: false, d: 1, fn: (t) => t.g ? (t.pa || 0) / t.g : null },
    total_yds: { k: "total_yds", l: "Total yards", hi: true },
    ypg: { k: "ypg", l: "Yards / game", hi: true, d: 1, fn: (t) => t.g ? (t.total_yds || 0) / t.g : null },
    pass_yds: { k: "pass_yds", l: "Passing yards", hi: true }, rush_yds: { k: "rush_yds", l: "Rushing yards", hi: true },
    def_yds: { k: "def_yds", l: "Yards allowed", hi: false },
    def_ypg: { k: "def_ypg", l: "Yards allowed / game", hi: false, d: 1, fn: (t) => t.g ? (t.def_yds || 0) / t.g : null },
  };
  const CTEAM_ORDER = ["pd", "ppg", "papg", "w", "total_yds", "ypg", "pass_yds", "rush_yds", "def_yds", "def_ypg", "pf", "pa"];

  const pval = (e, stat) => { const v = stat.fn ? stat.fn(e) : e[stat.k]; return v == null || (typeof v === "number" && isNaN(v)) ? null : v; };
  const pfmt = (v, stat) => { if (v == null) return "—"; const d = stat.d || 0; return d === 0 ? Math.round(v).toLocaleString("en-US") : (+v).toFixed(d); };

  // ---- Theme --------------------------------------------------------------
  function setToggleIcon() { const b = $("#theme-toggle"); if (!b) return; b.innerHTML = theme === "dark" ? ICON_SUN : ICON_MOON; b.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode"; }
  function applyTheme(name) {
    theme = THEME_VALS[name] ? name : "dark";
    [AXIS, LINE, TEXT, TIP, BG] = THEME_VALS[theme];
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("nflg-theme", theme); } catch (e) {}
    setToggleIcon();
    if (state.data) rerender();
  }
  function rerender() { renderAll(); if (state.profileEntity) router(); }

  // ---- Boot & routing -----------------------------------------------------
  async function boot() {
    try { state.meta = await (await fetch("./data/meta.json")).json(); }
    catch (e) { document.body.innerHTML = '<p style="padding:24px;color:#f87171">Could not load data. Run the build script first.</p>'; return; }
    $("#updated").textContent = "Updated " + state.meta.generated_at;
    $("#season-select").innerHTML = state.meta.seasons.map((s) => `<option value="${s}">${s}</option>`).join("");
    $("#season-select").addEventListener("change", (e) => { const base = location.hash.split("?")[0] || "#/teams"; location.hash = +e.target.value === state.meta.latest ? base : base + `?s=${e.target.value}`; });

    $$(".tab").forEach((t) => t.addEventListener("click", () => go(`#/${t.dataset.view}${seasonSuffix()}`)));
    window.addEventListener("resize", () => Object.values(charts).forEach((c) => c.resize()));
    setToggleIcon();
    $("#theme-toggle").addEventListener("click", () => applyTheme(theme === "dark" ? "light" : "dark"));
    $("#glossary-btn").addEventListener("click", openGlossary);
    $("#glossary-close").addEventListener("click", closeGlossary);
    $("#glossary-modal").addEventListener("click", (e) => { if (e.target.id === "glossary-modal") closeGlossary(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeGlossary(); });

    // Builders — axis options grouped (team: Offense/Defense/Overall)
    fillSelectGrouped($("#team-x"), TEAM_STATS, TEAM_GROUP_ORDER, teamGroupOf, state.teamX);
    fillSelectGrouped($("#team-y"), TEAM_STATS, TEAM_GROUP_ORDER, teamGroupOf, state.teamY);
    fillSelectGrouped($("#team-rank"), TEAM_STATS, TEAM_GROUP_ORDER, teamGroupOf, state.teamRank);
    fillSets($("#team-set"), TEAM_SETS, state.teamSet);
    state.teamHeat = TEAM_SETS[state.teamSet].slice();
    segmented("#team-chart", (v) => { state.teamChart = v; teamControls(); renderTeams(); });
    $("#team-x").addEventListener("change", (e) => { state.teamX = e.target.value; renderTeams(); });
    $("#team-y").addEventListener("change", (e) => { state.teamY = e.target.value; renderTeams(); });
    $("#team-rank").addEventListener("change", (e) => { state.teamRank = e.target.value; renderTeams(); });
    $("#team-set").addEventListener("change", (e) => { state.teamSet = e.target.value; state.teamHeat = TEAM_SETS[e.target.value].slice(); teamChips(); renderTeams(); });
    segmented("#team-seasontype", (v) => { state.teamSeasonType = v; document.querySelectorAll("#view-teams .builder .ctl").forEach((c) => { if (c.querySelector("#team-wk-from")) c.style.display = v === "post" ? "none" : ""; }); renderTeams(); });
    $("#team-wk-from").addEventListener("change", (e) => { state.teamWkFrom = +e.target.value; if (state.teamWkFrom > (state.teamWkTo === 99 ? state.wkMax : state.teamWkTo)) { state.teamWkTo = state.teamWkFrom; $("#team-wk-to").value = state.teamWkFrom; } renderTeams(); });
    $("#team-wk-to").addEventListener("change", (e) => { state.teamWkTo = +e.target.value === state.wkMax ? 99 : +e.target.value; if ((state.teamWkTo === 99 ? state.wkMax : state.teamWkTo) < state.teamWkFrom) { state.teamWkFrom = +e.target.value; $("#team-wk-from").value = e.target.value; } renderTeams(); });

    fillSelectGrouped($("#player-rank"), PLAYER_STATS, PL_GROUP_ORDER, playerGroupOf, state.playerRank);
    fillSelectGrouped($("#player-x"), PLAYER_STATS, PL_GROUP_ORDER, playerGroupOf, state.playerX);
    fillSelectGrouped($("#player-y"), PLAYER_STATS, PL_GROUP_ORDER, playerGroupOf, state.playerY);
    fillSets($("#player-set"), PLAYER_SETS, state.playerSet);
    state.playerHeat = PLAYER_SETS[state.playerSet].slice();
    segmented("#player-seasontype", (v) => { state.playerSeasonType = v; document.querySelectorAll("#view-players .builder .ctl").forEach((c) => { if (c.querySelector("#player-wk-from")) c.style.display = v === "post" ? "none" : ""; }); renderPlayers(); });
    segmented("#player-pos", (v) => { applyPlayerDefaults(v); renderPlayers(); });
    segmented("#player-chart", (v) => { state.playerChart = v; playerControls(); renderPlayers(); });
    $("#player-rank").addEventListener("change", (e) => { state.playerRank = e.target.value; state.playerSort = null; renderPlayers(); });
    $("#player-x").addEventListener("change", (e) => { state.playerX = e.target.value; renderPlayers(); });
    $("#player-y").addEventListener("change", (e) => { state.playerY = e.target.value; renderPlayers(); });
    $("#player-set").addEventListener("change", (e) => { state.playerSet = e.target.value; state.playerHeat = PLAYER_SETS[e.target.value].slice(); playerChips(); renderPlayers(); });
    $("#player-qual").addEventListener("change", (e) => { state.playerQual = e.target.checked; renderPlayers(); });
    $("#team-share").addEventListener("click", (e) => copyShare(teamShareURL(), e.currentTarget));
    $("#player-share").addEventListener("click", (e) => copyShare(playerShareURL(), e.currentTarget));
    $("#player-wk-from").addEventListener("change", (e) => { state.wkFrom = +e.target.value; if (state.wkFrom > (state.wkTo === 99 ? state.wkMax : state.wkTo)) { state.wkTo = state.wkFrom; $("#player-wk-to").value = state.wkFrom; } renderPlayers(); });
    $("#player-wk-to").addEventListener("change", (e) => { state.wkTo = +e.target.value === state.wkMax ? 99 : +e.target.value; if ((state.wkTo === 99 ? state.wkMax : state.wkTo) < state.wkFrom) { state.wkFrom = +e.target.value; $("#player-wk-from").value = e.target.value; } renderPlayers(); });

    $("#week-select").addEventListener("change", renderScores);
    $("#team-select").addEventListener("change", () => { state.team = $("#team-select").value; renderTrends(); });
    $("#standings-save").addEventListener("click", exportStandings);

    $("#global-search").addEventListener("change", onSearch);
    $("#search-clear").addEventListener("click", clearSearch);
    $("#player-table").addEventListener("click", onTableClick);
    $("#divisions").addEventListener("click", (e) => { const r = e.target.closest(".divrow"); if (r && r.dataset.team) go(`#/team/${r.dataset.team}${seasonSuffix()}`); });

    // College builder
    fillCollegeRank(state.collegeCat, state.collegeRank);
    segmented("#college-mode", (v) => { state.collegeMode = v; collegeModeControls(); renderCollege(); });
    segmented("#college-cat", (v) => { state.collegeCat = v; state.collegeRank = COLLEGE_CAT[v].rank; state.collegeSort = null; fillCollegeRank(v, state.collegeRank); renderCollege(); });
    segmented("#college-class", (v) => { state.collegeClass = v; renderCollege(); });
    segmented("#college-scope", (v) => { state.collegeScope = v; $("#college-conf-ctl").hidden = v !== "Conference"; renderCollege(); });
    $("#college-conf").addEventListener("change", (e) => { state.collegeConf = e.target.value; renderCollege(); });
    $("#college-rank").addEventListener("change", (e) => { if (state.collegeMode === "teams") { state.collegeTeamRank = e.target.value; state.collegeTeamSort = null; } else { state.collegeRank = e.target.value; state.collegeSort = null; } renderCollege(); });
    $("#college-filter").addEventListener("input", (e) => { state.collegeFilter = e.target.value.toLowerCase(); renderCollege(); });
    $("#college-table").addEventListener("click", onCollegeTableClick);

    // Tendencies builder
    fillTendMetric(state.tendSide);
    $("#tend-team").addEventListener("change", (e) => { state.tendTeam = e.target.value; fillTendGames(); state.tendGame = ""; renderTendencies(); });
    segmented("#tend-side", (v) => { state.tendSide = v; fillTendMetric(v); renderTendencies(); });
    $("#tend-metric").addEventListener("change", (e) => { state.tendMetric = e.target.value; renderTendencies(); });
    segmented("#tend-break", (v) => { state.tendBreak = v; renderTendencies(); });
    $("#tend-ptype").addEventListener("change", (e) => { state.tendPtype = e.target.value; renderTendencies(); });
    $("#tend-game").addEventListener("change", (e) => { state.tendGame = e.target.value; renderTendencies(); });

    // Fantasy builder
    segmented("#fan-view", (v) => { state.fanView = v; renderFantasy(); });
    segmented("#fan-pos", (v) => { state.fanPos = v; state.fanSort = null; renderFantasy(); });
    segmented("#fan-scoring", (v) => { state.fanScoring = v; renderFantasy(); });
    $("#fan-passtd6").addEventListener("change", (e) => { state.fanPassTd6 = e.target.checked; renderFantasy(); });
    $("#fan-table").addEventListener("click", onFanSort);

    // Contracts builder
    segmented("#con-pos", (v) => { state.conPos = v; renderContracts(); });
    $("#con-team").addEventListener("change", (e) => { state.conTeam = e.target.value; renderContracts(); });
    $("#con-sort").addEventListener("change", (e) => { state.conSort = e.target.value; renderContracts(); });
    $("#con-find").addEventListener("input", (e) => { state.conFind = e.target.value; renderContracts(); });

    // Profile / compare controls
    $("#prof-back").addEventListener("click", () => go(`#/${state.prevTab}${seasonSuffix()}`));
    $("#cmp-back").addEventListener("click", () => go(`#/${state.prevTab}${seasonSuffix()}`));
    $("#prof-copy").addEventListener("click", (e) => copyLink(e.target));
    $("#cmp-copy").addEventListener("click", (e) => copyLink(e.target));
    $("#prof-save").addEventListener("click", exportCard);
    $("#prof-compare").addEventListener("change", (e) => { const en = state.profileEntity; if (en && e.target.value) go(`#/compare/${en.type === "team" ? "t" : "p"}/${encodeURIComponent(en.id)}/${encodeURIComponent(e.target.value)}${seasonSuffix()}`); });
    $("#prof-log-stat").addEventListener("change", (e) => { state.logStat = e.target.value; if (state.profileEntity && state.profileEntity.type === "player") renderGameLog(findPlayer(state.profileEntity.id)); });
    $("#prof-career-stat").addEventListener("change", (e) => { state.careerStat = e.target.value; const en = state.profileEntity; if (en && en.type === "player" && state.careers && state.careers[en.id]) drawCareer(findPlayer(en.id), state.careers[en.id]); });
    $("#cmp-a").addEventListener("change", cmpPick); $("#cmp-b").addEventListener("change", cmpPick);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.profileEntity) go(`#/${state.prevTab}${seasonSuffix()}`); });

    teamControls(); playerControls();
    const init = parseHash();
    await loadSeasonData(init.season || state.meta.latest);
    await router();
    window.addEventListener("hashchange", router);
  }

  const go = (hash) => { if (location.hash === hash) router(); else location.hash = hash; };
  const seasonSuffix = () => state.season && state.season !== state.meta.latest ? `?s=${state.season}` : "";
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, query] = raw.split("?");
    const s = new URLSearchParams(query || "").get("s");
    const seg = path.split("/").filter(Boolean).map(decodeURIComponent);
    const season = s ? +s : null;
    if (seg[0] === "player") return { view: "player", id: seg[1], season };
    if (seg[0] === "cplayer") return { view: "cplayer", id: seg[1], season };
    if (seg[0] === "team") return { view: "team", id: seg[1], season };
    if (seg[0] === "compare") return { view: "compare", ctype: seg[1], a: seg[2], b: seg[3], season };
    return { view: seg[0] || "home", season, q: Object.fromEntries(new URLSearchParams(query || "")) };
  }
  async function router() {
    const r = parseHash();
    const want = r.season || state.meta.latest;
    if (want !== state.season) await loadSeasonData(want);
    $("#season-select").value = state.season;
    if (r.view === "player") return showPlayerPage(r.id);
    if (r.view === "cplayer") return showCollegePlayerPage(r.id);
    if (r.view === "team") return showTeamPage(r.id);
    if (r.view === "compare") return showComparePage(r.ctype, r.a, r.b);
    state.profileEntity = null;
    const view = TABS.includes(r.view) ? r.view : "home";
    if (view === "teams") { applyTeamParams(r.q); }
    if (view === "players") { applyPlayerParams(r.q); }
    showTab(view);
    if (view === "teams") renderTeams();
    if (view === "players") renderPlayers();
  }
  const setSeg = (sel, attr, val) => $$(sel + " .seg").forEach((b) => b.classList.toggle("active", b.dataset[attr] === val));
  function applyTeamParams(q) {
    if (!q) return;
    if (q.tc) state.teamChart = q.tc;
    if (q.tx && TSTAT[q.tx]) state.teamX = q.tx;
    if (q.ty && TSTAT[q.ty]) state.teamY = q.ty;
    if (q.tr && TSTAT[q.tr]) state.teamRank = q.tr;
    if (q.ts && TEAM_SETS[q.ts]) { state.teamSet = q.ts; state.teamHeat = TEAM_SETS[q.ts].slice(); }
    if (q.th) state.teamHeat = q.th.split(".").filter((k) => TSTAT[k]);
    state.teamSeasonType = q.tst === "post" ? "post" : "reg";
    state.teamWkFrom = q.twf ? +q.twf : 1;
    state.teamWkTo = q.twt ? +q.twt : 99;
    setSeg("#team-seasontype", "st", state.teamSeasonType);
    setSeg("#team-chart", "type", state.teamChart);
    $("#team-x").value = state.teamX; $("#team-y").value = state.teamY;
    $("#team-rank").value = state.teamRank; $("#team-set").value = state.teamSet;
    $("#team-wk-from").value = state.teamWkFrom; $("#team-wk-to").value = state.teamWkTo === 99 ? state.wkMax : state.teamWkTo;
    document.querySelectorAll("#view-teams .builder .ctl").forEach((c) => { if (c.querySelector("#team-wk-from")) c.style.display = state.teamSeasonType === "post" ? "none" : ""; });
    teamControls();
  }
  function applyPlayerParams(q) {
    if (!q) return;
    if (q.pp && POS_MATCH[q.pp]) applyPlayerDefaults(q.pp);
    if (q.pc) state.playerChart = q.pc;
    if (q.pr && PSTAT[q.pr]) state.playerRank = q.pr;
    if (q.px && PSTAT[q.px]) state.playerX = q.px;
    if (q.py && PSTAT[q.py]) state.playerY = q.py;
    if (q.ps && PLAYER_SETS[q.ps]) { state.playerSet = q.ps; state.playerHeat = PLAYER_SETS[q.ps].slice(); }
    if (q.ph) state.playerHeat = q.ph.split(".").filter((k) => PSTAT[k]);
    if (q.pq != null) state.playerQual = q.pq === "1";
    state.playerSeasonType = q.pst === "post" ? "post" : "reg";
    state.wkFrom = q.pwf ? +q.pwf : 1;
    state.wkTo = q.pwt ? +q.pwt : 99;
    setSeg("#player-seasontype", "st", state.playerSeasonType);
    setSeg("#player-pos", "pos", state.playerPos);
    setSeg("#player-chart", "type", state.playerChart);
    $("#player-rank").value = state.playerRank; $("#player-x").value = state.playerX; $("#player-y").value = state.playerY;
    $("#player-set").value = state.playerSet; $("#player-qual").checked = state.playerQual;
    $("#player-wk-from").value = state.wkFrom; $("#player-wk-to").value = state.wkTo === 99 ? state.wkMax : state.wkTo;
    document.querySelectorAll("#view-players .builder .ctl").forEach((c) => { if (c.querySelector("#player-wk-from")) c.style.display = state.playerSeasonType === "post" ? "none" : ""; });
    playerControls();
  }
  function teamShareURL() {
    const p = new URLSearchParams();
    p.set("tc", state.teamChart);
    if (state.teamChart === "scatter") { p.set("tx", state.teamX); p.set("ty", state.teamY); }
    else if (state.teamChart === "bar") p.set("tr", state.teamRank);
    else { p.set("ts", state.teamSet); p.set("th", state.teamHeat.join(".")); }
    if (state.teamSeasonType === "post") p.set("tst", "post");
    else { if (state.teamWkFrom > 1) p.set("twf", state.teamWkFrom); if (state.teamWkTo !== 99) p.set("twt", state.teamWkTo); }
    if (state.season !== state.meta.latest) p.set("s", state.season);
    return location.origin + location.pathname + "#/teams?" + p.toString();
  }
  function playerShareURL() {
    const p = new URLSearchParams();
    p.set("pp", state.playerPos); p.set("pc", state.playerChart);
    if (state.playerChart === "bar") p.set("pr", state.playerRank);
    else if (state.playerChart === "scatter") { p.set("px", state.playerX); p.set("py", state.playerY); }
    else if (state.playerChart === "heatmap") { p.set("ps", state.playerSet); p.set("ph", state.playerHeat.join(".")); }
    if (!state.playerQual) p.set("pq", "0");
    if (state.playerSeasonType === "post") p.set("pst", "post");
    else { if (state.wkFrom > 1) p.set("pwf", state.wkFrom); if (state.wkTo !== 99) p.set("pwt", state.wkTo); }
    if (state.season !== state.meta.latest) p.set("s", state.season);
    return location.origin + location.pathname + "#/players?" + p.toString();
  }
  const GLOSSARY = [
    ["Efficiency (the core idea)", [
      ["EPA / play", "Expected Points Added per play. Every situation (down, distance, field position) has an expected point value; EPA is how much a play changed it. <b>+0.1 EPA/play on offense is elite; -0.1 on defense is elite.</b> It rewards moving the chains and scoring, punishes sacks and turnovers — a far better quality signal than raw yards."],
      ["Success rate", "Share of plays with positive EPA — i.e. plays that helped. Measures consistency, where EPA/play measures magnitude. A team can have high EPA on a few explosives but a low success rate (boom-or-bust)."],
      ["Net EPA", "Offense EPA/play minus defense EPA/play — a one-number summary of overall team quality."],
    ]],
    ["Passing", [
      ["CPOE", "Completion Percentage Over Expected. Given each throw's depth, direction and pressure, the model estimates completion odds; CPOE is actual minus expected. <b>Isolates accuracy</b> from a QB's supporting cast and scheme. +3% is very good."],
      ["aDOT", "Average Depth of Target — how far downfield, in yards past the line, a passer throws (or a receiver is targeted). Low aDOT + high volume = a checkdown/screen game; high aDOT = a vertical one."],
      ["Air yards", "Total yards a pass travels in the air before the catch (or incompletion). Separates yards earned downfield from yards-after-catch."],
      ["Passing EPA", "Total EPA generated on dropbacks — the cumulative version of EPA/play, so volume matters."],
    ]],
    ["Rushing & receiving", [
      ["YAC", "Yards After Catch — yards gained after the ball arrives. High YAC points to run-after-catch skill or a scheme that creates space."],
      ["Target share", "Percent of a team's targets that went to a player — the cleanest usage/opportunity stat for receivers."],
      ["Rushing EPA", "Total EPA on carries. Note goal-line backs and short-yardage roles can suppress per-play efficiency even on 'good' runs."],
      ["Red-zone touches", "Carries + targets inside the opponent's 20. Where fantasy points and TDs are won."],
    ]],
    ["Next Gen Stats (NGS)", [
      ["Time to throw", "Seconds from snap to release. Fast can mean a quick-game scheme; slow can mean a gunslinger or a leaky line."],
      ["Separation", "Average yards of cushion a receiver has from the nearest defender at the catch point."],
      ["Efficiency (rush)", "NGS ball-carrier efficiency — total distance traveled vs. straight-line distance. Higher = more east-west running (not always good)."],
    ]],
    ["Tendencies", [
      ["Personnel (11, 12, 21…)", "Two digits: number of running backs, then tight ends, on the field. <b>11</b> = 1 RB, 1 TE, 3 WR (the modern spread base). <b>12</b> = 1 RB, 2 TE (heavier). The remaining players are WRs."],
      ["Coverage (Cover 1/2/3…)", "How many deep safeties and the shell behind them. Cover 1 = man with one deep safety; Cover 2 = two deep; Cover 3 = three deep zones. Reveals a defense's identity."],
      ["Light / heavy box", "Defenders in the box (near the line). Light boxes invite the run; heavy boxes dare you to throw."],
      ["Play-action / RPO", "Play-action fakes a handoff on a called pass; an RPO (run-pass option) lets the QB hand off or throw based on a defender's reaction."],
    ]],
    ["Fantasy", [
      ["PPR / Half / Standard", "Points Per Reception scoring. PPR gives 1 pt per catch, Half-PPR 0.5, Standard 0. The choice reshuffles WR/RB value — possession receivers rise in PPR."],
      ["Boom % / Bust %", "Share of a player's games above a strong (boom) or below a weak (bust) points threshold for their position — a read on week-to-week reliability."],
      ["Floor / Ceiling", "The player's typical bad-week and good-week outcomes (low and high percentiles), not just their average."],
    ]],
    ["Reading the charts", [
      ["Scatter quadrants", "On team scatters, up and to the right is better; dashed lines mark the league average, so the top-right quadrant is above average on both axes."],
      ["Heatmaps (z-scores)", "Colors compare each team/player to the league: teal = better than average, red = worse, by how many standard deviations. It's relative, not raw."],
      ["Qualified only", "Filters out tiny samples (e.g. a QB with 20 attempts) so leaderboards aren't skewed by noise. Toggle it off to see everyone."],
    ]],
  ];
  let glossaryBuilt = false;
  function openGlossary() {
    if (!glossaryBuilt) {
      $("#glossary-body").innerHTML = GLOSSARY.map(([sec, items]) => `<section class="gl-sec"><h3>${sec}</h3>${items.map(([t, d]) => `<div class="gl-item"><dt>${t}</dt><dd>${d}</dd></div>`).join("")}</section>`).join("");
      glossaryBuilt = true;
    }
    $("#glossary-modal").hidden = false; document.body.style.overflow = "hidden";
  }
  function closeGlossary() { $("#glossary-modal").hidden = true; document.body.style.overflow = ""; }

  async function copyShare(url, btn) {
    const restore = btn.textContent;
    try { await navigator.clipboard.writeText(url); btn.textContent = "✓ Link copied"; }
    catch (e) { location.hash = url.split("#")[1]; btn.textContent = "✓ Link in address bar"; }
    setTimeout(() => { btn.textContent = restore; }, 1600);
  }
  function activate(name, tab) {
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === tab));
    window.scrollTo(0, 0);
    requestAnimationFrame(() => Object.values(charts).forEach((c) => c.resize()));
  }
  function showTab(v) { state.prevTab = v; state.profileEntity = null; activate(v, v); if (v === "home") renderHome(); if (v === "college") renderCollege(); if (v === "tendencies") renderTendencies(); if (v === "fantasy") renderFantasy(); if (v === "contracts") renderContracts(); }

  function fillSelect(el, stats, sel) { el.innerHTML = stats.map((s) => `<option value="${s.k}">${s.l}</option>`).join(""); el.value = sel; }
  function fillSelectGrouped(el, stats, order, groupOf, sel) {
    const by = {};
    stats.forEach((s) => { (by[groupOf(s.k)] = by[groupOf(s.k)] || []).push(s); });
    el.innerHTML = order.filter((g) => by[g]).map((g) => `<optgroup label="${g}">${by[g].map((s) => `<option value="${s.k}">${s.l}</option>`).join("")}</optgroup>`).join("");
    el.value = sel;
  }
  function fillSets(el, sets, sel) { el.innerHTML = Object.keys(sets).map((k) => `<option value="${k}">${k}</option>`).join(""); el.value = sel; }
  function fillSelect2(el, pairs, sel) { el.innerHTML = pairs.map(([v, l]) => `<option value="${v}">${l}</option>`).join(""); el.value = sel; }
  function segmented(sel, cb) { $$(sel + " .seg").forEach((b) => b.addEventListener("click", () => { $$(sel + " .seg").forEach((x) => x.classList.toggle("active", x === b)); cb(b.dataset.type || b.dataset.pos || b.dataset.cat || b.dataset.cls || b.dataset.scope || b.dataset.side || b.dataset.break || b.dataset.st || b.dataset.mode || b.dataset.fv || b.dataset.fpos || b.dataset.sc || b.dataset.cpos); })); }
  function toggleRoles(bs, roles) { $$(bs + " .ctl[data-role]").forEach((c) => { c.hidden = !roles.includes(c.dataset.role); }); }
  function teamControls() { const t = state.teamChart; toggleRoles("#view-teams .builder", t === "scatter" ? ["x", "y"] : t === "bar" ? ["rank"] : ["set"]); $("#team-heat-chips").hidden = t !== "heatmap"; if (t === "heatmap") teamChips(); }
  function playerControls() { const t = state.playerChart; toggleRoles("#view-players .builder", t === "scatter" ? ["x", "y"] : t === "bar" ? ["rank"] : t === "heatmap" ? ["set"] : []); $("#player-heat-chips").hidden = t !== "heatmap"; if (t === "heatmap") playerChips(); }

  function renderChips(id, cat, sel, onT) { const el = $("#" + id); el.innerHTML = cat.map((s) => `<span class="chip ${sel.includes(s.k) ? "on" : ""}" data-k="${s.k}">${s.l}</span>`).join(""); el.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => onT(c.dataset.k))); }
  const teamChips = () => renderChips("team-heat-chips", TEAM_STATS, state.teamHeat, (k) => { toggleHeat(state.teamHeat, k); teamChips(); renderTeams(); });
  const playerChips = () => renderChips("player-heat-chips", PLAYER_STATS, state.playerHeat, (k) => { toggleHeat(state.playerHeat, k); playerChips(); renderPlayers(); });
  function toggleHeat(arr, k) { const i = arr.indexOf(k); if (i >= 0) { if (arr.length > 2) arr.splice(i, 1); } else if (arr.length < 10) arr.push(k); }

  async function loadSeasonData(season) {
    state.season = season;
    state.data = await (await fetch(`./data/season_${season}.json`)).json();
    const teams = Object.keys(state.meta.teams).sort((a, b) => teamMeta(a).name.localeCompare(teamMeta(b).name));
    $("#team-select").innerHTML = teams.filter((a) => state.data.trends[a]).map((a) => `<option value="${a}">${teamMeta(a).name}</option>`).join("");
    if (!state.team || !state.data.trends[state.team]) state.team = $("#team-select").value;
    $("#team-select").value = state.team;
    const weeks = Object.keys(state.data.scores).sort(weekOrder);
    $("#week-select").innerHTML = weeks.map((w) => `<option value="${w}">${weekLabel(w)}</option>`).join("");
    $("#week-select").value = weeks[weeks.length - 1];
    // player week-range selects (regular-season weeks present)
    const regMax = Math.max(18, ...weeks.filter((w) => /^\d+$/.test(w)).map(Number), 1);
    state.wkMax = regMax; state.wkFrom = 1; state.wkTo = 99; state.rangeKey = null;
    const wkOpts = (last) => Array.from({ length: regMax }, (_, i) => i + 1).map((w) => `<option value="${w}">Wk ${w}</option>`).join("");
    $("#player-wk-from").innerHTML = wkOpts(); $("#player-wk-from").value = 1;
    $("#player-wk-to").innerHTML = wkOpts(); $("#player-wk-to").value = regMax;
    state.teamWkFrom = 1; state.teamWkTo = 99; state.teamRangeKey = null;
    $("#team-wk-from").innerHTML = wkOpts(); $("#team-wk-from").value = 1;
    $("#team-wk-to").innerHTML = wkOpts(); $("#team-wk-to").value = regMax;
    buildSearchIndex();
    renderAll();
  }
  async function ensureWeekly() {
    if (state.weekly[state.season]) return state.weekly[state.season].players;
    try { const w = await (await fetch(`./data/weekly_${state.season}.json`)).json(); state.weekly[state.season] = { players: w.players || {}, teams: w.teams || {} }; return state.weekly[state.season].players; }
    catch (e) { state.weekly[state.season] = { players: {}, teams: {} }; return {}; }
  }
  const teamWeekly = () => (state.weekly[state.season] || {}).teams || {};
  async function ensureField() {
    if (state.field[state.season]) return state.field[state.season];
    try { const f = await (await fetch(`./data/field_${state.season}.json`)).json(); state.field[state.season] = { players: f.players || {}, teams: f.teams || {} }; return state.field[state.season]; }
    catch (e) { state.field[state.season] = { players: {}, teams: {} }; return state.field[state.season]; }
  }
  async function ensureCareers() {
    if (state.careers) return state.careers;
    try { const c = await (await fetch("./data/careers.json")).json(); state.careers = c.players; return c.players; }
    catch (e) { state.careers = {}; return {}; }
  }
  async function ensureCollege() {
    if (state.college[state.season]) return state.college[state.season];
    try { const c = await (await fetch(`./data/college_${state.season}.json`)).json(); state.college[state.season] = { players: c.players, teams: c.teams || {}, cteams: c.cteams || [] }; return state.college[state.season]; }
    catch (e) { state.college[state.season] = null; return null; }
  }
  async function ensureTendencies() {
    if (state.tend[state.season]) return state.tend[state.season];
    try { const t = await (await fetch(`./data/tendencies_${state.season}.json`)).json(); state.tend[state.season] = t; return t; }
    catch (e) { state.tend[state.season] = null; return null; }
  }
  async function ensureContracts() {
    if (state.contracts) return state.contracts;
    try { const c = await (await fetch("./data/contracts.json")).json(); state.contracts = c.players; return c.players; }
    catch (e) { state.contracts = []; return []; }
  }
  const CON_SORTS = [
    { k: "apy", l: "APY (avg / year)", f: (r) => r.apy },
    { k: "v", l: "Total value", f: (r) => r.v },
    { k: "g", l: "Guaranteed", f: (r) => r.g },
    { k: "cap", l: "% of salary cap", f: (r) => r.cap },
    { k: "y", l: "Contract length", f: (r) => r.y },
    { k: "ys", l: "Year signed", f: (r) => r.ys },
  ];
  const CON_SORT = Object.fromEntries(CON_SORTS.map((s) => [s.k, s]));
  const money = (m) => m == null ? "—" : m >= 100 ? `$${Math.round(m)}M` : `$${(+m).toFixed(1)}M`;
  const CON_ROWS = 250;
  let conWired = false;
  async function renderContracts() {
    const all = await ensureContracts();
    if (!conWired) {
      fillSelect2($("#con-sort"), CON_SORTS.map((s) => [s.k, s.l]), state.conSort);
      const teamOpts = [["", "All teams"], ...Object.keys(state.meta.teams).sort().map((a) => [a, state.meta.teams[a].name])];
      fillSelect2($("#con-team"), teamOpts, state.conTeam);
      conWired = true;
    }
    const find = state.conFind.trim().toLowerCase();
    let rows = all.filter((r) =>
      (state.conPos === "ALL" || r.pg === state.conPos) &&
      (!state.conTeam || r.t === state.conTeam) &&
      (!find || r.n.toLowerCase().includes(find)));
    const sf = CON_SORT[state.conSort].f;
    rows = rows.slice().sort((a, b) => (sf(b) ?? -Infinity) - (sf(a) ?? -Infinity));

    const posLabel = state.conPos === "ALL" ? "All positions" : state.conPos;
    $("#con-hint").textContent = "Active player contracts · APY = average per year · guarantees & cap % from OverTheCap · click a name for the player's profile";
    // summary strip from the filtered set
    const apys = rows.map((r) => r.apy).filter((v) => v != null);
    const avg = apys.length ? apys.reduce((s, v) => s + v, 0) / apys.length : null;
    const top = rows.find((r) => r.apy != null);
    $("#con-summary").innerHTML = apys.length
      ? `<div class="con-stat"><span>${posLabel}${state.conTeam ? " · " + state.meta.teams[state.conTeam].name : ""}</span><b>${rows.length} deals</b></div>` +
        `<div class="con-stat"><span>Top APY</span><b>${money(top.apy)}</b><em>${top.n}</em></div>` +
        `<div class="con-stat"><span>Average APY</span><b>${money(avg)}</b></div>` +
        `<div class="con-stat"><span>Median APY</span><b>${money(apys.slice().sort((a, b) => a - b)[Math.floor(apys.length / 2)])}</b></div>`
      : "";

    const shown = rows.slice(0, CON_ROWS);
    const sk = state.conSort;
    const th = (k, l) => `<th data-csort="${k}" class="con-th${sk === k ? " on" : ""}">${l}${sk === k ? " ▾" : ""}</th>`;
    const head = `<thead><tr><th>#</th><th class="con-name">Player</th><th>Pos</th><th>Team</th>${th("apy", "APY")}${th("v", "Total")}${th("g", "Gtd")}${th("y", "Yrs")}${th("ys", "Signed")}${th("cap", "Cap %")}</tr></thead>`;
    const hasProfile = (id) => id && state.data.players.some((p) => p.id === id);
    const body = shown.map((r, i) => {
      const lg = r.t && state.meta.teams[r.t] ? `<img class="con-logo" src="${state.meta.teams[r.t].logo}" alt=""/>` : "";
      const nm = hasProfile(r.id) ? `<a class="con-plink" data-id="${r.id}">${r.n}</a>` : r.n;
      return `<tr><td class="con-rank">${i + 1}</td><td class="con-name">${nm}</td><td>${r.p}</td><td class="con-team">${lg}${r.t || "—"}</td>` +
        `<td class="con-num on">${money(r.apy)}</td><td class="con-num">${money(r.v)}</td><td class="con-num">${money(r.g)}</td>` +
        `<td class="con-num">${r.y ?? "—"}</td><td class="con-num">${r.ys ?? "—"}</td><td class="con-num">${r.cap != null ? r.cap + "%" : "—"}</td></tr>`;
    }).join("");
    const more = rows.length > CON_ROWS ? `<tfoot><tr><td colspan="10" class="con-more">Showing top ${CON_ROWS} of ${rows.length} — narrow by team, position, or name to see the rest.</td></tr></tfoot>` : "";
    const el = $("#con-table");
    el.innerHTML = head + `<tbody>${body}</tbody>` + more;
    el.querySelectorAll(".con-plink").forEach((a) => a.addEventListener("click", () => go(`#/player/${encodeURIComponent(a.dataset.id)}${seasonSuffix()}`)));
    el.querySelectorAll(".con-th").forEach((h) => h.addEventListener("click", () => { state.conSort = h.dataset.csort; $("#con-sort").value = state.conSort; renderContracts(); }));
  }

  const cteam = (school) => { const t = state.college[state.season]; return (t && t.teams && t.teams[school]) || { logo: "", color: "#4da3ff", conf: "", abbr: school }; };
  const findCollege = (id) => { const c = state.college[state.season]; return c && c.players.find((p) => p.id === id); };
  let _nflNames = null;
  async function nflNameMap() {
    // Name -> NFL player from the LATEST NFL season (for college->NFL links).
    if (_nflNames) return _nflNames;
    try {
      const d = (state.season === state.meta.latest && state.data) ? state.data : await (await fetch(`./data/season_${state.meta.latest}.json`)).json();
      _nflNames = {}; d.players.forEach((p) => { _nflNames[p.player] = p; });
    } catch (e) { _nflNames = {}; }
    return _nflNames;
  }
  function renderAll() { renderTeams(); renderPlayers(); renderStandings(); renderScores(); renderTrends(); }

  const teamMeta = (a) => (state.meta && state.meta.teams[a]) || { name: a, color: "#888", logo: "" };
  const color = (a) => teamMeta(a).color;
  const logo = (a) => teamMeta(a).logo;
  const findPlayer = (x) => state.data.players.find((p) => p.id === x) || state.data.players.find((p) => p.player === x);

  const CLICK_ROUTERS = {
    "team-chart-el": (p) => { const n = p.name || (p.data && p.data.name); if (n && state.meta.teams[n]) go(`#/team/${n}${seasonSuffix()}`); },
    "player-chart-el": (p) => { const n = (p.data && p.data.pl) || (p.seriesType === "bar" ? p.name : null); if (n) { const pl = findPlayer(n); if (pl) go(`#/player/${encodeURIComponent(pl.id || pl.player)}${seasonSuffix()}`); } },
    "college-chart": (p) => { const c = state.college[state.season]; const pl = c && c.players.find((x) => x.player === p.name); if (pl) go(`#/cplayer/${encodeURIComponent(pl.id)}${seasonSuffix()}`); },
  };
  function ec(id) {
    if (!charts[id]) {
      const el = document.getElementById(id);
      const chart = echarts.init(el, null, { renderer: "canvas" });
      charts[id] = chart;
      if (CLICK_ROUTERS[id]) chart.on("click", CLICK_ROUTERS[id]);
      if (window.ResizeObserver) { let raf = 0; new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (el.clientWidth) chart.resize(); }); }).observe(el); }
    }
    return charts[id];
  }
  function chartExtras(name) {
    return {
      toolbox: { right: 8, top: 6, itemSize: 16, itemGap: 8, iconStyle: { borderColor: AXIS }, emphasis: { iconStyle: { borderColor: TEXT } }, feature: { saveAsImage: { title: "Save PNG", name: name, pixelRatio: 2, backgroundColor: BG } } },
      graphic: [{ type: "text", right: 12, bottom: 8, z: 12, silent: true, style: { text: "@mikeapter", fill: AXIS, opacity: 0.55, fontSize: 12, fontWeight: 600 } }],
    };
  }
  const axisCommon = () => ({ axisLine: { lineStyle: { color: LINE } }, axisLabel: { color: AXIS }, splitLine: { lineStyle: { color: LINE } } });

  // ---- Teams / Players explorers (unchanged core) -------------------------
  const isTeamPost = () => state.teamSeasonType === "post";
  const teamRangeActive = () => !isTeamPost() && (state.teamWkFrom > 1 || (state.teamWkTo !== 99 && state.teamWkTo < state.wkMax));
  const teamRangeHi = () => state.teamWkTo === 99 ? state.wkMax : state.teamWkTo;
  function buildRangeTeams(tw) {
    const from = state.teamWkFrom, to = teamRangeHi();
    return state.data.teams.map((base) => {
      const w = tw[base.team]; if (!w) return null;
      const idxs = w.wk.map((wk, i) => (wk >= from && wk <= to ? i : -1)).filter((i) => i >= 0);
      if (!idxs.length) return null;
      const syn = { team: base.team };
      TEAM_WK_SUM.forEach((f) => { if (!w[f]) return; let s = 0, any = false; idxs.forEach((i) => { const v = w[f][i]; if (v != null) { s += v; any = true; } }); if (any) syn[f] = Math.round(s * 1000) / 1000; });
      syn.pd = (syn.pf || 0) - (syn.pa || 0);
      syn.off_epa = syn.opl ? +(syn.oe / syn.opl).toFixed(4) : null;
      syn.def_epa = syn.dpl ? +(syn.de / syn.dpl).toFixed(4) : null;
      syn.off_plays = syn.opl || 0;
      return syn;
    }).filter(Boolean);
  }
  const baseTeams = () => isTeamPost() ? (state.data.teams_post || []) : (teamRangeActive() && state.rangeTeams) ? state.rangeTeams : state.data.teams;

  // ---- Home ---------------------------------------------------------------
  const HOME_CARDS = [
    ["🏈", "Teams", "EPA scatter, rankings, heatmaps, week-range & playoffs", "teams"],
    ["📊", "Players", "Any stat, any chart — plus archetypes & week-range", "players"],
    ["🎯", "Tendencies", "Personnel, coverages, fronts & play-action by situation", "tendencies"],
    ["🔮", "Fantasy", "Custom scoring, boom/bust & defense matchups", "fantasy"],
    ["🎓", "College", "1,900+ players & 700+ teams, national or by conference", "college"],
    ["🏆", "Standings", "Division standings, weekly scores & team trends", "standings"],
  ];
  function renderHome() {
    $("#home-cards").innerHTML = HOME_CARDS.map(([ic, t, s, v]) => `<div class="home-card" data-view="${v}"><div class="hc-ico">${ic}</div><div class="hc-title">${t}</div><div class="hc-sub">${s}</div></div>`).join("");
    $("#home-cards").querySelectorAll(".home-card").forEach((c) => c.addEventListener("click", () => go(`#/${c.dataset.view}${seasonSuffix()}`)));

    const teamsBy = (k, hi) => state.data.teams.map((t) => ({ t, v: pval(t, TSTAT[k]) })).filter((r) => r.v != null).sort((a, b) => hi ? b.v - a.v : a.v - b.v).slice(0, 5);
    const playersBy = (stat, filt) => state.data.players.filter(filt).map((p) => ({ p, v: pval(p, PSTAT[stat]) })).filter((r) => r.v != null).sort((a, b) => b.v - a.v).slice(0, 5);
    const teamCard = (title, rows, s) => `<div class="lead-card"><h3>${title}</h3>${rows.map((r) => `<div class="lead-row" data-team="${r.t.team}"><img src="${logo(r.t.team)}" alt=""/><div class="lr-name">${teamMeta(r.t.team).name}</div><div class="lr-val">${pfmt(r.v, TSTAT[s])}</div></div>`).join("")}</div>`;
    const playerCard = (title, rows, stat) => `<div class="lead-card"><h3>${title}</h3>${rows.map((r) => `<div class="lead-row" data-id="${r.p.id}"><img src="${r.p.face || logo(r.p.team)}" alt="" onerror="this.src='${logo(r.p.team)}'"/><div><div class="lr-name">${r.p.player}</div><div class="lr-sub">${r.p.pos} · ${r.p.team}</div></div><div class="lr-val">${pfmt(r.v, PSTAT[stat])}</div></div>`).join("")}</div>`;
    $("#home-leaders").innerHTML = [
      teamCard(`Best offense · ${state.season}`, teamsBy("off_epa", true), "off_epa"),
      teamCard("Best defense", teamsBy("def_epa", false), "def_epa"),
      playerCard("Passing yards", playersBy("passing_yards", (p) => p.pos === "QB"), "passing_yards"),
      playerCard("Rushing yards", playersBy("rushing_yards", (p) => p.pos === "RB" || p.pos === "FB"), "rushing_yards"),
      playerCard("Receiving yards", playersBy("receiving_yards", (p) => p.pos === "WR" || p.pos === "TE"), "receiving_yards"),
      playerCard("Fantasy points (PPR)", playersBy("fantasy_points_ppr", (p) => ["QB", "RB", "WR", "TE", "FB"].includes(p.pos)), "fantasy_points_ppr"),
    ].join("");
    $("#home-leaders").querySelectorAll(".lead-row").forEach((r) => r.addEventListener("click", () => { if (r.dataset.team) go(`#/team/${r.dataset.team}${seasonSuffix()}`); else if (r.dataset.id) go(`#/player/${encodeURIComponent(r.dataset.id)}${seasonSuffix()}`); }));
  }

  async function renderTeams() {
    if (teamRangeActive()) {
      const w = await ensureWeekly(); void w;
      const key = `${state.season}:${state.teamWkFrom}:${teamRangeHi()}`;
      if (state.teamRangeKey !== key) { state.rangeTeams = buildRangeTeams(teamWeekly()); state.teamRangeKey = key; }
    }
    const rows = baseTeams(), c = state.teamChart;
    const rtxt = isTeamPost() ? " · Playoffs" : teamRangeActive() ? ` · Weeks ${state.teamWkFrom}–${teamRangeHi()}` : "";
    $("#team-hint").textContent = (c === "scatter" ? "Each logo is a team · up / right = better · dashed lines = league average · click a team for its profile" : c === "bar" ? "All 32 teams ranked · best at top · click a team for its profile" : "Teams × the stats you pick · teal = better, red = worse · tap chips to add/remove columns") + rtxt;
    if (c === "scatter") teamScatter(rows); else if (c === "bar") teamBar(rows);
    else heatmap("team-chart-el", rows.slice(), (t) => t.team, (t) => teamMeta(t.team).name, state.teamHeat, TSTAT, "teams-heatmap");
  }
  function teamScatter(rows) {
    const sx = TSTAT[state.teamX], sy = TSTAT[state.teamY];
    const pts = rows.map((t) => ({ x: pval(t, sx), y: pval(t, sy), team: t.team })).filter((p) => p.x != null && p.y != null);
    const ax = pts.reduce((s, p) => s + p.x, 0) / pts.length, ay = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const foc = state.focus && state.focus.type === "team" ? state.focus.id : null;
    ec("team-chart-el").setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-teams-${sx.k}-vs-${sy.k}-${state.season}`), grid: { left: 64, right: 26, top: 26, bottom: 54 },
      tooltip: { trigger: "item", backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (p) => `<b>${teamMeta(p.name).name}</b><br/>${sx.l}: ${pfmt(p.value[0], sx)}<br/>${sy.l}: ${pfmt(p.value[1], sy)}` },
      xAxis: { ...axisCommon(), name: sx.l, nameLocation: "middle", nameGap: 32, nameTextStyle: { color: AXIS }, inverse: !sx.hi, scale: true },
      yAxis: { ...axisCommon(), name: sy.l, nameLocation: "middle", nameGap: 46, nameTextStyle: { color: AXIS }, inverse: !sy.hi, scale: true },
      series: [{ type: "scatter", data: pts.map((p) => ({ value: [p.x, p.y], name: p.team, symbol: logo(p.team) ? "image://" + logo(p.team) : "circle", symbolSize: p.team === foc ? 42 : 28, label: p.team === foc ? { show: true, position: "top", formatter: p.team, color: TEXT, fontWeight: 700 } : { show: false } })), markLine: { silent: true, symbol: "none", lineStyle: { color: "#5a6a86", type: "dashed", opacity: 0.7 }, label: { show: false }, data: [{ xAxis: ax }, { yAxis: ay }] } }],
    }, true);
  }
  function teamBar(rows) {
    const s = TSTAT[state.teamRank];
    const list = rows.map((t) => ({ team: t.team, v: pval(t, s) })).filter((r) => r.v != null).sort((a, b) => s.hi ? a.v - b.v : b.v - a.v);
    ec("team-chart-el").setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-teams-rank-${s.k}-${state.season}`), grid: { left: 54, right: 60, top: 26, bottom: 20 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (ps) => `${teamMeta(ps[0].name).name}<br/>${s.l}: ${pfmt(ps[0].value, s)}` },
      xAxis: { ...axisCommon(), type: "value" }, yAxis: { type: "category", data: list.map((r) => r.team), axisLine: { lineStyle: { color: LINE } }, axisLabel: { color: TEXT, fontSize: 10 } },
      series: [{ type: "bar", data: list.map((r) => ({ value: r.v, name: r.team, itemStyle: { color: color(r.team), borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: "right", color: AXIS, formatter: (p) => pfmt(p.value, s) }, barMaxWidth: 13 }],
    }, true);
  }
  const DEF_POS = new Set(["LB", "CB", "DT", "DE", "SAF", "DB", "FS", "SS", "S", "OLB", "MLB", "ILB", "NT", "EDGE"]);
  const POS_MATCH = { QB: (p) => p.pos === "QB", RB: (p) => p.pos === "RB" || p.pos === "FB", WR: (p) => p.pos === "WR", TE: (p) => p.pos === "TE", SKILL: (p) => ["RB", "FB", "WR", "TE"].includes(p.pos), DEF: (p) => DEF_POS.has(p.pos), K: (p) => p.pos === "K" };
  const POS_DEFAULTS = {
    QB: { rank: "passing_yards", x: "attempts", y: "passing_epa", set: "Passing" }, RB: { rank: "rushing_yards", x: "carries", y: "rushing_epa", set: "Rushing" },
    WR: { rank: "receiving_yards", x: "targets", y: "receiving_epa", set: "Receiving" }, TE: { rank: "receiving_yards", x: "targets", y: "receiving_epa", set: "Receiving" },
    SKILL: { rank: "fantasy_points_ppr", x: "rushing_yards", y: "receiving_yards", set: "Fantasy" },
    DEF: { rank: "def_sacks", x: "tackles", y: "def_sacks", set: "Defense" }, K: { rank: "fg_made", x: "fg_att", y: "fg_pct", set: "Kicking" },
  };
  function applyPlayerDefaults(pos) {
    const d = POS_DEFAULTS[pos] || POS_DEFAULTS.QB; state.playerPos = pos; state.playerRank = d.rank; state.playerX = d.x; state.playerY = d.y; state.playerSet = d.set; state.playerHeat = PLAYER_SETS[d.set].slice(); state.playerSort = null;
    $("#player-rank").value = d.rank; $("#player-x").value = d.x; $("#player-y").value = d.y; $("#player-set").value = d.set; if (state.playerChart === "heatmap") playerChips();
  }
  const isPost = () => state.playerSeasonType === "post";
  const rangeActive = () => !isPost() && (state.wkFrom > 1 || (state.wkTo !== 99 && state.wkTo < state.wkMax));
  const rangeHi = () => state.wkTo === 99 ? state.wkMax : state.wkTo;
  const qualFactor = () => isPost() ? 0.18 : rangeActive() ? Math.max(0.15, (rangeHi() - state.wkFrom + 1) / 17) : 1;
  function qualified(p) {
    const f = qualFactor();
    if (p.pos === "QB") return (p.attempts || 0) >= 100 * f;
    if (p.pos === "RB" || p.pos === "FB") return (p.carries || 0) >= 40 * f;
    if (p.pos === "WR" || p.pos === "TE") return (p.targets || 0) >= 30 * f;
    if (p.pos === "K") return (p.fg_att || 0) >= 10 * f;
    if (DEF_POS.has(p.pos)) return ((p.def_tackles_solo || 0) + (p.def_tackle_assists || 0)) >= 25 * f || (p.def_sacks || 0) >= 2 * f;
    return (p.targets || 0) >= 30 * f || (p.carries || 0) >= 40 * f;
  }
  function buildRangePlayers(weekly) {
    const from = state.wkFrom, to = rangeHi();
    return state.data.players.map((base) => {
      const w = weekly[base.id]; if (!w) return null;
      const idxs = w.wk.map((wk, i) => (wk >= from && wk <= to ? i : -1)).filter((i) => i >= 0);
      if (!idxs.length) return null;
      const syn = { id: base.id, player: base.player, team: base.team, pos: base.pos, grp: base.grp, face: base.face, games: idxs.length };
      NGS_KEYS.forEach((k) => { if (base[k] != null) syn[k] = base[k]; }); // NGS/snap stay season-level
      WEEKLY_SUM_KEYS.forEach((f) => { if (!w[f]) return; let s = 0, any = false; idxs.forEach((i) => { const v = w[f][i]; if (v != null) { s += v; any = true; } }); if (any) syn[f] = Math.round(s * 100) / 100; });
      WEEKLY_AVG_KEYS.forEach((f) => { if (!w[f]) return; let s = 0, n = 0; idxs.forEach((i) => { const v = w[f][i]; if (v != null) { s += v; n++; } }); if (n) syn[f] = Math.round(s / n * 1000) / 1000; });
      return syn;
    }).filter(Boolean);
  }
  const basePlayers = () => isPost() ? (state.data.players_post || []) : (rangeActive() && state.rangePlayers) ? state.rangePlayers : state.data.players;
  function filteredPlayers() { let l = basePlayers().filter(POS_MATCH[state.playerPos] || (() => true)); if (state.playerQual) l = l.filter(qualified); return l; }
  async function renderPlayers() {
    if (rangeActive()) {
      const w = await ensureWeekly();
      const key = `${state.season}:${state.wkFrom}:${rangeHi()}`;
      if (state.rangeKey !== key) { state.rangePlayers = buildRangePlayers(w); state.rangeKey = key; }
    }
    const list = filteredPlayers(), c = state.playerChart;
    const rangeTxt = isPost() ? " · Playoffs" : rangeActive() ? ` · Weeks ${state.wkFrom}–${rangeHi()}` : "";
    if (c !== "archetype") $("#player-hint").textContent = (c === "bar" ? "Top 15 by the selected stat · colored by team · click a bar for the player profile" : c === "scatter" ? "Every qualified player · colored by team · click a dot for the profile" : "Top 20 players × the stats you pick · teal = better, red = worse · tap chips to change columns") + rangeTxt;
    if (c === "archetype") playerArchetype(list);
    else if (c === "bar") playerBar(list); else if (c === "scatter") playerScatter(list);
    else { const primary = PSTAT[state.playerHeat[0]]; const top = list.map((p) => ({ p, v: pval(p, primary) })).filter((r) => r.v != null).sort((a, b) => primary.hi ? b.v - a.v : a.v - b.v).slice(0, 20).map((r) => r.p); heatmap("player-chart-el", top, (p) => p.player, (p) => `${p.player} (${p.team})`, state.playerHeat, PSTAT, "players-heatmap"); }
    renderPlayerTable(list);
  }
  function playerBar(list) {
    const s = PSTAT[state.playerRank];
    const rows = list.map((p) => ({ p, v: pval(p, s) })).filter((r) => r.v != null).sort((a, b) => s.hi ? b.v - a.v : a.v - b.v).slice(0, 15).reverse();
    ec("player-chart-el").setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-players-${state.playerPos}-${s.k}-${state.season}`), grid: { left: 140, right: 46, top: 26, bottom: 20 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (ps) => `${ps[0].name}<br/>${s.l}: ${pfmt(ps[0].value, s)}` },
      xAxis: { ...axisCommon(), type: "value" }, yAxis: { type: "category", data: rows.map((r) => r.p.player), axisLine: { lineStyle: { color: LINE } }, axisLabel: { color: TEXT, fontSize: 11 } },
      series: [{ type: "bar", data: rows.map((r) => ({ value: r.v, name: r.p.player, itemStyle: { color: color(r.p.team), borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: "right", color: AXIS, formatter: (p) => pfmt(p.value, s) }, barMaxWidth: 22 }],
    }, true);
  }
  function playerScatter(list) {
    const sx = PSTAT[state.playerX], sy = PSTAT[state.playerY];
    const pts = list.map((p) => ({ x: pval(p, sx), y: pval(p, sy), p })).filter((o) => o.x != null && o.y != null);
    const foc = state.focus && state.focus.type === "player" ? state.focus.id : null;
    ec("player-chart-el").setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-players-${state.playerPos}-${sx.k}-vs-${sy.k}-${state.season}`), grid: { left: 60, right: 26, top: 26, bottom: 52 },
      tooltip: { trigger: "item", backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (o) => `<b>${o.data.pl}</b> (${o.data.tm})<br/>${sx.l}: ${pfmt(o.value[0], sx)}<br/>${sy.l}: ${pfmt(o.value[1], sy)}` },
      xAxis: { ...axisCommon(), name: sx.l, nameLocation: "middle", nameGap: 32, nameTextStyle: { color: AXIS }, inverse: !sx.hi, scale: true },
      yAxis: { ...axisCommon(), name: sy.l, nameLocation: "middle", nameGap: 46, nameTextStyle: { color: AXIS }, inverse: !sy.hi, scale: true },
      series: [{ type: "scatter", symbolSize: 11, data: pts.map((o) => { const f = o.p.player === foc; return { value: [o.x, o.y], pl: o.p.player, tm: o.p.team, itemStyle: { color: color(o.p.team), borderColor: f ? TEXT : "transparent", borderWidth: f ? 2 : 0, opacity: foc && !f ? 0.5 : 0.95 }, symbolSize: f ? 18 : 11, label: f ? { show: true, position: "top", formatter: o.p.player, color: TEXT, fontWeight: 700 } : { show: false } }; }) }],
    }, true);
  }
  // Archetype quadrant scatter: two defining axes + labeled quadrants at the medians.
  const ARCHETYPE = {
    QB: { x: "ngs_agg", y: "rushing_yards", size: "attempts", tr: "Dual-threat gunslinger", tl: "Pocket gunslinger", br: "Dual-threat", bl: "Pocket manager" },
    RB: { x: "ypc", y: "receptions", size: "carries", tr: "Explosive receiver", tl: "Receiving back", br: "Explosive runner", bl: "Early-down grinder" },
    WR: { x: "adot", y: "receiving_yards_after_catch", size: "targets", tr: "Complete WR", tl: "YAC weapon", br: "Deep threat", bl: "Possession" },
    TE: { x: "adot", y: "receiving_yards_after_catch", size: "targets", tr: "Complete TE", tl: "YAC weapon", br: "Seam threat", bl: "Possession / blocker" },
    DEF: { x: "def_sacks", y: "def_interceptions", size: "tackles", tr: "Playmaker", tl: "Ball hawk", br: "Pass rusher", bl: "Run stopper" },
  };
  function playerArchetype(list) {
    const a = ARCHETYPE[bucket(state.playerPos === "SKILL" ? "WR" : state.playerPos)] || ARCHETYPE.WR;
    const sx = PSTAT[a.x], sy = PSTAT[a.y], ssize = PSTAT[a.size];
    const pts = list.map((p) => ({ x: pval(p, sx), y: pval(p, sy), s: pval(p, ssize) || 0, p })).filter((o) => o.x != null && o.y != null);
    if (!pts.length) { ec("player-chart-el").setOption({ title: { text: "Not enough data for this position", left: "center", top: "middle", textStyle: { color: AXIS, fontSize: 13 } } }, true); return; }
    const med = (arr) => { const s = arr.slice().sort((m, n) => m - n); return s[Math.floor(s.length / 2)]; };
    const mx = med(pts.map((o) => o.x)), my = med(pts.map((o) => o.y));
    const maxS = Math.max(...pts.map((o) => o.s), 1);
    const foc = state.focus && state.focus.type === "player" ? state.focus.id : null;
    $("#player-hint").textContent = `${sx.l} (x) vs ${sy.l} (y) · dot size = ${ssize.l} · quadrants split at the median`;
    ec("player-chart-el").setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-archetypes-${state.playerPos}-${state.season}`),
      grid: { left: 60, right: 26, top: 30, bottom: 52 },
      graphic: [
        { type: "text", right: 30, top: 36, style: { text: a.tr, fill: AXIS, fontSize: 11, fontWeight: 700, opacity: 0.8 } },
        { type: "text", left: 66, top: 36, style: { text: a.tl, fill: AXIS, fontSize: 11, fontWeight: 700, opacity: 0.8 } },
        { type: "text", right: 30, bottom: 58, style: { text: a.br, fill: AXIS, fontSize: 11, fontWeight: 700, opacity: 0.8 } },
        { type: "text", left: 66, bottom: 58, style: { text: a.bl, fill: AXIS, fontSize: 11, fontWeight: 700, opacity: 0.8 } },
        { type: "text", right: 12, bottom: 8, z: 12, silent: true, style: { text: "@mikeapter", fill: AXIS, opacity: 0.55, fontSize: 12, fontWeight: 600 } },
      ],
      tooltip: { trigger: "item", backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (o) => `<b>${o.data.pl}</b> (${o.data.tm})<br/>${sx.l}: ${pfmt(o.value[0], sx)}<br/>${sy.l}: ${pfmt(o.value[1], sy)}` },
      xAxis: { ...axisCommon(), name: sx.l, nameLocation: "middle", nameGap: 32, nameTextStyle: { color: AXIS }, scale: true },
      yAxis: { ...axisCommon(), name: sy.l, nameLocation: "middle", nameGap: 46, nameTextStyle: { color: AXIS }, scale: true },
      series: [{
        type: "scatter",
        data: pts.map((o) => { const f = o.p.player === foc; return { value: [o.x, o.y], pl: o.p.player, tm: o.p.team, symbolSize: 8 + 16 * Math.sqrt(o.s / maxS), itemStyle: { color: color(o.p.team), borderColor: f ? TEXT : "transparent", borderWidth: f ? 2 : 0, opacity: foc && !f ? 0.5 : 0.9 }, label: f ? { show: true, position: "top", formatter: o.p.player, color: TEXT, fontWeight: 700 } : { show: false } }; }),
        markLine: { silent: true, symbol: "none", lineStyle: { color: "#5a6a86", type: "dashed", opacity: 0.6 }, label: { show: false }, data: [{ xAxis: mx }, { yAxis: my }] },
      }],
    }, true);
  }
  function renderPlayerTable(list) {
    const rankStat = PSTAT[state.playerRank];
    const setKey = state.playerChart === "heatmap" ? state.playerSet : ({ QB: "Passing", RB: "Rushing", DEF: "Defense", K: "Kicking" }[state.playerPos] || "Receiving");
    const cols = Array.from(new Set([state.playerRank, ...PLAYER_SETS[setKey]])).slice(0, 6).map((k) => PSTAT[k]);
    const sort = state.playerSort || { key: state.playerRank, dir: rankStat.hi ? -1 : 1 };
    const ss = PSTAT[sort.key];
    const sorted = list.map((p) => ({ p, v: pval(p, ss) })).filter((r) => r.v != null).sort((a, b) => (a.v - b.v) * sort.dir);
    const foc = state.focus && state.focus.type === "player" ? state.focus.id : null;
    const arrow = (k) => sort.key === k ? `<span class="sort-arrow">${sort.dir < 0 ? "▾" : "▴"}</span>` : "";
    const th = (label, k) => `<th class="sortable" data-k="${k}">${label} ${arrow(k)}</th>`;
    const head = `<thead><tr><th class="rank">#</th><th>Player</th><th>Tm</th><th>Pos</th>${cols.map((c) => th(c.l, c.k)).join("")}${th("G", "games")}</tr></thead>`;
    const body = sorted.map((r, i) => `<tr${r.p.player === foc ? ' class="hl"' : ""}><td class="rank">${i + 1}</td><td class="pname">${r.p.player}</td><td class="pteam">${r.p.team || ""}</td><td class="pteam">${r.p.pos || ""}</td>${cols.map((c) => `<td>${pfmt(pval(r.p, c), c)}</td>`).join("")}<td>${r.p.games ?? ""}</td></tr>`).join("");
    $("#player-table").innerHTML = head + `<tbody>${body}</tbody>`;
    const hl = $("#player-table .hl"); if (hl) hl.scrollIntoView({ block: "nearest" });
  }
  function onTableClick(e) {
    const th = e.target.closest("th.sortable");
    if (th) { const k = th.dataset.k; const s = PSTAT[k]; const cur = state.playerSort; state.playerSort = (cur && cur.key === k) ? { key: k, dir: -cur.dir } : { key: k, dir: s.hi ? -1 : 1 }; renderPlayers(); return; }
    const tr = e.target.closest("tbody tr"); const cell = tr && tr.querySelector(".pname");
    if (cell) { const pl = findPlayer(cell.textContent); if (pl) go(`#/player/${encodeURIComponent(pl.id || pl.player)}${seasonSuffix()}`); }
  }

  // ---- Heatmap ------------------------------------------------------------
  function heatmap(elId, entities, nameFn, longNameFn, statKeys, statMap, fileprefix) {
    const stats = statKeys.map((k) => statMap[k]); const first = stats[0];
    entities = entities.slice().sort((a, b) => { const av = pval(a, first), bv = pval(b, first); if (av == null) return 1; if (bv == null) return -1; return (bv - av) * (first.hi ? 1 : -1); });
    const cols = stats.map((s) => { const vals = entities.map((e) => pval(e, s)).filter((v) => v != null); const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1); const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length || 1)) || 1; return { mean, sd }; });
    const data = [];
    entities.forEach((e, yi) => stats.forEach((s, xi) => { const raw = pval(e, s); if (raw == null) return; const z = (raw - cols[xi].mean) / cols[xi].sd * (s.hi ? 1 : -1); data.push({ value: [xi, entities.length - 1 - yi, +z.toFixed(3)], raw, ent: longNameFn(e), lab: s.l, s }); }));
    ec(elId).setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-${fileprefix}-${state.season}`), grid: { left: 138, right: 20, top: 30, bottom: 62 },
      tooltip: { backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (p) => `<b>${p.data.ent}</b><br/>${p.data.lab}: ${pfmt(p.data.raw, p.data.s)}` },
      xAxis: { type: "category", data: stats.map((s) => s.l), position: "top", axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: AXIS, interval: 0, fontSize: 10, overflow: "break", width: 76 } },
      yAxis: { type: "category", data: entities.map(nameFn).reverse(), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: TEXT, fontSize: 11 } },
      visualMap: { min: -2, max: 2, calculable: false, orient: "horizontal", left: "center", bottom: 4, itemWidth: 12, itemHeight: 90, textStyle: { color: AXIS }, text: ["better", "worse"], inRange: { color: ["#d1493f", "#e6c86e", "#2a9d8f"] } },
      series: [{ type: "heatmap", data, itemStyle: { borderColor: BG, borderWidth: 1 }, emphasis: { itemStyle: { borderColor: TEXT, borderWidth: 1.5 } } }],
    }, true);
  }

  // ---- Standings + Scores + Trends ---------------------------------------
  const DIV_ORDER = ["AFC East", "AFC North", "AFC South", "AFC West", "NFC East", "NFC North", "NFC South", "NFC West"];
  function renderStandings() {
    const st = state.data.standings;
    $("#divisions").innerHTML = DIV_ORDER.filter((d) => st[d]).map((d) => `<div class="divcard"><h3>${d}</h3>${st[d].map((r) => `<div class="divrow" data-team="${r.team}"><img src="${logo(r.team)}" alt="" loading="lazy"/><span class="tname">${teamMeta(r.team).name}</span><span class="rec">${r.w}-${r.l}${r.t ? "-" + r.t : ""}</span><span class="pd ${r.pd >= 0 ? "pos" : "neg"}">${r.pd >= 0 ? "+" : ""}${r.pd}</span></div>`).join("")}</div>`).join("");
  }
  function renderScores() {
    const gs = (state.data.scores[$("#week-select").value] || []).slice();
    $("#scores").innerHTML = gs.map((g) => { const aw = g.as > g.hs, hw = g.hs > g.as; const side = (t, s, w, l) => `<div class="gteam ${w ? "win" : l ? "lose" : ""}"><img src="${logo(t)}" alt="" loading="lazy"/><span class="gt-name">${t}</span><span class="gt-score">${s}</span></div>`; return `<div class="gcard">${side(g.away, g.as, aw, hw)}${side(g.home, g.hs, hw, aw)}<div class="gdate">${g.date || ""}</div></div>`; }).join("") || '<p class="hint">No games.</p>';
  }
  function weekOrder(a, b) { return weekNum(a) - weekNum(b); }
  function weekNum(w) { const m = w.match(/(\d+)/g); return m ? +m[m.length - 1] : 0; }
  function weekLabel(w) { if (/^\d+$/.test(w)) return "Week " + +w; const map = { WC: "Wild Card", DIV: "Divisional", CON: "Conf Champ", CONF: "Conf Champ", SB: "Super Bowl" }; return map[w.split("-")[0]] || w; }

  function trendPd(elId, abbr, extrasName) {
    const t = state.data.trends[abbr]; if (!t) return;
    ec(elId).setOption({
      backgroundColor: "transparent", ...(extrasName ? chartExtras(extrasName) : {}), title: { text: teamMeta(abbr).name + " — weekly point differential", left: 8, top: 4, textStyle: { color: TEXT, fontSize: 13, fontWeight: 600 } },
      grid: { left: 44, right: 20, top: 40, bottom: 30 },
      tooltip: { trigger: "axis", backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (ps) => { const p = ps[0]; return `Week ${p.axisValue}<br/>${t.result[p.dataIndex]} · ${p.value >= 0 ? "+" : ""}${p.value}`; } },
      xAxis: { ...axisCommon(), type: "category", data: t.weeks }, yAxis: { ...axisCommon(), type: "value" },
      series: [{ type: "bar", data: t.pd.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? color(abbr) : "#f87171", borderRadius: v >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3] } })), barMaxWidth: 26 }],
    }, true);
  }
  function trendEpa(elId, abbr, extrasName) {
    const t = state.data.trends[abbr]; if (!t) return; const hasEpa = t.off_epa && t.epa_weeks;
    ec(elId).setOption({
      backgroundColor: "transparent", ...(extrasName ? chartExtras(extrasName) : {}), title: { text: "Weekly EPA per play (offense vs defense)", left: 8, top: 4, textStyle: { color: TEXT, fontSize: 13, fontWeight: 600 } },
      legend: { data: ["Offense", "Defense"], top: 6, left: "center", textStyle: { color: AXIS } }, grid: { left: 48, right: 20, top: 40, bottom: 30 },
      tooltip: { trigger: "axis", backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT } },
      xAxis: { ...axisCommon(), type: "category", data: hasEpa ? t.epa_weeks : [] }, yAxis: { ...axisCommon(), type: "value", axisLabel: { color: AXIS, formatter: (v) => v.toFixed(2) } },
      series: [{ name: "Offense", type: "line", smooth: true, data: hasEpa ? t.off_epa : [], lineStyle: { color: color(abbr), width: 2.5 }, itemStyle: { color: color(abbr) }, symbolSize: 6 }, { name: "Defense", type: "line", smooth: true, data: hasEpa ? t.def_epa : [], lineStyle: { color: "#f87171", width: 2.5 }, itemStyle: { color: "#f87171" }, symbolSize: 6 }],
    }, true);
  }
  function renderTrends() { trendPd("trend-pd", state.team, `nfl-${state.team}-pointdiff-${state.season}`); trendEpa("trend-epa", state.team, `nfl-${state.team}-epa-${state.season}`); }

  // ---- College ------------------------------------------------------------
  function fillCollegeRank(cat, sel) {
    const el = $("#college-rank");
    el.innerHTML = COLLEGE_CAT[cat].stats.map((k) => `<option value="${k}">${CSTAT[k].l}</option>`).join("");
    el.value = COLLEGE_CAT[cat].stats.includes(sel) ? sel : COLLEGE_CAT[cat].rank;
  }
  function collegeModeControls() {
    const teams = state.collegeMode === "teams";
    $("#college-cat").style.display = teams ? "none" : "";
    if (teams) { $("#college-rank").innerHTML = CTEAM_ORDER.map((k) => `<option value="${k}">${CTEAM_STAT[k].l}</option>`).join(""); $("#college-rank").value = state.collegeTeamRank; }
    else fillCollegeRank(state.collegeCat, state.collegeRank);
  }
  async function renderCollegeTeams() {
    const hint = $("#college-hint");
    const data = await ensureCollege();
    const cts = (data && data.cteams) || [];
    if (!cts.length) { hint.textContent = `No college team data for ${state.season}.`; $("#college-table").innerHTML = ""; if (charts["college-chart"]) charts["college-chart"].clear(); return; }
    const conf = $("#college-conf");
    const confs = Array.from(new Set(cts.map((t) => t.conf).filter(Boolean))).sort();
    if (conf.dataset.mode !== "teams" || conf.options.length !== confs.length + 1) { conf.innerHTML = `<option value="">All conferences</option>` + confs.map((c) => `<option value="${c}">${c}</option>`).join(""); conf.value = state.collegeConf || ""; conf.dataset.mode = "teams"; }
    let list = cts.slice();
    if (state.collegeClass !== "All") list = list.filter((t) => t.class === state.collegeClass);
    if (state.collegeScope === "Conference" && state.collegeConf) list = list.filter((t) => t.conf === state.collegeConf);
    if (state.collegeFilter) list = list.filter((t) => t.team.toLowerCase().includes(state.collegeFilter));
    const rs = CTEAM_STAT[state.collegeTeamRank];
    hint.textContent = `${list.length} college teams · ${state.season} · ranked by ${rs.l}`;
    const bar = list.map((t) => ({ t, v: pval(t, rs) })).filter((r) => r.v != null).sort((a, b) => rs.hi ? b.v - a.v : a.v - b.v).slice(0, 15).reverse();
    ec("college-chart").setOption({
      backgroundColor: "transparent", ...chartExtras(`college-teams-${rs.k}-${state.season}`),
      grid: { left: 150, right: 54, top: 26, bottom: 20 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (ps) => `${ps[0].name}<br/>${rs.l}: ${pfmt(ps[0].value, rs)}` },
      xAxis: { ...axisCommon(), type: "value" },
      yAxis: { type: "category", data: bar.map((r) => r.t.team), axisLine: { lineStyle: { color: LINE } }, axisLabel: { color: TEXT, fontSize: 11 } },
      series: [{ type: "bar", data: bar.map((r) => ({ value: r.v, itemStyle: { color: r.t.color || "#4da3ff", borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: "right", color: AXIS, formatter: (p) => pfmt(p.value, rs) }, barMaxWidth: 22 }],
    }, true);
    const cols = ["ppg", "papg", "total_yds", "def_yds"].map((k) => CTEAM_STAT[k]);
    const sort = state.collegeTeamSort || { key: state.collegeTeamRank, dir: rs.hi ? -1 : 1 };
    const ss = CTEAM_STAT[sort.key];
    const sorted = list.map((t) => ({ t, v: pval(t, ss) })).filter((r) => r.v != null).sort((a, b) => (a.v - b.v) * sort.dir);
    const arrow = (k) => sort.key === k ? `<span class="sort-arrow">${sort.dir < 0 ? "▾" : "▴"}</span>` : "";
    const th = (l, k) => `<th class="sortable" data-k="${k}">${l} ${arrow(k)}</th>`;
    const head = `<thead><tr><th class="rank">#</th><th>Team</th><th>Conf</th><th>Rec</th>${th("PD", "pd")}${cols.map((c) => th(c.l, c.k)).join("")}</tr></thead>`;
    const body = sorted.slice(0, 250).map((r, i) => { const t = r.t, lg = t.logo ? `<img class="ct-logo" src="${t.logo}" alt="" loading="lazy"/>` : ""; return `<tr><td class="rank">${i + 1}</td><td class="pname ct-cell">${lg}${t.team}</td><td class="pteam">${t.conf || ""}</td><td class="pteam">${t.w}-${t.l}</td><td>${t.pd >= 0 ? "+" : ""}${t.pd}</td>${cols.map((c) => `<td>${pfmt(pval(t, c), c)}</td>`).join("")}</tr>`; }).join("");
    $("#college-table").innerHTML = head + `<tbody>${body}</tbody>`;
  }
  async function renderCollege() {
    if (state.collegeMode === "teams") return renderCollegeTeams();
    const hint = $("#college-hint");
    const data = await ensureCollege();
    if (!data) { hint.textContent = `No college data for ${state.season}.`; $("#college-table").innerHTML = ""; if (charts["college-chart"]) charts["college-chart"].clear(); return; }
    const players = data.players;
    { const conf = $("#college-conf"); if (conf.dataset.mode === "teams") conf.dataset.mode = "players"; }
    const conf = $("#college-conf");
    const confs = Array.from(new Set(players.map((p) => p.conf).filter(Boolean))).sort();
    if (conf.dataset.mode === "teams" || conf.options.length !== confs.length + 1) { conf.innerHTML = `<option value="">All conferences</option>` + confs.map((c) => `<option value="${c}">${c}</option>`).join(""); conf.value = state.collegeConf || confs[0] || ""; state.collegeConf = conf.value; conf.dataset.mode = "players"; }

    const cat = COLLEGE_CAT[state.collegeCat], rs = CSTAT[state.collegeRank];
    let list = players.filter(cat.filter);
    if (state.collegeClass !== "All") list = list.filter((p) => p.class === state.collegeClass);
    const scope = state.collegeScope;
    if (scope === "Conference" && state.collegeConf) list = list.filter((p) => p.conf === state.collegeConf);
    let shown = list;
    if (state.collegeFilter) shown = shown.filter((p) => p.player.toLowerCase().includes(state.collegeFilter));

    const scopeTxt = scope === "Conference" ? state.collegeConf : scope === "Both" ? "national + conference rank" : `${state.collegeClass === "All" ? "all divisions" : state.collegeClass}`;
    hint.textContent = `${shown.length} players · ${state.season} · ${scopeTxt} · ranked by ${rs.l} · click a player for their profile`;

    // conference rank map for "Both"
    let confRank = null;
    if (scope === "Both") {
      confRank = {};
      const byC = {};
      list.forEach((p) => { (byC[p.conf] = byC[p.conf] || []).push(p); });
      Object.values(byC).forEach((arr) => { arr.slice().map((p) => ({ p, v: pval(p, rs) })).filter((r) => r.v != null).sort((a, b) => rs.hi ? b.v - a.v : a.v - b.v).forEach((r, i) => { confRank[r.p.id] = i + 1; }); });
    }

    const barRows = shown.map((p) => ({ p, v: pval(p, rs) })).filter((r) => r.v != null).sort((a, b) => rs.hi ? b.v - a.v : a.v - b.v).slice(0, 15).reverse();
    ec("college-chart").setOption({
      backgroundColor: "transparent", ...chartExtras(`college-${state.collegeCat}-${rs.k}-${state.season}`),
      grid: { left: 150, right: 54, top: 26, bottom: 20 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (ps) => `${ps[0].name}<br/>${rs.l}: ${pfmt(ps[0].value, rs)}` },
      xAxis: { ...axisCommon(), type: "value" },
      yAxis: { type: "category", data: barRows.map((r) => r.p.player), axisLine: { lineStyle: { color: LINE } }, axisLabel: { color: TEXT, fontSize: 11 } },
      series: [{ type: "bar", data: barRows.map((r) => ({ value: r.v, itemStyle: { color: cteam(r.p.team).color, borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: "right", color: AXIS, formatter: (p) => pfmt(p.value, rs) }, barMaxWidth: 22 }],
    }, true);

    const cols = cat.stats.map((k) => CSTAT[k]);
    const sort = state.collegeSort || { key: state.collegeRank, dir: rs.hi ? -1 : 1 };
    const ss = CSTAT[sort.key];
    const sorted = shown.map((p) => ({ p, v: pval(p, ss) })).filter((r) => r.v != null).sort((a, b) => (a.v - b.v) * sort.dir);
    const arrow = (k) => sort.key === k ? `<span class="sort-arrow">${sort.dir < 0 ? "▾" : "▴"}</span>` : "";
    const th = (l, k) => `<th class="sortable" data-k="${k}">${l} ${arrow(k)}</th>`;
    const confHead = scope === "Both" ? `<th>Conf#</th>` : "";
    const head = `<thead><tr><th class="rank">#</th><th>Player</th><th>Team</th><th>Conf</th>${confHead}${cols.map((c) => th(c.l, c.k)).join("")}${th("G", "games")}</tr></thead>`;
    const body = sorted.slice(0, 250).map((r, i) => {
      const t = cteam(r.p.team), lg = t.logo ? `<img class="ct-logo" src="${t.logo}" alt="" loading="lazy"/>` : "";
      const cr = scope === "Both" ? `<td>${confRank[r.p.id] || ""}</td>` : "";
      return `<tr data-id="${r.p.id}"><td class="rank">${i + 1}</td><td class="pname">${r.p.player} <span class="pteam">${r.p.pos || ""}</span></td><td class="pteam ct-cell">${lg}${t.abbr || r.p.team || ""}</td><td class="pteam">${r.p.conf || ""}</td>${cr}${cols.map((c) => `<td>${pfmt(pval(r.p, c), c)}</td>`).join("")}<td>${r.p.games ?? ""}</td></tr>`;
    }).join("");
    $("#college-table").innerHTML = head + `<tbody>${body}</tbody>`;
  }
  function onCollegeTableClick(e) {
    const th = e.target.closest("th.sortable");
    if (th) {
      const k = th.dataset.k;
      if (state.collegeMode === "teams") { const s = CTEAM_STAT[k], cur = state.collegeTeamSort; state.collegeTeamSort = (cur && cur.key === k) ? { key: k, dir: -cur.dir } : { key: k, dir: s.hi ? -1 : 1 }; }
      else { const s = CSTAT[k], cur = state.collegeSort; state.collegeSort = (cur && cur.key === k) ? { key: k, dir: -cur.dir } : { key: k, dir: s.hi ? -1 : 1 }; }
      renderCollege(); return;
    }
    const tr = e.target.closest("tbody tr"); if (tr && tr.dataset.id) go(`#/cplayer/${encodeURIComponent(tr.dataset.id)}${seasonSuffix()}`);
  }
  // ---- Tendencies ---------------------------------------------------------
  const TEND_METRICS = {
    off: [["Personnel grouping", "grp"], ["Formation", "form"], ["Play action", "pa"], ["Motion", "motion"], ["Screen", "screen"], ["RPO", "rpo"], ["No huddle", "nohuddle"]],
    def: [["Coverage", "cov"], ["Front / package", "pkg"], ["Man vs zone", "mz"], ["Defenders in box", "box"], ["Blitz", "blitz"]],
  };
  const YESNO = () => ["No", "Yes"];
  // metric key -> {idx into play array, legend source, labelFn}
  const TEND_META = {
    grp: { idx: 7, leg: (d) => d.grp, lab: (v) => v + " pers" },
    form: { idx: 8, leg: (d) => d.form, lab: (v) => v },
    cov: { idx: 10, leg: (d) => d.cov, lab: (v) => v },
    pkg: { idx: 9, leg: (d) => d.pkg, lab: (v) => v },
    mz: { idx: 11, leg: () => ["", "Man", "Zone"], lab: (v) => v, skipZero: true },
    box: { idx: 12, leg: null, lab: (v) => v + " in box" },
    pa: { idx: 13, leg: YESNO, lab: (v) => v }, screen: { idx: 14, leg: YESNO, lab: (v) => v },
    rpo: { idx: 15, leg: YESNO, lab: (v) => v }, motion: { idx: 16, leg: YESNO, lab: (v) => v },
    nohuddle: { idx: 17, leg: YESNO, lab: (v) => v }, blitz: { idx: 18, leg: YESNO, lab: (v) => v },
  };
  const TEND_PALETTE = ["#4da3ff", "#34d399", "#e6c86e", "#f0883e", "#d1493f", "#a78bfa", "#2a9d8f", "#f472b6", "#94a3b8", "#22d3ee", "#fb7185", "#a3e635"];
  function fillTendMetric(side) {
    const m = TEND_METRICS[side];
    $("#tend-metric").innerHTML = m.map(([l, k]) => `<option value="${k}">${l}</option>`).join("");
    state.tendMetric = m[0][1]; $("#tend-metric").value = state.tendMetric;
  }
  function fillTendGames() {
    const d = state.tend[state.season]; if (!d) return;
    const ti = d.teams.indexOf(state.tendTeam), sideIdx = state.tendSide === "off" ? 0 : 1;
    const weeks = {};
    d.plays.forEach((p) => { if (p[sideIdx] === ti) weeks[p[5]] = p[state.tendSide === "off" ? 1 : 0]; });
    const opts = Object.keys(weeks).map(Number).sort((a, b) => a - b)
      .map((w) => `<option value="${w}">Wk ${w} ${state.tendSide === "off" ? "vs" : "vs"} ${d.teams[weeks[w]]}</option>`).join("");
    $("#tend-game").innerHTML = `<option value="">All games</option>` + opts;
    $("#tend-game").value = state.tendGame || "";
  }
  const BREAKS = {
    down: { cats: ["1st", "2nd", "3rd", "4th"], of: (p) => p[2] - 1 },
    dist: { cats: ["1–3", "4–6", "7–9", "10+"], of: (p) => p[3] },
    qtr: { cats: ["Q1", "Q2", "Q3", "Q4", "OT"], of: (p) => p[4] - 1 },
  };
  async function renderTendencies() {
    const hint = $("#tend-hint");
    const d = await ensureTendencies();
    if (!d) { hint.textContent = `No tendencies data for ${state.season}.`; if (charts["tend-chart"]) charts["tend-chart"].clear(); return; }
    // team select (once per season)
    const tsel = $("#tend-team");
    if (tsel.options.length !== d.teams.length) {
      const sorted = d.teams.slice().sort((a, b) => teamMeta(a).name.localeCompare(teamMeta(b).name));
      tsel.innerHTML = sorted.map((t) => `<option value="${t}">${teamMeta(t).name}</option>`).join("");
      if (!state.tendTeam || !d.teams.includes(state.tendTeam)) state.tendTeam = sorted[0];
      tsel.value = state.tendTeam; fillTendGames();
    }
    const ti = d.teams.indexOf(state.tendTeam);
    const sideIdx = state.tendSide === "off" ? 0 : 1;
    const mk = state.tendMetric, meta = TEND_META[mk];
    const legend = meta.leg ? meta.leg(d) : null;
    const brk = BREAKS[state.tendBreak];
    const wk = state.tendGame ? +state.tendGame : null;
    const pt = state.tendPtype;

    // counts[breakCat][metricLabel] = n
    const counts = brk.cats.map(() => ({}));
    const rowN = brk.cats.map(() => 0);
    let total = 0;
    for (const p of d.plays) {
      if (p[sideIdx] !== ti) continue;
      if (wk != null && p[5] !== wk) continue;
      if (pt !== "" && p[6] !== +pt) continue;
      const raw = p[meta.idx];
      let val;
      if (legend) { if (raw < 0) continue; val = legend[raw]; } else { val = raw; }
      if (val === "" || val == null) continue;
      if (meta.skipZero && raw === 0) continue;
      const bi = brk.of(p); if (bi < 0 || bi >= brk.cats.length) continue;
      const lab = meta.lab(val);
      counts[bi][lab] = (counts[bi][lab] || 0) + 1; rowN[bi]++; total++;
    }
    // metric categories, ordered by legend order (or numeric), then overall frequency
    const totals = {};
    counts.forEach((c) => Object.entries(c).forEach(([k, v]) => { totals[k] = (totals[k] || 0) + v; }));
    let cats = Object.keys(totals);
    if (legend) cats.sort((a, b) => legend.map((x) => meta.lab(x)).indexOf(a) - legend.map((x) => meta.lab(x)).indexOf(b));
    else cats.sort((a, b) => parseFloat(a) - parseFloat(b));
    cats = cats.sort((a, b) => totals[b] - totals[a]).slice(0, 12); // cap legend size, keep top

    const metricName = TEND_METRICS[state.tendSide].find(([, k]) => k === mk)[0];
    hint.textContent = `${teamMeta(state.tendTeam).name} ${state.tendSide === "off" ? "offense" : "defense"} · ${metricName} by ${state.tendBreak === "down" ? "down" : state.tendBreak === "dist" ? "distance" : "quarter"} · ${total} plays${wk ? " · Week " + wk : ""}${pt !== "" ? " · " + (pt === "1" ? "pass" : "run") + " only" : ""}${mk === "cov" ? " · coverage charted on pass plays" : ""}`;

    const yCats = brk.cats.map((c, i) => `${c}  (n=${rowN[i]})`);
    const series = cats.map((cat, ci) => ({
      name: cat, type: "bar", stack: "s", barMaxWidth: 34,
      itemStyle: { color: TEND_PALETTE[ci % TEND_PALETTE.length] },
      label: { show: true, color: "#0b0f17", fontSize: 10, formatter: (p) => p.value >= 8 ? Math.round(p.value) + "%" : "" },
      data: brk.cats.map((_, bi) => rowN[bi] ? +(100 * (counts[bi][cat] || 0) / rowN[bi]).toFixed(1) : 0),
    }));
    ec("tend-chart").setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-tendencies-${state.tendTeam}-${mk}-${state.tendBreak}-${state.season}`),
      grid: { left: 78, right: 20, top: 40, bottom: 24 },
      legend: { top: 6, left: "center", textStyle: { color: AXIS }, type: "scroll", data: cats },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT },
        formatter: (ps) => { const bi = ps[0].dataIndex; let s = `<b>${brk.cats[bi]}</b> · ${rowN[bi]} plays<br/>`; ps.filter((x) => x.value > 0).sort((a, b) => b.value - a.value).forEach((x) => { s += `${x.marker}${x.seriesName}: ${x.value}% (${counts[bi][x.seriesName] || 0})<br/>`; }); return s; } },
      xAxis: { type: "value", max: 100, axisLabel: { color: AXIS, formatter: "{value}%" }, splitLine: { lineStyle: { color: LINE } } },
      yAxis: { type: "category", data: yCats, inverse: true, axisLine: { lineStyle: { color: LINE } }, axisLabel: { color: TEXT, fontSize: 11 } },
      series,
    }, true);
  }

  // ---- Fantasy ------------------------------------------------------------
  const FAN_REC = { std: 0, half: 0.5, ppr: 1 };
  const FAN_POS_MATCH = { QB: (p) => p.pos === "QB", RB: (p) => p.pos === "RB" || p.pos === "FB", WR: (p) => p.pos === "WR", TE: (p) => p.pos === "TE", FLEX: (p) => ["RB", "FB", "WR", "TE"].includes(p.pos) };
  const FAN_BOOM = { QB: [25, 15], RB: [20, 8], WR: [20, 8], TE: [15, 5], FLEX: [20, 8] };
  function fanSettings() {
    return { passYd: 0.04, passTd: state.fanPassTd6 ? 6 : 4, int: -2, rushYd: 0.1, recYd: 0.1, rec: FAN_REC[state.fanScoring], fum: -2 };
  }
  function fanWeekPts(w, i, s) {
    const g = (f) => (w[f] ? (w[f][i] || 0) : 0);
    return g("passing_yards") * s.passYd + g("passing_tds") * s.passTd + g("passing_interceptions") * s.int
      + g("rushing_yards") * s.rushYd + g("rushing_tds") * 6
      + g("receiving_yards") * s.recYd + g("receiving_tds") * 6 + g("receptions") * s.rec
      + g("fumbles_lost_total") * s.fum;
  }
  async function renderFantasy() {
    const weekly = await ensureWeekly();
    const s = fanSettings(), scLabel = { std: "Standard", half: "Half-PPR", ppr: "PPR" }[state.fanScoring] + (state.fanPassTd6 ? " · 6pt pass TD" : "");
    if (state.fanView === "matchups") return fantasyMatchups(weekly, s, scLabel);
    // per-player aggregation
    const [boomT, bustT] = FAN_BOOM[state.fanPos];
    const rows = state.data.players.filter(FAN_POS_MATCH[state.fanPos]).map((p) => {
      const w = weekly[p.id]; if (!w) return null;
      const pts = w.wk.map((_, i) => fanWeekPts(w, i, s));
      const g = pts.length; if (!g) return null;
      const tot = pts.reduce((a, b) => a + b, 0), avg = tot / g;
      const sorted = pts.slice().sort((a, b) => a - b);
      const boom = pts.filter((x) => x >= boomT).length, bust = pts.filter((x) => x < bustT).length;
      const sd = Math.sqrt(pts.reduce((a, b) => a + (b - avg) ** 2, 0) / g);
      return { p, g, tot, avg, floor: sorted[0], ceil: sorted[g - 1], boom: 100 * boom / g, bust: 100 * bust / g, sd };
    }).filter(Boolean);
    const sort = state.fanSort || { key: "avg", dir: -1 };
    rows.sort((a, b) => (a[sort.key] - b[sort.key]) * sort.dir);
    $("#fan-hint").textContent = `${rows.length} ${state.fanPos} · ${state.season} · ${scLabel} · boom = ${boomT}+ pts, bust = <${bustT}`;
    // chart: top 15 by PPG, floor–ceiling range with avg
    const top = rows.slice().sort((a, b) => b.avg - a.avg).slice(0, 15).reverse();
    ec("fan-chart").setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-fantasy-${state.fanPos}-${state.fanScoring}-${state.season}`),
      grid: { left: 140, right: 46, top: 30, bottom: 24 },
      legend: { data: ["Floor→Ceiling", "Avg"], top: 6, left: "center", textStyle: { color: AXIS } },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (ps) => { const r = top[ps[0].dataIndex]; return `${r.p.player}<br/>Avg ${r.avg.toFixed(1)}<br/>Floor ${r.floor.toFixed(1)} · Ceiling ${r.ceil.toFixed(1)}<br/>Boom ${r.boom.toFixed(0)}% · Bust ${r.bust.toFixed(0)}%`; } },
      xAxis: { ...axisCommon(), type: "value" },
      yAxis: { type: "category", data: top.map((r) => r.p.player), axisLine: { lineStyle: { color: LINE } }, axisLabel: { color: TEXT, fontSize: 11 } },
      series: [
        { name: "Floor→Ceiling", type: "bar", stack: "r", itemStyle: { color: "transparent" }, data: top.map((r) => r.floor), silent: true },
        { name: "range", type: "bar", stack: "r", itemStyle: { color: color2(0.28) }, barMaxWidth: 16, data: top.map((r) => r.ceil - r.floor), tooltip: { show: false } },
        { name: "Avg", type: "scatter", symbolSize: 10, data: top.map((r) => [r.avg, r.p.player]), itemStyle: { color: (o) => color(top[o.dataIndex].p.team) } },
      ],
    }, true);
    // table
    const cols = [["Total", "tot", 1], ["PPG", "avg", 1], ["Floor", "floor", 1], ["Ceiling", "ceil", 1], ["Boom%", "boom", 0], ["Bust%", "bust", 0], ["StdDev", "sd", 1]];
    const arrow = (k) => sort.key === k ? `<span class="sort-arrow">${sort.dir < 0 ? "▾" : "▴"}</span>` : "";
    const head = `<thead><tr><th class="rank">#</th><th>Player</th><th>Tm</th><th>Pos</th><th class="sortable" data-k="g">G ${arrow("g")}</th>${cols.map(([l, k]) => `<th class="sortable" data-k="${k}">${l} ${arrow(k)}</th>`).join("")}</tr></thead>`;
    const body = rows.map((r, i) => `<tr data-id="${r.p.id}"><td class="rank">${i + 1}</td><td class="pname">${r.p.player}</td><td class="pteam">${r.p.team}</td><td class="pteam">${r.p.pos}</td><td>${r.g}</td>${cols.map(([, k, d]) => `<td>${r[k].toFixed(d)}${k === "boom" || k === "bust" ? "%" : ""}</td>`).join("")}</tr>`).join("");
    $("#fan-table").innerHTML = head + `<tbody>${body}</tbody>`;
  }
  function fantasyMatchups(weekly, s, scLabel) {
    const pos = state.fanPos === "FLEX" ? "FLEX" : state.fanPos;
    const posOf = FAN_POS_MATCH[pos];
    const allow = {}, weeksSeen = {};
    state.data.players.filter(posOf).forEach((p) => {
      const w = weekly[p.id]; if (!w) return;
      w.wk.forEach((wk, i) => { const opp = w.opp ? w.opp[i] : ""; if (!opp || !state.meta.teams[opp]) return; allow[opp] = (allow[opp] || 0) + fanWeekPts(w, i, s); (weeksSeen[opp] = weeksSeen[opp] || new Set()).add(wk); });
    });
    const rows = Object.keys(allow).map((t) => ({ team: t, ppg: allow[t] / (weeksSeen[t] ? weeksSeen[t].size : 1) })).sort((a, b) => b.ppg - a.ppg);
    $("#fan-hint").textContent = `Fantasy points allowed to ${pos} per game · ${state.season} · ${scLabel} · higher = easier matchup`;
    const bar = rows.slice().reverse();
    ec("fan-chart").setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-fantasy-matchups-${pos}-${state.fanScoring}-${state.season}`),
      grid: { left: 54, right: 56, top: 26, bottom: 20 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (ps) => `${teamMeta(ps[0].name).name}<br/>${ps[0].value.toFixed(1)} ${pos} pts/game allowed` },
      xAxis: { ...axisCommon(), type: "value" },
      yAxis: { type: "category", data: bar.map((r) => r.team), axisLine: { lineStyle: { color: LINE } }, axisLabel: { color: TEXT, fontSize: 10 } },
      series: [{ type: "bar", data: bar.map((r) => ({ value: +r.ppg.toFixed(1), name: r.team, itemStyle: { color: color(r.team), borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: "right", color: AXIS, formatter: (o) => o.value.toFixed(1) }, barMaxWidth: 13 }],
    }, true);
    const head = `<thead><tr><th class="rank">#</th><th>Defense</th><th>${pos} pts/game allowed</th></tr></thead>`;
    const body = rows.map((r, i) => `<tr data-team="${r.team}"><td class="rank">${i + 1}</td><td class="pname ct-cell"><img class="ct-logo" src="${logo(r.team)}" alt=""/>${teamMeta(r.team).name}</td><td>${r.ppg.toFixed(1)}</td></tr>`).join("");
    $("#fan-table").innerHTML = head + `<tbody>${body}</tbody>`;
  }
  function onFanSort(e) {
    const th = e.target.closest("th.sortable");
    if (th) { const k = th.dataset.k, cur = state.fanSort; const hi = !["bust", "sd"].includes(k); state.fanSort = (cur && cur.key === k) ? { key: k, dir: -cur.dir } : { key: k, dir: hi ? -1 : 1 }; renderFantasy(); return; }
    const tr = e.target.closest("tbody tr");
    if (tr && tr.dataset.id) { const pl = findPlayer(tr.dataset.id); if (pl) go(`#/player/${encodeURIComponent(pl.id)}${seasonSuffix()}`); }
    else if (tr && tr.dataset.team) go(`#/team/${tr.dataset.team}${seasonSuffix()}`);
  }
  const color2 = (a) => `rgba(77,163,255,${a})`;

  const CPROFILE = {
    QB: ["pyd", "ptd", "int", "cmp_pct", "ypa", "games"],
    RB: ["ryd", "rtd", "ypc", "car", "games"],
    WR: ["recyd", "rectd", "rec", "ypr", "catch_pct", "games"],
    TE: ["recyd", "rectd", "rec", "ypr", "catch_pct", "games"],
  };
  async function showCollegePlayerPage(id) {
    await ensureCollege();
    const p = findCollege(id);
    state.profileEntity = p ? { type: "cplayer", id } : null;
    state.prevTab = "college";
    // college profile reuses the profile view but only the radar chart
    $("#prof-compare-ctl").hidden = true; $("#prof-save").style.display = "none";
    $("#prof-log-ctl").style.display = "none"; $("#prof-chart2-wrap").style.display = "none"; $("#prof-field-section").hidden = true; $("#prof-career-section").hidden = true;
    if (!p) { $("#profile-body").innerHTML = `<p class="hint" style="padding:20px">Player not found for ${state.season}.</p>`; $(".prof-grid").style.display = "none"; activate("profile", null); return; }
    $(".prof-grid").style.display = ""; $("#prof-chart1").style.display = "none";
    const b = bucket(p.pos), t = cteam(p.team);
    const peers = state.college[state.season].players.filter((x) => bucket(x.pos) === b);
    const keys = CPROFILE[b] || CPROFILE.WR;
    const rows = keys.map((k) => { const s = CSTAT[k]; const v = pval(p, s); return statRow(s.l, pfmt(v, s), v == null ? null : rankPct(peers.map((x) => pval(x, s)), v, s.hi)); }).join("");
    const face = p.face ? `<img class="headshot" src="${p.face}" alt="" onerror="this.style.visibility='hidden'"/>` : `<div class="headshot"></div>`;
    const badge = t.logo ? `<img class="logo-badge" src="${t.logo}" alt=""/>` : "";
    // college -> NFL link (name match against the LATEST NFL season)
    const nfl = (await nflNameMap())[p.player];
    const nflLink = nfl ? `<a class="prof-btn" style="display:block;text-align:center;text-decoration:none;margin-top:14px" href="#/player/${encodeURIComponent(nfl.id || nfl.player)}">Now in the NFL — view ${p.player}'s ${state.meta.latest} NFL profile →</a>` : "";
    $("#profile-body").innerHTML = `<div class="prof-head"><div class="prof-face">${face}${badge}</div><div class="prof-title"><h3>${p.player}</h3><div class="meta">${p.pos || ""} · ${p.team || ""} · ${p.conf || ""} ${p.class ? "· " + p.class : ""} · ${p.games || 0} games · ${state.season} college</div></div></div><div class="prof-section-t">Season stats · rank vs ${b === "QB" ? "QBs" : b === "RB" ? "RBs" : b === "TE" ? "TEs" : "WRs"} (college)</div><div class="stat-rows">${rows}</div>${nflLink}`;
    activate("profile", null);
    radarChart("prof-radar", [{ name: p.player, color: t.color, vals: keys.filter((k) => k !== "games").map((k) => Math.round((rankPct(peers.map((x) => pval(x, CSTAT[k])), pval(p, CSTAT[k]), CSTAT[k].hi) || { pct: 0 }).pct * 100)) }], keys.filter((k) => k !== "games").map((k) => CSTAT[k].l), "Percentile vs position (college)");
  }

  // ---- Search -------------------------------------------------------------
  function buildSearchIndex() {
    const idx = {}, opts = [];
    Object.keys(state.meta.teams).forEach((a) => { const label = `${teamMeta(a).name} — Team`; idx[label.toLowerCase()] = { type: "team", id: a }; idx[a.toLowerCase()] = { type: "team", id: a }; opts.push(label); });
    const seen = new Set();
    state.data.players.forEach((p) => { if (!p.player || seen.has(p.player)) return; seen.add(p.player); const label = `${p.player} — ${p.pos || ""} ${p.team || ""}`.trim(); idx[label.toLowerCase()] = { type: "player", id: p.id || p.player }; idx[p.player.toLowerCase()] = { type: "player", id: p.id || p.player }; opts.push(label); });
    state.searchIndex = idx;
    $("#search-options").innerHTML = opts.map((o) => `<option value="${o.replace(/"/g, "&quot;")}"></option>`).join("");
  }
  function onSearch(e) {
    const q = (e.target.value || "").trim().toLowerCase(); if (!q) return;
    const hit = state.searchIndex[q] || Object.entries(state.searchIndex).find(([k]) => k.startsWith(q) || k.includes(q));
    const m = Array.isArray(hit) ? hit[1] : hit; if (!m) return;
    $("#search-clear").hidden = false;
    go(`#/${m.type}/${encodeURIComponent(m.id)}${seasonSuffix()}`);
  }
  function clearSearch() { $("#global-search").value = ""; $("#search-clear").hidden = true; }

  // ---- Profiles (full page) ----------------------------------------------
  const bucket = (pos) => pos === "QB" ? "QB" : (pos === "RB" || pos === "FB") ? "RB" : pos === "TE" ? "TE" : pos === "K" ? "K" : DEF_POS.has(pos) ? "DEF" : "WR";
  const PROFILE_PLAYER = {
    QB: ["passing_yards", "passing_tds", "passing_interceptions", "passing_epa", "cmp_pct", "ypa", "passing_cpoe", "fppg"],
    RB: ["rushing_yards", "rushing_tds", "ypc", "rushing_epa", "yds_scrim", "touches", "receptions", "fppg"],
    WR: ["receiving_yards", "receptions", "receiving_tds", "receiving_epa", "ypr", "target_share", "catch_pct", "fppg"],
    TE: ["receiving_yards", "receptions", "receiving_tds", "receiving_epa", "ypr", "target_share", "catch_pct", "fppg"],
    DEF: ["def_sacks", "tackles", "def_tackles_for_loss", "def_qb_hits", "def_interceptions", "def_pass_defended", "def_fumbles_forced", "def_tds"],
    K: ["fg_made", "fg_pct", "fg_50plus", "fg_long", "pat_made", "games"],
  };
  const PROFILE_TEAM = ["off_epa", "def_epa", "net_epa", "ppg", "papg", "pd", "ypp", "first_downs"];
  // Compare radars blend core production with Next Gen Stats.
  const COMPARE_PLAYER = {
    QB: ["passing_yards", "passing_tds", "passing_epa", "cmp_pct", "ypa", "ngs_cpoe", "ngs_agg", "ngs_ttt", "ngs_rating"],
    RB: ["rushing_yards", "rushing_tds", "ypc", "rushing_epa", "yds_scrim", "ngs_ryoe", "ngs_ryoe_att", "ngs_eff", "ngs_stacked"],
    WR: ["receiving_yards", "receptions", "receiving_tds", "receiving_epa", "ypr", "ngs_sep", "ngs_cush", "ngs_yacoe", "ngs_airshare"],
    TE: ["receiving_yards", "receptions", "receiving_tds", "receiving_epa", "ypr", "ngs_sep", "ngs_cush", "ngs_yacoe", "ngs_airshare"],
  };
  const PROFILE_ADV = {
    QB: ["snap_pct", "ngs_cpoe", "ngs_ttt", "ngs_agg", "ngs_ayts", "ngs_rating"],
    RB: ["snap_pct", "ngs_ryoe", "ngs_ryoe_att", "ngs_eff", "ngs_ttl", "ngs_stacked"],
    WR: ["snap_pct", "ngs_sep", "ngs_cush", "ngs_yacoe", "ngs_airshare", "ngs_tay"],
    TE: ["snap_pct", "ngs_sep", "ngs_cush", "ngs_yacoe", "ngs_airshare", "ngs_tay"],
  };
  const GAMELOG_OFF = [["Passing yards", "passing_yards"], ["Rushing yards", "rushing_yards"], ["Receiving yards", "receiving_yards"], ["Receptions", "receptions"], ["Total TDs", "__td"], ["Fantasy PPR", "fantasy_points_ppr"]];
  const GAMELOG_SETS = {
    DEF: [["Tackles", "__tackles"], ["Sacks", "def_sacks"], ["Tackles for loss", "def_tackles_for_loss"], ["QB hits", "def_qb_hits"], ["Interceptions", "def_interceptions"]],
    K: [["FG made", "fg_made"], ["FG attempts", "fg_att"], ["XP made", "pat_made"]],
  };
  const gamelogFor = (b) => GAMELOG_SETS[b] || GAMELOG_OFF;
  const WEEKLY_SUM_KEYS = ["completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions", "passing_epa", "passing_air_yards", "passing_first_downs", "sacks_suffered", "carries", "rushing_yards", "rushing_tds", "rushing_epa", "rushing_first_downs", "targets", "receptions", "receiving_yards", "receiving_tds", "receiving_epa", "receiving_first_downs", "receiving_air_yards", "receiving_yards_after_catch", "fantasy_points", "fantasy_points_ppr", "def_tackles_solo", "def_tackle_assists", "def_sacks", "def_qb_hits", "def_tackles_for_loss", "def_interceptions", "def_pass_defended", "def_fumbles_forced", "fg_made", "fg_att", "pat_made"];
  const WEEKLY_AVG_KEYS = ["passing_cpoe", "target_share", "air_yards_share", "wopr", "racr"];
  const NGS_KEYS = ["snap_pct", "ngs_ttt", "ngs_iay", "ngs_agg", "ngs_cpoe", "ngs_ayts", "ngs_rating", "ngs_xcomp", "ngs_sep", "ngs_cush", "ngs_yacoe", "ngs_airshare", "ngs_tay", "ngs_ryoe", "ngs_ryoe_att", "ngs_eff", "ngs_ttl", "ngs_stacked", "ngs_rpoe"];

  function rankPct(values, val, hi) { const arr = values.filter((v) => v != null); const n = arr.length; if (!n) return null; const rank = 1 + arr.filter((v) => hi ? v > val : v < val).length; return { rank, n, pct: n > 1 ? (n - rank) / (n - 1) : 1 }; }
  const barColor = (pct) => pct >= 0.5 ? "#2a9d8f" : pct >= 0.25 ? "#e6c86e" : "#d1493f";
  function statRow(label, valTxt, rp) { const pct = rp ? Math.round(rp.pct * 100) : 0; const rk = rp ? `<span class="sr-rank">#${rp.rank}/${rp.n}</span>` : ""; return `<div class="stat-row"><span class="sr-label">${label}</span><span class="sr-bar"><span class="sr-fill" style="width:${pct}%;background:${barColor(rp ? rp.pct : 0)}"></span></span><span class="sr-val">${valTxt} ${rk}</span></div>`; }
  function playerPeers(p) { const b = bucket(p.pos); return state.data.players.filter((x) => bucket(x.pos) === b && (qualified(x) || x.id === p.id)); }

  function resetProfileChrome() { $("#prof-save").style.display = ""; $("#prof-chart1").style.display = ""; $("#prof-compare-ctl").hidden = false; }
  async function showPlayerPage(idOrName) {
    resetProfileChrome();
    const p = findPlayer(idOrName);
    state.profileEntity = p ? { type: "player", id: p.id || p.player } : null;
    if (!p) { $("#profile-body").innerHTML = '<p class="hint" style="padding:20px">This player isn’t in the ' + state.season + " data.</p>"; $(".prof-grid").style.display = "none"; activate("profile", null); return; }
    $(".prof-grid").style.display = "";
    const b = bucket(p.pos), peers = playerPeers(p), keys = PROFILE_PLAYER[b] || PROFILE_PLAYER.WR;
    const bar = (k) => { const s = PSTAT[k]; const v = pval(p, s); return statRow(s.l, pfmt(v, s), v == null ? null : rankPct(peers.map((x) => pval(x, s)), v, s.hi)); };
    const rows = keys.map(bar).join("");
    const advKeys = PROFILE_ADV[b] || [];
    const advPresent = advKeys.some((k) => pval(p, PSTAT[k]) != null);
    const advHtml = advPresent ? `<div class="prof-section-t">Advanced · Next Gen Stats</div><div class="stat-rows">${advKeys.map(bar).join("")}</div>` : "";
    const face = p.face ? `<img class="headshot" src="${p.face}" alt="" onerror="this.style.visibility='hidden'"/>` : `<div class="headshot"></div>`;
    $("#profile-body").innerHTML = `<div class="prof-head"><div class="prof-face">${face}<img class="logo-badge" src="${logo(p.team)}" alt=""/></div><div class="prof-title"><h3>${p.player}</h3><div class="meta">${p.pos || ""} · ${teamMeta(p.team).name} · ${p.games || 0} games · ${state.season}</div></div></div><div class="prof-section-t">Season stats · rank vs qualified ${{ QB: "QBs", RB: "RBs", TE: "TEs", DEF: "defenders", K: "kickers" }[b] || "WRs"}</div><div class="stat-rows">${rows}</div>${advHtml}`;
    // compare-with options: same-bucket players
    const opts = state.data.players.filter((x) => bucket(x.pos) === b && x.player !== p.player).sort((a, c) => a.player.localeCompare(c.player));
    $("#prof-compare").innerHTML = `<option value="">Compare with…</option>` + opts.map((x) => `<option value="${x.id || x.player}">${x.player}</option>`).join("");
    $("#prof-compare-ctl").hidden = false;
    // charts
    $("#prof-log-ctl").style.display = ""; $("#prof-chart2-wrap").style.display = "none";
    const glset = gamelogFor(b);
    $("#prof-log-stat").innerHTML = glset.map(([l, k]) => `<option value="${k}">${l}</option>`).join("");
    state.logStat = glset[0][1]; $("#prof-log-stat").value = state.logStat;
    activate("profile", null);
    radarChart("prof-radar", [{ name: p.player, color: color(p.team), vals: keys.map((k) => Math.round((rankPct(peers.map((x) => pval(x, PSTAT[k])), pval(p, PSTAT[k]), PSTAT[k].hi) || { pct: 0 }).pct * 100)) }], keys.map((k) => PSTAT[k].l), "Percentile vs position");
    await ensureWeekly(); renderGameLog(p);
    renderField(p);
    renderCareer(p);
  }
  const CAREER_TREND = {
    QB: [["Passing yards", "passing_yards"], ["Passing TDs", "passing_tds"], ["Passing EPA", "passing_epa"], ["Fantasy PPR", "fantasy_points_ppr"]],
    RB: [["Rushing yards", "rushing_yards"], ["Rushing TDs", "rushing_tds"], ["Rushing EPA", "rushing_epa"], ["Fantasy PPR", "fantasy_points_ppr"]],
    WR: [["Receiving yards", "receiving_yards"], ["Receptions", "receptions"], ["Receiving TDs", "receiving_tds"], ["Receiving EPA", "receiving_epa"], ["Targets", "targets"], ["Fantasy PPR", "fantasy_points_ppr"]],
    TE: [["Receiving yards", "receiving_yards"], ["Receptions", "receptions"], ["Receiving TDs", "receiving_tds"], ["Receiving EPA", "receiving_epa"], ["Targets", "targets"], ["Fantasy PPR", "fantasy_points_ppr"]],
    DEF: [["Sacks", "def_sacks"], ["Tackles", "__tackles"], ["Interceptions", "def_interceptions"]],
    K: [["FG made", "fg_made"], ["FG attempts", "fg_att"]],
  };
  const careerVal = (sd, k) => k === "__tackles" ? (sd.def_tackles_solo || 0) + (sd.def_tackle_assists || 0) : (sd[k] == null ? null : sd[k]);
  async function renderCareer(p) {
    const sec = $("#prof-career-section");
    const careers = await ensureCareers();
    const c = careers[p.id];
    if (!c || Object.keys(c.s).length < 2) { sec.hidden = true; return; }
    sec.hidden = false;
    const trend = CAREER_TREND[bucket(p.pos)] || CAREER_TREND.WR;
    $("#prof-career-stat").innerHTML = trend.map(([l, k]) => `<option value="${k}">${l}</option>`).join("");
    if (!trend.find((t) => t[1] === state.careerStat)) state.careerStat = trend[0][1];
    $("#prof-career-stat").value = state.careerStat;
    drawCareer(p, c);
  }
  function drawCareer(p, c) {
    const seasons = Object.keys(c.s).sort();
    const trend = CAREER_TREND[bucket(p.pos)] || CAREER_TREND.WR;
    const label = (trend.find((t) => t[1] === state.careerStat) || trend[0])[0];
    const vals = seasons.map((s) => careerVal(c.s[s], state.careerStat));
    ec("prof-career").setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-${p.player}-career-${state.careerStat}`),
      title: { text: `${label} by season`, left: 8, top: 4, textStyle: { color: TEXT, fontSize: 13, fontWeight: 600 } },
      grid: { left: 48, right: 20, top: 40, bottom: 28 },
      tooltip: { trigger: "axis", backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT } },
      xAxis: { ...axisCommon(), type: "category", data: seasons },
      yAxis: { ...axisCommon(), type: "value" },
      series: [{ type: "bar", data: vals, itemStyle: { color: color(p.team), borderRadius: [4, 4, 0, 0] }, barMaxWidth: 60, label: { show: true, position: "top", color: AXIS, formatter: (o) => o.value == null ? "" : (+o.value).toLocaleString() } }],
    }, true);
  }
  const weeklyVals = (log, stat) => stat === "__td"
    ? (log.wk || []).map((_, i) => (log.passing_tds ? log.passing_tds[i] || 0 : 0) + (log.rushing_tds ? log.rushing_tds[i] || 0 : 0) + (log.receiving_tds ? log.receiving_tds[i] || 0 : 0))
    : stat === "__tackles"
    ? (log.wk || []).map((_, i) => (log.def_tackles_solo ? log.def_tackles_solo[i] || 0 : 0) + (log.def_tackle_assists ? log.def_tackle_assists[i] || 0 : 0))
    : (log[stat] || []);
  function renderGameLog(p) {
    const log = (((state.weekly[state.season] || {}).players) || {})[p.id];
    const stat = state.logStat, label = (gamelogFor(bucket(p.pos)).find(([, k]) => k === stat) || [])[0] || "";
    const wk = log ? log.wk : [], vals = log ? weeklyVals(log, stat) : [];
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    ec("prof-chart1").setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-${p.player}-gamelog-${stat}-${state.season}`),
      title: { text: "Weekly game log · " + label, left: 8, top: 4, textStyle: { color: TEXT, fontSize: 13, fontWeight: 600 } }, grid: { left: 40, right: 18, top: 40, bottom: 28 },
      tooltip: { trigger: "axis", backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (ps) => `Week ${ps[0].axisValue}<br/>${label}: ${ps[0].value}` },
      xAxis: { ...axisCommon(), type: "category", data: wk.map((w) => "W" + w) }, yAxis: { ...axisCommon(), type: "value" },
      series: [{ type: "bar", data: vals, itemStyle: { color: color(p.team), borderRadius: [3, 3, 0, 0] }, barMaxWidth: 26, markLine: { silent: true, symbol: "none", data: [{ yAxis: +avg.toFixed(1), name: "avg" }], lineStyle: { color: AXIS, type: "dashed" }, label: { color: AXIS, formatter: "avg " + avg.toFixed(1) } } }],
    }, true);
    if (!log) ec("prof-chart1").setOption({ title: { subtext: "No weekly data", left: "center", top: "middle", subtextStyle: { color: AXIS } } });
  }

  // ---- Field map (SVG heatmap on a schematic field) -----------------------
  const hexA = (hex, a) => { const n = hex.replace("#", ""); const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16); return `rgba(${r},${g},${b},${a})`; };
  const DEPTHS = ["Behind LOS", "0–9 (short)", "10–19 (mid)", "20+ (deep)"];
  const DIRS = ["Left", "Middle", "Right"];
  const RUSH_GAPS = ["LE", "LT", "LG", "MID", "RG", "RT", "RE"];

  async function renderField(p) {
    const sec = $("#prof-field-section");
    const fd = (await ensureField()).players[p.id];
    if (!fd || !(fd.pass || fd.tgt || fd.rush)) { sec.hidden = true; sec.innerHTML = ""; return; }
    sec.hidden = false;
    const b = bucket(p.pos), maps = [];
    if (fd.pass) maps.push(["Pass locations", "pass"]);
    if (fd.tgt) maps.push(["Target map", "tgt"]);
    if (fd.rush) maps.push(["Rush gaps", "rush"]);
    let def = b === "QB" ? "pass" : b === "RB" ? "rush" : "tgt";
    if (!maps.find((m) => m[1] === def)) def = maps[0][1];
    if (!maps.find((m) => m[1] === state.fieldMap)) state.fieldMap = def;
    const fm = state.fieldMap, last = p.player.split(" ").slice(-1)[0];
    const verb = fm === "rush" ? "runs" : fm === "pass" ? "throws" : "is targeted";
    const toggle = maps.length > 1 ? `<div class="segmented" id="field-toggle">${maps.map(([l, k]) => `<button class="seg ${k === fm ? "active" : ""}" data-fm="${k}">${l}</button>`).join("")}</div>` : "";
    const svg = fm === "rush" ? rushSVG(fd.rush, color(p.team)) : gridSVG(fd[fm], color(p.team), fm);
    sec.innerHTML = `<div class="view-head"><div class="fieldbar"><h2>Field map</h2>${toggle}</div><p class="hint">Where ${last} ${verb} · darker = more volume · regular season</p></div><div class="chart-wrap field-holder">${svg}</div>`;
    sec.querySelectorAll("#field-toggle .seg").forEach((bt) => bt.addEventListener("click", () => { state.fieldMap = bt.dataset.fm; renderField(p); }));
  }

  function gridSVG(grid, tc, mode) {
    const W = 360, H = 430, padX = 54, padTop = 16, padBot = 34;
    const cols = 3, rows = 4, gw = (W - padX - 14) / cols, gh = (H - padTop - padBot) / rows;
    const maxN = Math.max(1, ...grid.map((c) => c[0]));
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" font-family="-apple-system,Segoe UI,Roboto,sans-serif">`;
    s += `<rect x="${padX}" y="${padTop}" width="${gw * cols}" height="${gh * rows}" fill="${hexA(tc, 0.04)}" stroke="${LINE}"/>`;
    for (let d = 0; d < rows; d++) {
      const rowTop = padTop + (rows - 1 - d) * gh; // deep at top, behind at bottom
      s += `<text x="${padX - 6}" y="${rowTop + gh / 2 + 3}" text-anchor="end" font-size="9" fill="${AXIS}">${DEPTHS[d].split(" ")[0]}</text>`;
      for (let dir = 0; dir < cols; dir++) {
        const cell = grid[dir * 4 + d], n = cell[0], made = cell[1], yds = cell[2];
        const x = padX + dir * gw, alpha = 0.12 + 0.78 * (n / maxN);
        s += `<rect x="${x + 1}" y="${rowTop + 1}" width="${gw - 2}" height="${gh - 2}" rx="3" fill="${n ? hexA(tc, alpha) : "transparent"}" stroke="${LINE}" stroke-width="0.5"/>`;
        if (n) {
          s += `<text x="${x + gw / 2}" y="${rowTop + gh / 2}" text-anchor="middle" font-size="15" font-weight="700" fill="${TEXT}">${n}</text>`;
          const sub = mode === "pass" || mode === "tgt" ? `${made}/${n} · ${yds}y` : `${yds}y`;
          s += `<text x="${x + gw / 2}" y="${rowTop + gh / 2 + 15}" text-anchor="middle" font-size="9" fill="${AXIS}">${sub}</text>`;
        }
      }
    }
    // LOS line (between behind row and short row)
    const losY = padTop + (rows - 1) * gh;
    s += `<line x1="${padX - 4}" y1="${losY}" x2="${padX + gw * cols + 4}" y2="${losY}" stroke="${tc}" stroke-width="2"/>`;
    s += `<text x="${padX - 8}" y="${losY - 3}" text-anchor="end" font-size="8" fill="${tc}">LOS</text>`;
    for (let dir = 0; dir < cols; dir++) s += `<text x="${padX + dir * gw + gw / 2}" y="${H - 12}" text-anchor="middle" font-size="10" fill="${AXIS}">${DIRS[dir]}</text>`;
    return s + "</svg>";
  }

  function rushSVG(grid, tc) {
    const W = 360, H = 240, padX = 16, padTop = 40, zw = (W - 2 * padX) / 7, zh = 120;
    const maxN = Math.max(1, ...grid.map((c) => c[0]));
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" font-family="-apple-system,Segoe UI,Roboto,sans-serif">`;
    s += `<text x="${W / 2}" y="20" text-anchor="middle" font-size="10" fill="${AXIS}">↑ downfield</text>`;
    for (let i = 0; i < 7; i++) {
      const cell = grid[i], n = cell[0], yds = cell[1], x = padX + i * zw, alpha = 0.12 + 0.78 * (n / maxN);
      s += `<rect x="${x + 1}" y="${padTop + 1}" width="${zw - 2}" height="${zh - 2}" rx="3" fill="${n ? hexA(tc, alpha) : "transparent"}" stroke="${LINE}" stroke-width="0.5"/>`;
      if (n) {
        s += `<text x="${x + zw / 2}" y="${padTop + zh / 2 - 2}" text-anchor="middle" font-size="15" font-weight="700" fill="${TEXT}">${n}</text>`;
        s += `<text x="${x + zw / 2}" y="${padTop + zh / 2 + 15}" text-anchor="middle" font-size="9" fill="${AXIS}">${n ? (yds / n).toFixed(1) : 0}y/c</text>`;
      }
      s += `<text x="${x + zw / 2}" y="${padTop + zh + 16}" text-anchor="middle" font-size="10" fill="${AXIS}">${RUSH_GAPS[i]}</text>`;
    }
    const losY = padTop + zh;
    s += `<line x1="${padX - 2}" y1="${losY}" x2="${W - padX + 2}" y2="${losY}" stroke="${tc}" stroke-width="2"/>`;
    s += `<text x="${padX}" y="${losY + 30}" font-size="9" fill="${tc}">Line of scrimmage · gaps left→right (offense view)</text>`;
    return s + "</svg>";
  }

  const DEF_COLOR = "#d1493f"; // yards allowed heat
  async function renderTeamDefField(abbr) {
    const sec = $("#prof-field-section");
    const fd = (await ensureField()).teams[abbr];
    if (!fd || !(fd.pass || fd.rush)) { sec.hidden = true; sec.innerHTML = ""; return; }
    sec.hidden = false;
    const maps = [];
    if (fd.pass) maps.push(["Pass defense", "pass"]);
    if (fd.rush) maps.push(["Rush defense", "rush"]);
    let m = ["pass", "rush"].includes(state.fieldMap) ? state.fieldMap : "pass";
    if (!maps.find((x) => x[1] === m)) m = maps[0][1];
    state.fieldMap = m;
    const toggle = maps.length > 1 ? `<div class="segmented" id="field-toggle">${maps.map(([l, k]) => `<button class="seg ${k === m ? "active" : ""}" data-fm="${k}">${l}</button>`).join("")}</div>` : "";
    const svg = m === "rush" ? defRushSVG(fd.rush) : defGridSVG(fd.pass);
    sec.innerHTML = `<div class="view-head"><div class="fieldbar"><h2>Defense field map</h2>${toggle}</div><p class="hint">Where opponents attack ${teamMeta(abbr).name} · darker = more yards allowed · regular season</p></div><div class="chart-wrap field-holder">${svg}</div>`;
    sec.querySelectorAll("#field-toggle .seg").forEach((b) => b.addEventListener("click", () => { state.fieldMap = b.dataset.fm; renderTeamDefField(abbr); }));
  }
  function defGridSVG(grid) {
    const W = 360, H = 430, padX = 54, padTop = 16, padBot = 34, cols = 3, rows = 4;
    const gw = (W - padX - 14) / cols, gh = (H - padTop - padBot) / rows;
    const maxY = Math.max(1, ...grid.map((c) => c[2]));
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" font-family="-apple-system,Segoe UI,Roboto,sans-serif">`;
    s += `<rect x="${padX}" y="${padTop}" width="${gw * cols}" height="${gh * rows}" fill="${hexA(DEF_COLOR, 0.04)}" stroke="${LINE}"/>`;
    for (let d = 0; d < rows; d++) {
      const rowTop = padTop + (rows - 1 - d) * gh;
      s += `<text x="${padX - 6}" y="${rowTop + gh / 2 + 3}" text-anchor="end" font-size="9" fill="${AXIS}">${DEPTHS[d].split(" ")[0]}</text>`;
      for (let dir = 0; dir < cols; dir++) {
        const cell = grid[dir * 4 + d], tgt = cell[0], yds = cell[2], x = padX + dir * gw, alpha = 0.12 + 0.78 * (yds / maxY);
        s += `<rect x="${x + 1}" y="${rowTop + 1}" width="${gw - 2}" height="${gh - 2}" rx="3" fill="${tgt ? hexA(DEF_COLOR, alpha) : "transparent"}" stroke="${LINE}" stroke-width="0.5"/>`;
        if (tgt) {
          s += `<text x="${x + gw / 2}" y="${rowTop + gh / 2}" text-anchor="middle" font-size="15" font-weight="700" fill="${TEXT}">${yds}</text>`;
          s += `<text x="${x + gw / 2}" y="${rowTop + gh / 2 + 15}" text-anchor="middle" font-size="9" fill="${AXIS}">${cell[1]}/${tgt} · ${yds}y</text>`;
        }
      }
    }
    const losY = padTop + (rows - 1) * gh;
    s += `<line x1="${padX - 4}" y1="${losY}" x2="${padX + gw * cols + 4}" y2="${losY}" stroke="${DEF_COLOR}" stroke-width="2"/>`;
    s += `<text x="${padX - 8}" y="${losY - 3}" text-anchor="end" font-size="8" fill="${DEF_COLOR}">LOS</text>`;
    for (let dir = 0; dir < cols; dir++) s += `<text x="${padX + dir * gw + gw / 2}" y="${H - 12}" text-anchor="middle" font-size="10" fill="${AXIS}">${DIRS[dir]}</text>`;
    return s + "</svg>";
  }
  function defRushSVG(grid) {
    const W = 360, H = 240, padX = 16, padTop = 40, zw = (W - 2 * padX) / 7, zh = 120;
    const maxY = Math.max(1, ...grid.map((c) => c[1]));
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" font-family="-apple-system,Segoe UI,Roboto,sans-serif">`;
    s += `<text x="${W / 2}" y="20" text-anchor="middle" font-size="10" fill="${AXIS}">↑ downfield</text>`;
    for (let i = 0; i < 7; i++) {
      const cell = grid[i], car = cell[0], yds = cell[1], x = padX + i * zw, alpha = 0.12 + 0.78 * (yds / maxY);
      s += `<rect x="${x + 1}" y="${padTop + 1}" width="${zw - 2}" height="${zh - 2}" rx="3" fill="${car ? hexA(DEF_COLOR, alpha) : "transparent"}" stroke="${LINE}" stroke-width="0.5"/>`;
      if (car) {
        s += `<text x="${x + zw / 2}" y="${padTop + zh / 2 - 2}" text-anchor="middle" font-size="15" font-weight="700" fill="${TEXT}">${yds}</text>`;
        s += `<text x="${x + zw / 2}" y="${padTop + zh / 2 + 15}" text-anchor="middle" font-size="9" fill="${AXIS}">${car} car · ${(yds / car).toFixed(1)}/c</text>`;
      }
      s += `<text x="${x + zw / 2}" y="${padTop + zh + 16}" text-anchor="middle" font-size="10" fill="${AXIS}">${RUSH_GAPS[i]}</text>`;
    }
    const losY = padTop + zh;
    s += `<line x1="${padX - 2}" y1="${losY}" x2="${W - padX + 2}" y2="${losY}" stroke="${DEF_COLOR}" stroke-width="2"/>`;
    s += `<text x="${padX}" y="${losY + 30}" font-size="9" fill="${DEF_COLOR}">Line of scrimmage · yards allowed by gap</text>`;
    return s + "</svg>";
  }

  function showTeamPage(abbr) {
    resetProfileChrome(); $("#prof-career-section").hidden = true;
    const t = state.data.teams.find((x) => x.team === abbr);
    state.profileEntity = t ? { type: "team", id: abbr } : null;
    if (!t) { $("#profile-body").innerHTML = '<p class="hint" style="padding:20px">No data for this team.</p>'; activate("profile", null); return; }
    $(".prof-grid").style.display = "";
    const teams = state.data.teams;
    const rows = PROFILE_TEAM.map((k) => { const s = TSTAT[k]; const v = pval(t, s); return statRow(s.l, pfmt(v, s), v == null ? null : rankPct(teams.map((x) => pval(x, s)), v, s.hi)); }).join("");
    const st = state.data.standings; let divRank = "";
    for (const d of Object.keys(st)) { const i = st[d].findIndex((r) => r.team === abbr); if (i >= 0) divRank = `${i + 1}${["st", "nd", "rd", "th"][Math.min(i, 3)]} in ${d}`; }
    const rec = t.w != null ? `${t.w}-${t.l}${t.t ? "-" + t.t : ""}` : "";
    const tops = state.data.players.filter((x) => x.team === abbr).map((x) => ({ x, v: pval(x, PSTAT.fantasy_points_ppr) || 0 })).sort((a, b) => b.v - a.v).slice(0, 5);
    const topHtml = tops.map(({ x }) => `<div class="pp-row" data-player="${x.id || x.player}"><img src="${x.face || ""}" alt="" onerror="this.style.visibility='hidden'"/><div><div class="pp-name">${x.player}</div><div class="pp-sub">${x.pos || ""}</div></div><div class="pp-stat">${pfmt(pval(x, PSTAT.fantasy_points_ppr), PSTAT.fantasy_points_ppr)} PPR</div></div>`).join("");
    $("#profile-body").innerHTML = `<div class="prof-head"><img class="prof-logo" src="${logo(abbr)}" alt=""/><div class="prof-title"><h3>${teamMeta(abbr).name}</h3><div class="meta"><span class="rec">${rec}</span> · ${divRank} · ${state.season}</div></div></div><div class="prof-section-t">Team stats · rank across the NFL</div><div class="stat-rows">${rows}</div><div class="prof-section-t">Top players (fantasy PPR)</div><div class="prof-players">${topHtml}</div>`;
    $("#profile-body").querySelectorAll(".pp-row").forEach((r) => r.addEventListener("click", () => go(`#/player/${encodeURIComponent(r.dataset.player)}${seasonSuffix()}`)));
    const opts = teams.map((x) => x.team).filter((a) => a !== abbr).sort((a, c) => teamMeta(a).name.localeCompare(teamMeta(c).name));
    $("#prof-compare").innerHTML = `<option value="">Compare with…</option>` + opts.map((a) => `<option value="${a}">${teamMeta(a).name}</option>`).join("");
    $("#prof-compare-ctl").hidden = false;
    $("#prof-log-ctl").style.display = "none"; $("#prof-chart2-wrap").style.display = "";
    activate("profile", null);
    radarChart("prof-radar", [{ name: teamMeta(abbr).name, color: color(abbr), vals: PROFILE_TEAM.map((k) => Math.round((rankPct(teams.map((x) => pval(x, TSTAT[k])), pval(t, TSTAT[k]), TSTAT[k].hi) || { pct: 0 }).pct * 100)) }], PROFILE_TEAM.map((k) => TSTAT[k].l), "Percentile vs NFL");
    trendPd("prof-chart1", abbr, `nfl-${abbr}-pointdiff-${state.season}`);
    trendEpa("prof-chart2", abbr, `nfl-${abbr}-epa-${state.season}`);
    renderTeamDefField(abbr);
  }

  function radarChart(elId, seriesData, indicatorLabels, subtext) {
    ec(elId).setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-${(state.profileEntity && state.profileEntity.id) || "radar"}-percentiles-${state.season}`),
      title: { text: "Percentile profile", subtext: subtext, left: 8, top: 4, textStyle: { color: TEXT, fontSize: 13, fontWeight: 600 }, subtextStyle: { color: AXIS, fontSize: 11 } },
      legend: seriesData.length > 1 ? { top: 6, right: 10, textStyle: { color: AXIS } } : { show: false },
      tooltip: { backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT } },
      radar: { indicator: indicatorLabels.map((l) => ({ name: l, max: 100 })), radius: "62%", center: ["50%", "56%"], axisName: { color: AXIS, fontSize: 10 }, splitLine: { lineStyle: { color: LINE } }, splitArea: { show: false }, axisLine: { lineStyle: { color: LINE } } },
      series: [{ type: "radar", data: seriesData.map((s) => ({ value: s.vals, name: s.name, areaStyle: { color: s.color, opacity: 0.18 }, lineStyle: { color: s.color, width: 2 }, itemStyle: { color: s.color } })) }],
    }, true);
  }

  // ---- Compare page -------------------------------------------------------
  function cmpEntities(ctype) { return ctype === "t" ? state.data.teams.map((t) => t.team) : null; }
  function showComparePage(ctype, a, b) {
    state.profileEntity = null;
    const isTeam = ctype === "t";
    if (isTeam) {
      const A = a, B = b, teams = state.data.teams;
      const optList = teams.map((t) => t.team).sort((x, y) => teamMeta(x).name.localeCompare(teamMeta(y).name));
      $("#cmp-a").innerHTML = optList.map((t) => `<option value="${t}">${teamMeta(t).name}</option>`).join(""); $("#cmp-a").value = A;
      $("#cmp-b").innerHTML = optList.map((t) => `<option value="${t}">${teamMeta(t).name}</option>`).join(""); $("#cmp-b").value = B;
      const tA = teams.find((t) => t.team === A), tB = teams.find((t) => t.team === B);
      compareRender(PROFILE_TEAM.map((k) => TSTAT[k]), tA, tB, teams, { name: teamMeta(A).name, color: color(A) }, { name: teamMeta(B).name, color: color(B) }, (s, e) => rankPct(teams.map((x) => pval(x, s)), pval(e, s), s.hi));
    } else {
      const pA = findPlayer(a), pB = findPlayer(b);
      const bk = pA ? bucket(pA.pos) : "WR";
      const pool = state.data.players.filter((x) => bucket(x.pos) === bk).sort((x, y) => x.player.localeCompare(y.player));
      const optHtml = pool.map((x) => `<option value="${x.id || x.player}">${x.player}</option>`).join("");
      $("#cmp-a").innerHTML = optHtml; $("#cmp-a").value = pA ? (pA.id || pA.player) : "";
      $("#cmp-b").innerHTML = optHtml; $("#cmp-b").value = pB ? (pB.id || pB.player) : "";
      const keys = COMPARE_PLAYER[bk] || COMPARE_PLAYER.WR;
      const peers = state.data.players.filter((x) => bucket(x.pos) === bk && qualified(x));
      compareRender(keys.map((k) => PSTAT[k]), pA, pB, null, { name: pA ? pA.player : "—", color: pA ? color(pA.team) : "#888" }, { name: pB ? pB.player : "—", color: pB ? color(pB.team) : "#888" }, (s, e) => e ? rankPct(peers.map((x) => pval(x, s)), pval(e, s), s.hi) : null);
    }
    activate("compare", null);
  }
  function cmpPick() {
    const r = parseHash(); const t = r.ctype || "p";
    go(`#/compare/${t}/${encodeURIComponent($("#cmp-a").value)}/${encodeURIComponent($("#cmp-b").value)}${seasonSuffix()}`);
  }
  function compareRender(stats, eA, eB, _pool, metaA, metaB, rankFn) {
    // radar
    const vA = stats.map((s) => Math.round(((eA ? rankFn(s, eA) : null) || { pct: 0 }).pct * 100));
    const vB = stats.map((s) => Math.round(((eB ? rankFn(s, eB) : null) || { pct: 0 }).pct * 100));
    radarCompare("cmp-radar", stats.map((s) => s.l), [{ name: metaA.name, color: metaA.color, vals: vA }, { name: metaB.name, color: metaB.color, vals: vB }]);
    // table
    const head = `<thead><tr><th>Stat</th><th>${metaA.name}</th><th>${metaB.name}</th></tr></thead>`;
    const body = stats.map((s) => {
      const a = eA ? pval(eA, s) : null, b = eB ? pval(eB, s) : null;
      let ac = "", bc = "";
      if (a != null && b != null && a !== b) { const aBetter = s.hi ? a > b : a < b; if (aBetter) ac = "a-win"; else bc = "b-win"; }
      return `<tr><td>${s.l}</td><td class="${ac}">${pfmt(a, s)}</td><td class="${bc}">${pfmt(b, s)}</td></tr>`;
    }).join("");
    $("#cmp-table").innerHTML = head + `<tbody>${body}</tbody>`;
  }
  function radarCompare(elId, labels, seriesData) {
    ec(elId).setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-compare-${state.season}`),
      title: { text: "Percentile comparison", left: 8, top: 4, textStyle: { color: TEXT, fontSize: 13, fontWeight: 600 } },
      legend: { top: 6, right: 10, textStyle: { color: AXIS } }, tooltip: { backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT } },
      radar: { indicator: labels.map((l) => ({ name: l, max: 100 })), radius: "64%", center: ["50%", "55%"], axisName: { color: AXIS, fontSize: 10 }, splitLine: { lineStyle: { color: LINE } }, splitArea: { show: false }, axisLine: { lineStyle: { color: LINE } } },
      series: [{ type: "radar", data: seriesData.map((s) => ({ value: s.vals, name: s.name, areaStyle: { color: s.color, opacity: 0.15 }, lineStyle: { color: s.color, width: 2 }, itemStyle: { color: s.color } })) }],
    }, true);
  }

  // ---- Share + card export ------------------------------------------------
  function copyLink(btn) {
    const url = location.href, old = btn.textContent;
    const done = () => { btn.textContent = "✓ Copied"; setTimeout(() => (btn.textContent = old), 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => fallbackCopy(url, done));
    else fallbackCopy(url, done);
  }
  function fallbackCopy(text, done) { const i = document.createElement("input"); i.value = text; document.body.appendChild(i); i.select(); try { document.execCommand("copy"); } catch (e) {} i.remove(); done(); }

  const imgCache = {};
  function loadImg(src) { return imgCache[src] || (imgCache[src] = new Promise((res) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; })); }

  async function exportCard() {
    const en = state.profileEntity; if (!en) return;
    const btn = $("#prof-save"); btn.disabled = true; btn.textContent = "Rendering…";
    try {
      const cs = getComputedStyle(document.documentElement); const C = (n, f) => (cs.getPropertyValue(n).trim() || f);
      const col = { bg: C("--bg", BG), panel: C("--panel", "#131a26"), line: C("--line", LINE), text: C("--text", TEXT), muted: C("--muted", AXIS) };
      let title, sub, accent, rowsData, badgeLogo;
      if (en.type === "player") {
        const p = findPlayer(en.id), b = bucket(p.pos), peers = playerPeers(p), keys = (PROFILE_PLAYER[b] || PROFILE_PLAYER.WR).slice(0, 6);
        title = p.player; sub = `${p.pos || ""} · ${teamMeta(p.team).name} · ${state.season}`; accent = color(p.team); badgeLogo = await loadImg(logo(p.team));
        rowsData = keys.map((k) => { const s = PSTAT[k]; const v = pval(p, s); const rp = v == null ? null : rankPct(peers.map((x) => pval(x, s)), v, s.hi); return { label: s.l, val: pfmt(v, s), pct: rp ? rp.pct : 0, rank: rp ? `#${rp.rank}/${rp.n}` : "" }; });
      } else {
        const teams = state.data.teams, t = teams.find((x) => x.team === en.id), keys = PROFILE_TEAM.slice(0, 6);
        const rec = t.w != null ? `${t.w}-${t.l}${t.t ? "-" + t.t : ""}` : "";
        title = teamMeta(en.id).name; sub = `${rec} · ${state.season}`; accent = color(en.id); badgeLogo = await loadImg(logo(en.id));
        rowsData = keys.map((k) => { const s = TSTAT[k]; const v = pval(t, s); const rp = v == null ? null : rankPct(teams.map((x) => pval(x, s)), v, s.hi); return { label: s.l, val: pfmt(v, s), pct: rp ? rp.pct : 0, rank: rp ? `#${rp.rank}/${rp.n}` : "" }; });
      }
      const dpr = 2, W = 760, headH = 132, rowH = 52, pad = 28, H = headH + rowsData.length * rowH + 64;
      const cv = document.createElement("canvas"); cv.width = W * dpr; cv.height = H * dpr; const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
      ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = accent; ctx.globalAlpha = 0.14; ctx.fillRect(0, 0, W, headH); ctx.globalAlpha = 1;
      ctx.fillStyle = accent; ctx.fillRect(0, 0, 6, headH);
      if (badgeLogo) ctx.drawImage(badgeLogo, pad + 4, 30, 72, 72);
      ctx.fillStyle = col.text; ctx.font = "800 30px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText(title, pad + 92, 62);
      ctx.fillStyle = col.muted; ctx.font = "500 15px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText(sub, pad + 92, 88);
      rowsData.forEach((r, i) => {
        const y = headH + 20 + i * rowH;
        ctx.fillStyle = col.muted; ctx.font = "500 14px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText(r.label, pad, y + 6);
        const bx = pad + 210, bw = W - pad - 130 - bx;
        ctx.fillStyle = col.line; roundRect(ctx, bx, y - 6, bw, 8, 4); ctx.fill();
        ctx.fillStyle = barColor(r.pct); roundRect(ctx, bx, y - 6, Math.max(6, bw * r.pct), 8, 4); ctx.fill();
        ctx.textAlign = "right"; ctx.fillStyle = col.text; ctx.font = "700 16px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText(r.val, W - pad, y + 2);
        ctx.fillStyle = col.muted; ctx.font = "500 11px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText(r.rank, W - pad, y + 18); ctx.textAlign = "left";
      });
      ctx.fillStyle = col.muted; ctx.font = "600 13px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText("NFL Graphs · nflverse data", pad, H - 20);
      ctx.textAlign = "right"; ctx.fillText("@mikeapter", W - pad, H - 20); ctx.textAlign = "left";
      cv.toBlob((blob) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `nfl-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${state.season}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, "image/png");
    } finally { btn.disabled = false; btn.textContent = "⬇ Save card"; }
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  async function exportStandings() {
    const btn = $("#standings-save"); btn.disabled = true; btn.textContent = "Rendering…";
    try {
      const cs = getComputedStyle(document.documentElement); const C = (n, f) => (cs.getPropertyValue(n).trim() || f);
      const col = { bg: C("--bg", BG), panel: C("--panel", "#131a26"), panel2: C("--panel-2", "#1a2233"), line: C("--line", LINE), text: C("--text", TEXT), muted: C("--muted", AXIS), good: C("--good", "#34d399"), bad: C("--bad", "#f87171") };
      const st = state.data.standings, divs = DIV_ORDER.filter((d) => st[d]);
      const dpr = 2, W = 1040, M = 28, colGap = 20, colW = (W - 2 * M - colGap) / 2, topPad = 84, headerH = 34, rowH = 42, cardGap = 20, cardH = headerH + 4 * rowH;
      const rowsCount = Math.ceil(divs.length / 2), H = topPad + rowsCount * cardH + (rowsCount - 1) * cardGap + 46;
      const cv = document.createElement("canvas"); cv.width = W * dpr; cv.height = H * dpr; const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
      ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, H); ctx.fillStyle = col.text; ctx.font = "700 26px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText(`NFL Standings · ${state.season}`, M, 44);
      ctx.fillStyle = col.muted; ctx.font = "400 14px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText("Regular season · ranked by win %, then point differential", M, 66);
      const logos = {}; await Promise.all(divs.flatMap((d) => st[d].map(async (r) => { logos[r.team] = await loadImg(logo(r.team)); })));
      divs.forEach((d, i) => {
        const cx = M + (i < rowsCount ? 0 : 1) * (colW + colGap), cy = topPad + (i % rowsCount) * (cardH + cardGap);
        roundRect(ctx, cx, cy, colW, cardH, 12); ctx.fillStyle = col.panel; ctx.fill(); ctx.strokeStyle = col.line; ctx.lineWidth = 1; ctx.stroke();
        roundRect(ctx, cx, cy, colW, headerH, 12); ctx.fillStyle = col.panel2; ctx.fill();
        ctx.fillStyle = col.muted; ctx.font = "700 12px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText(d.toUpperCase(), cx + 14, cy + 22);
        st[d].forEach((r, j) => {
          const ry = cy + headerH + j * rowH;
          if (j) { ctx.strokeStyle = col.line; ctx.beginPath(); ctx.moveTo(cx + 12, ry); ctx.lineTo(cx + colW - 12, ry); ctx.stroke(); }
          const im = logos[r.team]; if (im) ctx.drawImage(im, cx + 14, ry + 7, 28, 28);
          ctx.fillStyle = col.text; ctx.font = "600 15px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText(teamMeta(r.team).name, cx + 52, ry + 27);
          ctx.textAlign = "right"; ctx.fillStyle = col.text; ctx.font = "600 14px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText(`${r.w}-${r.l}${r.t ? "-" + r.t : ""}`, cx + colW - 66, ry + 27);
          ctx.fillStyle = r.pd >= 0 ? col.good : col.bad; ctx.font = "600 13px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText(`${r.pd >= 0 ? "+" : ""}${r.pd}`, cx + colW - 16, ry + 27); ctx.textAlign = "left";
        });
      });
      ctx.fillStyle = col.muted; ctx.font = "600 13px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText("nflverse data", M, H - 18);
      ctx.textAlign = "right"; ctx.fillText("@mikeapter", W - M, H - 18); ctx.textAlign = "left";
      cv.toBlob((blob) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `nfl-standings-${state.season}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, "image/png");
    } finally { btn.disabled = false; btn.textContent = "⬇ Save PNG"; }
  }

  (function initTheme() { let stored = null; try { stored = localStorage.getItem("nflg-theme"); } catch (e) {} const sys = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"; applyTheme(stored || sys); })();
  boot();
})();
