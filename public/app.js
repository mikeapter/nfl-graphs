/* NFL Graphs — static app. Loads prebuilt JSON, renders customizable ECharts. */
(() => {
  "use strict";

  // Theme-aware chart colors: [axis, line, text, tooltip-bg, page-bg].
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

  const state = {
    meta: null, season: null, data: null,
    teamChart: "scatter", teamX: "off_epa", teamY: "def_epa", teamRank: "off_epa", teamSet: "Offense",
    playerPos: "QB", playerChart: "bar", playerRank: "passing_yards",
    playerX: "attempts", playerY: "passing_epa", playerSet: "Passing",
    teamHeat: [], playerHeat: [], playerQual: true,
    team: null, focus: null, searchIndex: {},
  };
  const charts = {};

  // ---- Stat catalogs ------------------------------------------------------
  // {k: key, l: label, hi: higher-is-better, d: decimals, fn: derive(entity)}
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
  ];
  const TEAM_SETS = {
    Offense: ["off_epa", "ppg", "ypp", "passing_yards", "rushing_yards", "total_tds"],
    Defense: ["def_epa", "papg", "def_sacks", "def_interceptions", "def_pass_defended", "def_tds"],
    Overall: ["net_epa", "pd", "w", "ppg", "papg", "first_downs"],
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
  ];
  const PLAYER_SETS = {
    Passing: ["passing_yards", "passing_tds", "passing_epa", "cmp_pct", "ypa", "passing_cpoe"],
    Rushing: ["rushing_yards", "rushing_tds", "rushing_epa", "ypc", "carries", "yds_scrim"],
    Receiving: ["receiving_yards", "receptions", "receiving_tds", "receiving_epa", "ypr", "target_share"],
    Fantasy: ["fantasy_points_ppr", "fppg", "total_tds", "yds_scrim", "touches"],
  };

  const TSTAT = Object.fromEntries(TEAM_STATS.map((s) => [s.k, s]));
  const PSTAT = Object.fromEntries(PLAYER_STATS.map((s) => [s.k, s]));

  const pval = (e, stat) => {
    const v = stat.fn ? stat.fn(e) : e[stat.k];
    return v == null || (typeof v === "number" && isNaN(v)) ? null : v;
  };
  const pfmt = (v, stat) => {
    if (v == null) return "—";
    const d = stat.d || 0;
    return d === 0 ? Math.round(v).toLocaleString("en-US") : (+v).toFixed(d);
  };

  // ---- Theme --------------------------------------------------------------
  function setToggleIcon() {
    const btn = $("#theme-toggle");
    if (!btn) return;
    btn.innerHTML = theme === "dark" ? ICON_SUN : ICON_MOON;
    btn.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  }
  function applyTheme(name) {
    theme = THEME_VALS[name] ? name : "dark";
    [AXIS, LINE, TEXT, TIP, BG] = THEME_VALS[theme];
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("nflg-theme", theme); } catch (e) {}
    setToggleIcon();
    if (state.data) renderAll();
  }

  // ---- Boot ---------------------------------------------------------------
  async function boot() {
    try {
      state.meta = await (await fetch("./data/meta.json")).json();
    } catch (e) {
      document.body.innerHTML = '<p style="padding:24px;color:#f87171">Could not load data. Run the build script first.</p>';
      return;
    }
    $("#updated").textContent = "Updated " + state.meta.generated_at;
    const sel = $("#season-select");
    sel.innerHTML = state.meta.seasons.map((s) => `<option value="${s}">${s}</option>`).join("");
    sel.value = state.meta.latest;
    sel.addEventListener("change", () => loadSeason(+sel.value));

    $$(".tab").forEach((t) => t.addEventListener("click", () => showView(t.dataset.view)));
    window.addEventListener("resize", () => Object.values(charts).forEach((c) => c.resize()));

    setToggleIcon();
    $("#theme-toggle").addEventListener("click", () => applyTheme(theme === "dark" ? "light" : "dark"));

    // Team builder
    fillSelect($("#team-x"), TEAM_STATS, state.teamX);
    fillSelect($("#team-y"), TEAM_STATS, state.teamY);
    fillSelect($("#team-rank"), TEAM_STATS, state.teamRank);
    fillSets($("#team-set"), TEAM_SETS, state.teamSet);
    state.teamHeat = TEAM_SETS[state.teamSet].slice();
    segmented("#team-chart", (v) => { state.teamChart = v; teamControls(); renderTeams(); });
    $("#team-x").addEventListener("change", (e) => { state.teamX = e.target.value; renderTeams(); });
    $("#team-y").addEventListener("change", (e) => { state.teamY = e.target.value; renderTeams(); });
    $("#team-rank").addEventListener("change", (e) => { state.teamRank = e.target.value; renderTeams(); });
    $("#team-set").addEventListener("change", (e) => { state.teamSet = e.target.value; state.teamHeat = TEAM_SETS[e.target.value].slice(); teamChips(); renderTeams(); });

    // Player builder
    fillSelect($("#player-rank"), PLAYER_STATS, state.playerRank);
    fillSelect($("#player-x"), PLAYER_STATS, state.playerX);
    fillSelect($("#player-y"), PLAYER_STATS, state.playerY);
    fillSets($("#player-set"), PLAYER_SETS, state.playerSet);
    state.playerHeat = PLAYER_SETS[state.playerSet].slice();
    segmented("#player-pos", (v) => { applyPlayerDefaults(v); renderPlayers(); });
    segmented("#player-chart", (v) => { state.playerChart = v; playerControls(); renderPlayers(); });
    $("#player-rank").addEventListener("change", (e) => { state.playerRank = e.target.value; renderPlayers(); });
    $("#player-x").addEventListener("change", (e) => { state.playerX = e.target.value; renderPlayers(); });
    $("#player-y").addEventListener("change", (e) => { state.playerY = e.target.value; renderPlayers(); });
    $("#player-set").addEventListener("change", (e) => { state.playerSet = e.target.value; state.playerHeat = PLAYER_SETS[e.target.value].slice(); playerChips(); renderPlayers(); });
    $("#player-qual").addEventListener("change", (e) => { state.playerQual = e.target.checked; renderPlayers(); });

    // Standings / scores / trends
    $("#week-select").addEventListener("change", renderScores);
    $("#team-select").addEventListener("change", () => { state.team = $("#team-select").value; renderTrends(); });
    $("#standings-save").addEventListener("click", exportStandings);

    // Search + profile
    $("#global-search").addEventListener("change", onSearch);
    $("#search-clear").addEventListener("click", clearSearch);
    $("#profile-close").addEventListener("click", closeProfile);
    $("#profile").addEventListener("click", (e) => { if (e.target.id === "profile") closeProfile(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeProfile(); });
    // Click-to-profile: player table rows & standings rows (event delegation)
    $("#player-table").addEventListener("click", (e) => {
      const tr = e.target.closest("tr"); const cell = tr && tr.querySelector(".pname");
      if (cell) openProfile("player", cell.textContent);
    });
    $("#divisions").addEventListener("click", (e) => {
      const row = e.target.closest(".divrow"); if (row && row.dataset.team) openProfile("team", row.dataset.team);
    });

    teamControls(); playerControls();
    await loadSeason(state.meta.latest);
  }

  function fillSelect(el, stats, selected) { el.innerHTML = stats.map((s) => `<option value="${s.k}">${s.l}</option>`).join(""); el.value = selected; }
  function fillSets(el, sets, selected) { el.innerHTML = Object.keys(sets).map((k) => `<option value="${k}">${k}</option>`).join(""); el.value = selected; }
  function segmented(sel, cb) {
    $$(sel + " .seg").forEach((b) => b.addEventListener("click", () => {
      $$(sel + " .seg").forEach((x) => x.classList.toggle("active", x === b));
      cb(b.dataset.type || b.dataset.pos);
    }));
  }
  function toggleRoles(builderSel, roles) {
    $$(builderSel + " .ctl[data-role]").forEach((c) => { c.hidden = !roles.includes(c.dataset.role); });
  }
  function teamControls() {
    const t = state.teamChart;
    toggleRoles("#view-teams .builder", t === "scatter" ? ["x", "y"] : t === "bar" ? ["rank"] : ["set"]);
    $("#team-heat-chips").hidden = t !== "heatmap"; if (t === "heatmap") teamChips();
  }
  function playerControls() {
    const t = state.playerChart;
    toggleRoles("#view-players .builder", t === "scatter" ? ["x", "y"] : t === "bar" ? ["rank"] : ["set"]);
    $("#player-heat-chips").hidden = t !== "heatmap"; if (t === "heatmap") playerChips();
  }

  // Heatmap column chips
  function renderChips(containerId, catalog, selected, onToggle) {
    const el = $("#" + containerId);
    el.innerHTML = catalog.map((s) => `<span class="chip ${selected.includes(s.k) ? "on" : ""}" data-k="${s.k}">${s.l}</span>`).join("");
    el.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => onToggle(c.dataset.k)));
  }
  const teamChips = () => renderChips("team-heat-chips", TEAM_STATS, state.teamHeat, (k) => { toggleHeat(state.teamHeat, k); teamChips(); renderTeams(); });
  const playerChips = () => renderChips("player-heat-chips", PLAYER_STATS, state.playerHeat, (k) => { toggleHeat(state.playerHeat, k); playerChips(); renderPlayers(); });
  function toggleHeat(arr, k) {
    const i = arr.indexOf(k);
    if (i >= 0) { if (arr.length > 2) arr.splice(i, 1); }
    else if (arr.length < 10) arr.push(k);
  }

  async function loadSeason(season) {
    state.season = season;
    state.data = await (await fetch(`./data/season_${season}.json`)).json();

    const teams = Object.keys(state.meta.teams).sort((a, b) => teamMeta(a).name.localeCompare(teamMeta(b).name));
    $("#team-select").innerHTML = teams.filter((a) => state.data.trends[a]).map((a) => `<option value="${a}">${teamMeta(a).name}</option>`).join("");
    if (!state.team || !state.data.trends[state.team]) state.team = $("#team-select").value;
    $("#team-select").value = state.team;

    const weeks = Object.keys(state.data.scores).sort(weekOrder);
    $("#week-select").innerHTML = weeks.map((w) => `<option value="${w}">${weekLabel(w)}</option>`).join("");
    $("#week-select").value = weeks[weeks.length - 1];

    buildSearchIndex();
    renderAll();
    showView(document.querySelector(".tab.active").dataset.view);
  }

  function renderAll() { renderTeams(); renderPlayers(); renderStandings(); renderScores(); renderTrends(); }

  function showView(view) {
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    requestAnimationFrame(() => Object.values(charts).forEach((c) => c.resize()));
  }

  const teamMeta = (a) => (state.meta && state.meta.teams[a]) || { name: a, color: "#888", logo: "" };
  const color = (a) => teamMeta(a).color;
  const logo = (a) => teamMeta(a).logo;
  const findPlayer = (idOrName) => state.data.players.find((p) => p.id === idOrName) || state.data.players.find((p) => p.player === idOrName);

  const CLICK_ROUTERS = {
    "team-chart-el": (p) => { const n = p.name || (p.data && p.data.name); if (n && state.meta.teams[n]) openProfile("team", n); },
    "player-chart-el": (p) => { let n = (p.data && p.data.pl) || (p.seriesType === "bar" ? p.name : null); if (n) openProfile("player", n); },
  };
  function ec(id) {
    if (!charts[id]) {
      const el = document.getElementById(id);
      const chart = echarts.init(el, null, { renderer: "canvas" });
      charts[id] = chart;
      if (CLICK_ROUTERS[id]) chart.on("click", CLICK_ROUTERS[id]);
      if (window.ResizeObserver) {
        let raf = 0;
        new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (el.clientWidth) chart.resize(); }); }).observe(el);
      }
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

  // ---- Teams explorer -----------------------------------------------------
  function renderTeams() {
    const rows = state.data.teams;
    const c = state.teamChart;
    $("#team-hint").textContent =
      c === "scatter" ? "Each logo is a team · up / right = better · dashed lines = league average · click a team for its profile" :
      c === "bar" ? "All 32 teams ranked · best at top · click a team for its profile" :
      "Teams × the stats you pick · teal = better, red = worse · tap chips to add/remove columns";
    if (c === "scatter") teamScatter(rows);
    else if (c === "bar") teamBar(rows);
    else heatmap("team-chart-el", rows.slice(), (t) => t.team, (t) => teamMeta(t.team).name, state.teamHeat, TSTAT, "teams-heatmap");
  }
  function teamScatter(rows) {
    const sx = TSTAT[state.teamX], sy = TSTAT[state.teamY];
    const pts = rows.map((t) => ({ x: pval(t, sx), y: pval(t, sy), team: t.team })).filter((p) => p.x != null && p.y != null);
    const ax = pts.reduce((s, p) => s + p.x, 0) / pts.length, ay = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const foc = state.focus && state.focus.type === "team" ? state.focus.id : null;
    ec("team-chart-el").setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-teams-${sx.k}-vs-${sy.k}-${state.season}`),
      grid: { left: 64, right: 26, top: 26, bottom: 54 },
      tooltip: { trigger: "item", backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (p) => `<b>${teamMeta(p.name).name}</b><br/>${sx.l}: ${pfmt(p.value[0], sx)}<br/>${sy.l}: ${pfmt(p.value[1], sy)}` },
      xAxis: { ...axisCommon(), name: sx.l, nameLocation: "middle", nameGap: 32, nameTextStyle: { color: AXIS }, inverse: !sx.hi, scale: true },
      yAxis: { ...axisCommon(), name: sy.l, nameLocation: "middle", nameGap: 46, nameTextStyle: { color: AXIS }, inverse: !sy.hi, scale: true },
      series: [{
        type: "scatter",
        data: pts.map((p) => ({ value: [p.x, p.y], name: p.team, symbol: logo(p.team) ? "image://" + logo(p.team) : "circle", symbolSize: p.team === foc ? 42 : 28, label: p.team === foc ? { show: true, position: "top", formatter: p.team, color: TEXT, fontWeight: 700 } : { show: false } })),
        markLine: { silent: true, symbol: "none", lineStyle: { color: "#5a6a86", type: "dashed", opacity: 0.7 }, label: { show: false }, data: [{ xAxis: ax }, { yAxis: ay }] },
      }],
    }, true);
  }
  function teamBar(rows) {
    const s = TSTAT[state.teamRank];
    const list = rows.map((t) => ({ team: t.team, v: pval(t, s) })).filter((r) => r.v != null).sort((a, b) => s.hi ? a.v - b.v : b.v - a.v);
    ec("team-chart-el").setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-teams-rank-${s.k}-${state.season}`),
      grid: { left: 54, right: 60, top: 26, bottom: 20 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (ps) => `${teamMeta(ps[0].name).name}<br/>${s.l}: ${pfmt(ps[0].value, s)}` },
      xAxis: { ...axisCommon(), type: "value" },
      yAxis: { type: "category", data: list.map((r) => r.team), axisLine: { lineStyle: { color: LINE } }, axisLabel: { color: TEXT, fontSize: 10 } },
      series: [{ type: "bar", data: list.map((r) => ({ value: r.v, name: r.team, itemStyle: { color: color(r.team), borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: "right", color: AXIS, formatter: (p) => pfmt(p.value, s) }, barMaxWidth: 13 }],
    }, true);
  }

  // ---- Players explorer ---------------------------------------------------
  const POS_MATCH = { QB: (p) => p.pos === "QB", RB: (p) => p.pos === "RB" || p.pos === "FB", WR: (p) => p.pos === "WR", TE: (p) => p.pos === "TE", SKILL: (p) => ["RB", "FB", "WR", "TE"].includes(p.pos) };
  const POS_DEFAULTS = {
    QB: { rank: "passing_yards", x: "attempts", y: "passing_epa", set: "Passing" },
    RB: { rank: "rushing_yards", x: "carries", y: "rushing_epa", set: "Rushing" },
    WR: { rank: "receiving_yards", x: "targets", y: "receiving_epa", set: "Receiving" },
    TE: { rank: "receiving_yards", x: "targets", y: "receiving_epa", set: "Receiving" },
    SKILL: { rank: "fantasy_points_ppr", x: "rushing_yards", y: "receiving_yards", set: "Fantasy" },
  };
  function applyPlayerDefaults(pos) {
    const d = POS_DEFAULTS[pos] || POS_DEFAULTS.QB;
    state.playerPos = pos; state.playerRank = d.rank; state.playerX = d.x; state.playerY = d.y;
    state.playerSet = d.set; state.playerHeat = PLAYER_SETS[d.set].slice();
    $("#player-rank").value = d.rank; $("#player-x").value = d.x; $("#player-y").value = d.y; $("#player-set").value = d.set;
    if (state.playerChart === "heatmap") playerChips();
  }
  function qualified(p) {
    if (p.pos === "QB") return (p.attempts || 0) >= 100;
    if (p.pos === "RB" || p.pos === "FB") return (p.carries || 0) >= 40;
    if (p.pos === "WR" || p.pos === "TE") return (p.targets || 0) >= 30;
    return (p.targets || 0) >= 30 || (p.carries || 0) >= 40;
  }
  function filteredPlayers() {
    let list = state.data.players.filter(POS_MATCH[state.playerPos] || (() => true));
    if (state.playerQual) list = list.filter(qualified);
    return list;
  }
  function renderPlayers() {
    const list = filteredPlayers();
    const c = state.playerChart;
    $("#player-hint").textContent =
      c === "bar" ? "Top 15 by the selected stat · colored by team · click a bar for the player profile" :
      c === "scatter" ? "Every qualified player · colored by team · click a dot for the profile" :
      "Top 20 players × the stats you pick · teal = better, red = worse · tap chips to change columns";
    if (c === "bar") playerBar(list);
    else if (c === "scatter") playerScatter(list);
    else {
      const primary = PSTAT[state.playerHeat[0]];
      const top = list.map((p) => ({ p, v: pval(p, primary) })).filter((r) => r.v != null).sort((a, b) => primary.hi ? b.v - a.v : a.v - b.v).slice(0, 20).map((r) => r.p);
      heatmap("player-chart-el", top, (p) => p.player, (p) => `${p.player} (${p.team})`, state.playerHeat, PSTAT, "players-heatmap");
    }
    renderPlayerTable(list);
  }
  function playerBar(list) {
    const s = PSTAT[state.playerRank];
    const rows = list.map((p) => ({ p, v: pval(p, s) })).filter((r) => r.v != null).sort((a, b) => s.hi ? b.v - a.v : a.v - b.v).slice(0, 15).reverse();
    ec("player-chart-el").setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-players-${state.playerPos}-${s.k}-${state.season}`),
      grid: { left: 140, right: 46, top: 26, bottom: 20 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (ps) => `${ps[0].name}<br/>${s.l}: ${pfmt(ps[0].value, s)}` },
      xAxis: { ...axisCommon(), type: "value" },
      yAxis: { type: "category", data: rows.map((r) => r.p.player), axisLine: { lineStyle: { color: LINE } }, axisLabel: { color: TEXT, fontSize: 11 } },
      series: [{ type: "bar", data: rows.map((r) => ({ value: r.v, name: r.p.player, itemStyle: { color: color(r.p.team), borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: "right", color: AXIS, formatter: (p) => pfmt(p.value, s) }, barMaxWidth: 22 }],
    }, true);
  }
  function playerScatter(list) {
    const sx = PSTAT[state.playerX], sy = PSTAT[state.playerY];
    const pts = list.map((p) => ({ x: pval(p, sx), y: pval(p, sy), p })).filter((o) => o.x != null && o.y != null);
    const foc = state.focus && state.focus.type === "player" ? state.focus.id : null;
    ec("player-chart-el").setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-players-${state.playerPos}-${sx.k}-vs-${sy.k}-${state.season}`),
      grid: { left: 60, right: 26, top: 26, bottom: 52 },
      tooltip: { trigger: "item", backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (o) => `<b>${o.data.pl}</b> (${o.data.tm})<br/>${sx.l}: ${pfmt(o.value[0], sx)}<br/>${sy.l}: ${pfmt(o.value[1], sy)}` },
      xAxis: { ...axisCommon(), name: sx.l, nameLocation: "middle", nameGap: 32, nameTextStyle: { color: AXIS }, inverse: !sx.hi, scale: true },
      yAxis: { ...axisCommon(), name: sy.l, nameLocation: "middle", nameGap: 46, nameTextStyle: { color: AXIS }, inverse: !sy.hi, scale: true },
      series: [{ type: "scatter", symbolSize: 11, data: pts.map((o) => { const f = o.p.player === foc; return { value: [o.x, o.y], pl: o.p.player, tm: o.p.team, itemStyle: { color: color(o.p.team), borderColor: f ? TEXT : "transparent", borderWidth: f ? 2 : 0, opacity: foc && !f ? 0.5 : 0.95 }, symbolSize: f ? 18 : 11, label: f ? { show: true, position: "top", formatter: o.p.player, color: TEXT, fontWeight: 700 } : { show: false } }; }) }],
    }, true);
  }
  function renderPlayerTable(list) {
    const s = PSTAT[state.playerRank];
    const setKey = state.playerChart === "heatmap" ? state.playerSet : (state.playerPos === "QB" ? "Passing" : state.playerPos === "RB" ? "Rushing" : "Receiving");
    const cols = Array.from(new Set([state.playerRank, ...PLAYER_SETS[setKey]])).slice(0, 6).map((k) => PSTAT[k]);
    const sorted = list.map((p) => ({ p, v: pval(p, s) })).filter((r) => r.v != null).sort((a, b) => s.hi ? b.v - a.v : a.v - b.v);
    const foc = state.focus && state.focus.type === "player" ? state.focus.id : null;
    const head = `<thead><tr><th class="rank">#</th><th>Player</th><th>Tm</th><th>Pos</th>${cols.map((c) => `<th>${c.l}</th>`).join("")}<th>G</th></tr></thead>`;
    const body = sorted.map((r, i) => `<tr${r.p.player === foc ? ' class="hl"' : ""}>
      <td class="rank">${i + 1}</td><td class="pname">${r.p.player}</td><td class="pteam">${r.p.team || ""}</td><td class="pteam">${r.p.pos || ""}</td>
      ${cols.map((c) => `<td>${pfmt(pval(r.p, c), c)}</td>`).join("")}<td>${r.p.games ?? ""}</td></tr>`).join("");
    $("#player-table").innerHTML = head + `<tbody>${body}</tbody>`;
    const hl = $("#player-table .hl"); if (hl) hl.scrollIntoView({ block: "nearest" });
  }

  // ---- Heatmap (shared) ---------------------------------------------------
  function heatmap(elId, entities, nameFn, longNameFn, statKeys, statMap, fileprefix) {
    const stats = statKeys.map((k) => statMap[k]);
    const first = stats[0];
    entities = entities.slice().sort((a, b) => { const av = pval(a, first), bv = pval(b, first); if (av == null) return 1; if (bv == null) return -1; return (bv - av) * (first.hi ? 1 : -1); });
    const cols = stats.map((s) => {
      const vals = entities.map((e) => pval(e, s)).filter((v) => v != null);
      const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length || 1)) || 1;
      return { s, mean, sd };
    });
    const data = [];
    entities.forEach((e, yi) => stats.forEach((s, xi) => {
      const raw = pval(e, s); if (raw == null) return;
      const z = (raw - cols[xi].mean) / cols[xi].sd * (s.hi ? 1 : -1);
      data.push({ value: [xi, entities.length - 1 - yi, +z.toFixed(3)], raw, ent: longNameFn(e), lab: s.l, s });
    }));
    ec(elId).setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-${fileprefix}-${state.season}`),
      grid: { left: 138, right: 20, top: 30, bottom: 62 },
      tooltip: { backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (p) => `<b>${p.data.ent}</b><br/>${p.data.lab}: ${pfmt(p.data.raw, p.data.s)}` },
      xAxis: { type: "category", data: stats.map((s) => s.l), position: "top", axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: AXIS, interval: 0, fontSize: 10, overflow: "break", width: 76 } },
      yAxis: { type: "category", data: entities.map(nameFn).reverse(), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: TEXT, fontSize: 11 } },
      visualMap: { min: -2, max: 2, calculable: false, orient: "horizontal", left: "center", bottom: 4, itemWidth: 12, itemHeight: 90, textStyle: { color: AXIS }, text: ["better", "worse"], inRange: { color: ["#d1493f", "#e6c86e", "#2a9d8f"] } },
      series: [{ type: "heatmap", data, itemStyle: { borderColor: BG, borderWidth: 1 }, emphasis: { itemStyle: { borderColor: TEXT, borderWidth: 1.5 } } }],
    }, true);
  }

  // ---- Standings + Scores -------------------------------------------------
  const DIV_ORDER = ["AFC East", "AFC North", "AFC South", "AFC West", "NFC East", "NFC North", "NFC South", "NFC West"];
  function renderStandings() {
    const st = state.data.standings;
    $("#divisions").innerHTML = DIV_ORDER.filter((d) => st[d]).map((d) => `
      <div class="divcard"><h3>${d}</h3>
        ${st[d].map((r) => `<div class="divrow" data-team="${r.team}">
          <img src="${logo(r.team)}" alt="" loading="lazy"/>
          <span class="tname">${teamMeta(r.team).name}</span>
          <span class="rec">${r.w}-${r.l}${r.t ? "-" + r.t : ""}</span>
          <span class="pd ${r.pd >= 0 ? "pos" : "neg"}">${r.pd >= 0 ? "+" : ""}${r.pd}</span>
        </div>`).join("")}
      </div>`).join("");
  }
  function renderScores() {
    const wk = $("#week-select").value;
    const gs = (state.data.scores[wk] || []).slice();
    $("#scores").innerHTML = gs.map((g) => {
      const awin = g.as > g.hs, hwin = g.hs > g.as;
      const side = (t, s, win, lose) => `<div class="gteam ${win ? "win" : lose ? "lose" : ""}"><img src="${logo(t)}" alt="" loading="lazy"/><span class="gt-name">${t}</span><span class="gt-score">${s}</span></div>`;
      return `<div class="gcard">${side(g.away, g.as, awin, hwin)}${side(g.home, g.hs, hwin, awin)}<div class="gdate">${g.date || ""}</div></div>`;
    }).join("") || '<p class="hint">No games.</p>';
  }
  function weekOrder(a, b) { return weekNum(a) - weekNum(b); }
  function weekNum(w) { const m = w.match(/(\d+)/g); return m ? +m[m.length - 1] : 0; }
  function weekLabel(w) {
    if (/^\d+$/.test(w)) return "Week " + +w;
    const map = { WC: "Wild Card", DIV: "Divisional", CON: "Conf Champ", CONF: "Conf Champ", SB: "Super Bowl" };
    return map[w.split("-")[0]] || w;
  }

  // ---- Team Trends --------------------------------------------------------
  function renderTrends() {
    const t = state.data.trends[state.team]; if (!t) return;
    const c = color(state.team);
    ec("trend-pd").setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-${state.team}-pointdiff-${state.season}`),
      title: { text: teamMeta(state.team).name + " — weekly point differential", left: 8, top: 4, textStyle: { color: TEXT, fontSize: 13, fontWeight: 600 } },
      grid: { left: 44, right: 20, top: 40, bottom: 30 },
      tooltip: { trigger: "axis", backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (ps) => { const p = ps[0]; return `Week ${p.axisValue}<br/>${t.result[p.dataIndex]} · ${p.value >= 0 ? "+" : ""}${p.value}`; } },
      xAxis: { ...axisCommon(), type: "category", data: t.weeks },
      yAxis: { ...axisCommon(), type: "value" },
      series: [{ type: "bar", data: t.pd.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? c : "#f87171", borderRadius: v >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3] } })), barMaxWidth: 26 }],
    }, true);
    const hasEpa = t.off_epa && t.epa_weeks;
    ec("trend-epa").setOption({
      backgroundColor: "transparent", ...chartExtras(`nfl-${state.team}-epa-${state.season}`),
      title: { text: "Weekly EPA per play (offense vs defense)", left: 8, top: 4, textStyle: { color: TEXT, fontSize: 13, fontWeight: 600 } },
      legend: { data: ["Offense", "Defense"], top: 6, left: "center", textStyle: { color: AXIS } },
      grid: { left: 48, right: 20, top: 40, bottom: 30 },
      tooltip: { trigger: "axis", backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT } },
      xAxis: { ...axisCommon(), type: "category", data: hasEpa ? t.epa_weeks : [] },
      yAxis: { ...axisCommon(), type: "value", axisLabel: { color: AXIS, formatter: (v) => v.toFixed(2) } },
      series: [
        { name: "Offense", type: "line", smooth: true, data: hasEpa ? t.off_epa : [], lineStyle: { color: c, width: 2.5 }, itemStyle: { color: c }, symbolSize: 6 },
        { name: "Defense", type: "line", smooth: true, data: hasEpa ? t.def_epa : [], lineStyle: { color: "#f87171", width: 2.5 }, itemStyle: { color: "#f87171" }, symbolSize: 6 },
      ],
    }, true);
  }

  // ---- Search -------------------------------------------------------------
  function buildSearchIndex() {
    const idx = {}, opts = [];
    Object.keys(state.meta.teams).forEach((a) => {
      const label = `${teamMeta(a).name} — Team`;
      idx[label.toLowerCase()] = { type: "team", id: a }; idx[a.toLowerCase()] = { type: "team", id: a };
      opts.push(label);
    });
    const seen = new Set();
    state.data.players.forEach((p) => {
      if (!p.player || seen.has(p.player)) return; seen.add(p.player);
      const label = `${p.player} — ${p.pos || ""} ${p.team || ""}`.trim();
      idx[label.toLowerCase()] = { type: "player", id: p.player, pos: p.pos }; idx[p.player.toLowerCase()] = { type: "player", id: p.player, pos: p.pos };
      opts.push(label);
    });
    state.searchIndex = idx;
    $("#search-options").innerHTML = opts.map((o) => `<option value="${o.replace(/"/g, "&quot;")}"></option>`).join("");
  }
  function onSearch(e) {
    const q = (e.target.value || "").trim().toLowerCase(); if (!q) return;
    const hit = state.searchIndex[q] || Object.entries(state.searchIndex).find(([k]) => k.startsWith(q) || k.includes(q));
    const match = Array.isArray(hit) ? hit[1] : hit; if (!match) return;
    $("#search-clear").hidden = false;
    openProfile(match.type, match.id);
  }
  function clearSearch() { state.focus = null; $("#global-search").value = ""; $("#search-clear").hidden = true; renderTeams(); renderPlayers(); }

  // ---- Profiles -----------------------------------------------------------
  const bucket = (pos) => pos === "QB" ? "QB" : (pos === "RB" || pos === "FB") ? "RB" : pos === "TE" ? "TE" : "WR";
  const PROFILE_PLAYER = {
    QB: ["passing_yards", "passing_tds", "passing_interceptions", "passing_epa", "cmp_pct", "ypa", "passing_cpoe", "fppg"],
    RB: ["rushing_yards", "rushing_tds", "ypc", "rushing_epa", "yds_scrim", "touches", "receptions", "fppg"],
    WR: ["receiving_yards", "receptions", "receiving_tds", "receiving_epa", "ypr", "target_share", "catch_pct", "fppg"],
    TE: ["receiving_yards", "receptions", "receiving_tds", "receiving_epa", "ypr", "target_share", "catch_pct", "fppg"],
  };
  const PROFILE_TEAM = ["off_epa", "def_epa", "net_epa", "ppg", "papg", "pd", "ypp", "first_downs"];

  function rankPct(values, val, hi) {
    const arr = values.filter((v) => v != null);
    const n = arr.length; if (!n) return null;
    const rank = 1 + arr.filter((v) => hi ? v > val : v < val).length;
    return { rank, n, pct: n > 1 ? (n - rank) / (n - 1) : 1 };
  }
  function barColor(pct) {
    // red (low) -> yellow -> teal (high)
    return pct >= 0.5 ? "#2a9d8f" : pct >= 0.25 ? "#e6c86e" : "#d1493f";
  }
  function statRow(label, valTxt, rp) {
    const pct = rp ? Math.round(rp.pct * 100) : 0;
    const rankTxt = rp ? `<span class="sr-rank">#${rp.rank}/${rp.n}</span>` : "";
    return `<div class="stat-row"><span class="sr-label">${label}</span>
      <span class="sr-bar"><span class="sr-fill" style="width:${pct}%;background:${barColor(rp ? rp.pct : 0)}"></span></span>
      <span class="sr-val">${valTxt} ${rankTxt}</span></div>`;
  }

  function openProfile(type, id) {
    if (type === "team") renderTeamProfile(id); else renderPlayerProfile(id);
    const m = $("#profile"); m.hidden = false; document.body.style.overflow = "hidden";
    m.querySelector(".modal-card").scrollTop = 0;
  }
  function closeProfile() { $("#profile").hidden = true; document.body.style.overflow = ""; }

  function renderPlayerProfile(idOrName) {
    const p = findPlayer(idOrName); if (!p) return;
    const b = bucket(p.pos);
    const peers = state.data.players.filter((x) => bucket(x.pos) === b && (qualified(x) || x.id === p.id));
    const keys = PROFILE_PLAYER[b] || PROFILE_PLAYER.WR;
    const rows = keys.map((k) => {
      const s = PSTAT[k]; const v = pval(p, s);
      const rp = v == null ? null : rankPct(peers.map((x) => pval(x, s)), v, s.hi);
      return statRow(s.l, pfmt(v, s), rp);
    }).join("");
    const faceImg = p.face ? `<img class="headshot" src="${p.face}" alt="" onerror="this.style.visibility='hidden'"/>` : `<div class="headshot"></div>`;
    $("#profile-body").innerHTML = `
      <div class="prof-head">
        <div class="prof-face">${faceImg}<img class="logo-badge" src="${logo(p.team)}" alt=""/></div>
        <div class="prof-title"><h3>${p.player}</h3>
          <div class="meta">${p.pos || ""} · ${teamMeta(p.team).name} · ${p.games || 0} games · ${state.season}</div></div>
      </div>
      <div class="prof-section-t">Season stats · rank vs qualified ${b === "QB" ? "QBs" : b === "RB" ? "RBs" : b === "TE" ? "TEs" : "WRs"}</div>
      <div class="stat-rows">${rows}</div>`;
  }

  function renderTeamProfile(abbr) {
    const t = state.data.teams.find((x) => x.team === abbr); if (!t) return;
    const teams = state.data.teams;
    const rows = PROFILE_TEAM.map((k) => {
      const s = TSTAT[k]; const v = pval(t, s);
      const rp = v == null ? null : rankPct(teams.map((x) => pval(x, s)), v, s.hi);
      return statRow(s.l, pfmt(v, s), rp);
    }).join("");
    // division + rank
    const st = state.data.standings; let divName = "", divRank = "";
    for (const d of Object.keys(st)) { const i = st[d].findIndex((r) => r.team === abbr); if (i >= 0) { divName = d; divRank = `${i + 1}${["st", "nd", "rd", "th"][Math.min(i, 3)]} in ${d}`; } }
    const rec = (t.w != null) ? `${t.w}-${t.l}${t.t ? "-" + t.t : ""}` : "";
    const tops = state.data.players.filter((x) => x.team === abbr).map((x) => ({ x, v: pval(x, PSTAT.fantasy_points_ppr) || 0 })).sort((a, b) => b.v - a.v).slice(0, 5);
    const topHtml = tops.map(({ x }) => `<div class="pp-row" data-player="${(x.id || x.player)}">
      <img src="${x.face || ""}" alt="" onerror="this.style.visibility='hidden'"/>
      <div><div class="pp-name">${x.player}</div><div class="pp-sub">${x.pos || ""}</div></div>
      <div class="pp-stat">${pfmt(pval(x, PSTAT.fantasy_points_ppr), PSTAT.fantasy_points_ppr)} PPR</div></div>`).join("");
    $("#profile-body").innerHTML = `
      <div class="prof-head">
        <img class="prof-logo" src="${logo(abbr)}" alt=""/>
        <div class="prof-title"><h3>${teamMeta(abbr).name}</h3>
          <div class="meta"><span class="rec">${rec}</span> · ${divRank} · ${state.season}</div></div>
      </div>
      <div class="prof-section-t">Team stats · rank across the NFL</div>
      <div class="stat-rows">${rows}</div>
      <div class="prof-section-t">Top players (fantasy PPR)</div>
      <div class="prof-players">${topHtml}</div>
      <button class="prof-btn" id="prof-trend">View weekly trend →</button>`;
    $("#profile-body").querySelectorAll(".pp-row").forEach((r) => r.addEventListener("click", () => openProfile("player", r.dataset.player)));
    const bt = $("#prof-trend");
    if (bt) bt.addEventListener("click", () => { closeProfile(); state.team = abbr; $("#team-select").value = abbr; showView("trends"); renderTrends(); });
  }

  // ---- Standings PNG export ----------------------------------------------
  const imgCache = {};
  function loadImg(src) {
    return imgCache[src] || (imgCache[src] = new Promise((res) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }));
  }
  async function exportStandings() {
    const btn = $("#standings-save"); btn.disabled = true; btn.textContent = "Rendering…";
    try {
      const cs = getComputedStyle(document.documentElement);
      const C = (n, f) => (cs.getPropertyValue(n).trim() || f);
      const col = { bg: C("--bg", BG), panel: C("--panel", "#131a26"), panel2: C("--panel-2", "#1a2233"), line: C("--line", LINE), text: C("--text", TEXT), muted: C("--muted", AXIS), good: C("--good", "#34d399"), bad: C("--bad", "#f87171") };
      const st = state.data.standings, divs = DIV_ORDER.filter((d) => st[d]);
      const dpr = 2, W = 1040, M = 28, colGap = 20, colW = (W - 2 * M - colGap) / 2;
      const topPad = 84, headerH = 34, rowH = 42, cardGap = 20, cardH = headerH + 4 * rowH;
      const rowsCount = Math.ceil(divs.length / 2), H = topPad + rowsCount * cardH + (rowsCount - 1) * cardGap + 46;
      const cv = document.createElement("canvas"); cv.width = W * dpr; cv.height = H * dpr;
      const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
      ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = col.text; ctx.font = "700 26px -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText(`NFL Standings · ${state.season}`, M, 44);
      ctx.fillStyle = col.muted; ctx.font = "400 14px -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText("Regular season · ranked by win %, then point differential", M, 66);
      const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
      const logos = {};
      await Promise.all(divs.flatMap((d) => st[d].map(async (r) => { logos[r.team] = await loadImg(logo(r.team)); })));
      divs.forEach((d, i) => {
        const cx = M + (i < rowsCount ? 0 : 1) * (colW + colGap), cy = topPad + (i % rowsCount) * (cardH + cardGap);
        rr(cx, cy, colW, cardH, 12); ctx.fillStyle = col.panel; ctx.fill(); ctx.strokeStyle = col.line; ctx.lineWidth = 1; ctx.stroke();
        rr(cx, cy, colW, headerH, 12); ctx.fillStyle = col.panel2; ctx.fill();
        ctx.fillStyle = col.muted; ctx.font = "700 12px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText(d.toUpperCase(), cx + 14, cy + 22);
        st[d].forEach((r, j) => {
          const ry = cy + headerH + j * rowH;
          if (j) { ctx.strokeStyle = col.line; ctx.beginPath(); ctx.moveTo(cx + 12, ry); ctx.lineTo(cx + colW - 12, ry); ctx.stroke(); }
          const im = logos[r.team]; if (im) ctx.drawImage(im, cx + 14, ry + 7, 28, 28);
          ctx.fillStyle = col.text; ctx.font = "600 15px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText(teamMeta(r.team).name, cx + 52, ry + 27);
          ctx.textAlign = "right"; ctx.fillStyle = col.text; ctx.font = "600 14px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText(`${r.w}-${r.l}${r.t ? "-" + r.t : ""}`, cx + colW - 66, ry + 27);
          ctx.fillStyle = r.pd >= 0 ? col.good : col.bad; ctx.font = "600 13px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText(`${r.pd >= 0 ? "+" : ""}${r.pd}`, cx + colW - 16, ry + 27);
          ctx.textAlign = "left";
        });
      });
      ctx.fillStyle = col.muted; ctx.font = "600 13px -apple-system, Segoe UI, Roboto, sans-serif"; ctx.fillText("nflverse data", M, H - 18);
      ctx.textAlign = "right"; ctx.fillText("@mikeapter", W - M, H - 18); ctx.textAlign = "left";
      cv.toBlob((blob) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `nfl-standings-${state.season}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, "image/png");
    } finally { btn.disabled = false; btn.textContent = "⬇ Save PNG"; }
  }

  // Set theme before first paint: saved choice, else system preference.
  (function initTheme() {
    let stored = null; try { stored = localStorage.getItem("nflg-theme"); } catch (e) {}
    const sys = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    applyTheme(stored || sys);
  })();

  boot();
})();
