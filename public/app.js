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
    playerX: "attempts", playerY: "passing_epa", playerSet: "Passing", playerQual: true,
    team: null, focus: null, searchIndex: {},
  };
  const charts = {};

  // ---- Stat catalogs ------------------------------------------------------
  // {k: key, l: label, hi: higher-is-better, d: decimals, fn: derive(entity)}
  const TEAM_STATS = [
    { k: "off_epa", l: "Offense EPA/play", hi: true, d: 3 },
    { k: "def_epa", l: "Defense EPA/play", hi: false, d: 3 },
    { k: "pf", l: "Points for", hi: true },
    { k: "pa", l: "Points against", hi: false },
    { k: "pd", l: "Point differential", hi: true },
    { k: "w", l: "Wins", hi: true },
    { k: "total_yards", l: "Total yards", hi: true, fn: (t) => (t.passing_yards || 0) + (t.rushing_yards || 0) },
    { k: "passing_yards", l: "Passing yards", hi: true },
    { k: "rushing_yards", l: "Rushing yards", hi: true },
    { k: "passing_tds", l: "Passing TDs", hi: true },
    { k: "rushing_tds", l: "Rushing TDs", hi: true },
    { k: "passing_epa", l: "Passing EPA (total)", hi: true, d: 1 },
    { k: "rushing_epa", l: "Rushing EPA (total)", hi: true, d: 1 },
    { k: "passing_first_downs", l: "Passing 1st downs", hi: true },
    { k: "rushing_first_downs", l: "Rushing 1st downs", hi: true },
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
    Offense: ["off_epa", "pf", "passing_yards", "rushing_yards", "passing_tds", "rushing_tds"],
    Defense: ["def_epa", "pa", "def_sacks", "def_interceptions", "def_pass_defended", "def_tds"],
    Overall: ["off_epa", "def_epa", "pd", "w", "total_yards"],
  };

  const PLAYER_STATS = [
    { k: "passing_yards", l: "Passing yards", hi: true },
    { k: "passing_tds", l: "Passing TDs", hi: true },
    { k: "passing_epa", l: "Passing EPA", hi: true, d: 1 },
    { k: "passing_cpoe", l: "CPOE", hi: true, d: 2 },
    { k: "passing_interceptions", l: "Interceptions", hi: false },
    { k: "cmp_pct", l: "Completion %", hi: true, d: 1, fn: (p) => p.attempts ? 100 * p.completions / p.attempts : null },
    { k: "ypa", l: "Yards / attempt", hi: true, d: 2, fn: (p) => p.attempts ? p.passing_yards / p.attempts : null },
    { k: "attempts", l: "Pass attempts", hi: true },
    { k: "completions", l: "Completions", hi: true },
    { k: "passing_air_yards", l: "Air yards (passing)", hi: true },
    { k: "sacks_suffered", l: "Sacks taken", hi: false },
    { k: "carries", l: "Carries", hi: true },
    { k: "rushing_yards", l: "Rushing yards", hi: true },
    { k: "rushing_tds", l: "Rushing TDs", hi: true },
    { k: "rushing_epa", l: "Rushing EPA", hi: true, d: 1 },
    { k: "ypc", l: "Yards / carry", hi: true, d: 2, fn: (p) => p.carries ? p.rushing_yards / p.carries : null },
    { k: "rushing_first_downs", l: "Rush 1st downs", hi: true },
    { k: "targets", l: "Targets", hi: true },
    { k: "receptions", l: "Receptions", hi: true },
    { k: "receiving_yards", l: "Receiving yards", hi: true },
    { k: "receiving_tds", l: "Receiving TDs", hi: true },
    { k: "receiving_epa", l: "Receiving EPA", hi: true, d: 1 },
    { k: "ypr", l: "Yards / reception", hi: true, d: 2, fn: (p) => p.receptions ? p.receiving_yards / p.receptions : null },
    { k: "catch_pct", l: "Catch %", hi: true, d: 1, fn: (p) => p.targets ? 100 * p.receptions / p.targets : null },
    { k: "ypt", l: "Yards / target", hi: true, d: 2, fn: (p) => p.targets ? p.receiving_yards / p.targets : null },
    { k: "target_share", l: "Target share", hi: true, d: 3 },
    { k: "air_yards_share", l: "Air yards share", hi: true, d: 3 },
    { k: "wopr", l: "WOPR", hi: true, d: 2 },
    { k: "racr", l: "RACR", hi: true, d: 2 },
    { k: "receiving_yards_after_catch", l: "Yards after catch", hi: true },
    { k: "fantasy_points", l: "Fantasy points", hi: true, d: 1 },
    { k: "fantasy_points_ppr", l: "Fantasy points (PPR)", hi: true, d: 1 },
    { k: "games", l: "Games played", hi: true },
  ];
  const PLAYER_SETS = {
    Passing: ["passing_yards", "passing_tds", "passing_epa", "cmp_pct", "ypa", "passing_cpoe"],
    Rushing: ["rushing_yards", "rushing_tds", "rushing_epa", "ypc", "carries"],
    Receiving: ["receiving_yards", "receptions", "receiving_tds", "receiving_epa", "ypr", "target_share"],
    Fantasy: ["fantasy_points_ppr", "fantasy_points", "passing_tds", "rushing_tds", "receiving_tds"],
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

    // theme
    setToggleIcon();
    $("#theme-toggle").addEventListener("click", () => applyTheme(theme === "dark" ? "light" : "dark"));

    // Team builder
    fillSelect($("#team-x"), TEAM_STATS, state.teamX);
    fillSelect($("#team-y"), TEAM_STATS, state.teamY);
    fillSelect($("#team-rank"), TEAM_STATS, state.teamRank);
    fillSets($("#team-set"), TEAM_SETS, state.teamSet);
    segmented("#team-chart", (v) => { state.teamChart = v; teamControls(); renderTeams(); });
    $("#team-x").addEventListener("change", (e) => { state.teamX = e.target.value; renderTeams(); });
    $("#team-y").addEventListener("change", (e) => { state.teamY = e.target.value; renderTeams(); });
    $("#team-rank").addEventListener("change", (e) => { state.teamRank = e.target.value; renderTeams(); });
    $("#team-set").addEventListener("change", (e) => { state.teamSet = e.target.value; renderTeams(); });

    // Player builder
    fillSelect($("#player-rank"), PLAYER_STATS, state.playerRank);
    fillSelect($("#player-x"), PLAYER_STATS, state.playerX);
    fillSelect($("#player-y"), PLAYER_STATS, state.playerY);
    fillSets($("#player-set"), PLAYER_SETS, state.playerSet);
    segmented("#player-pos", (v) => { applyPlayerDefaults(v); renderPlayers(); });
    segmented("#player-chart", (v) => { state.playerChart = v; playerControls(); renderPlayers(); });
    $("#player-rank").addEventListener("change", (e) => { state.playerRank = e.target.value; renderPlayers(); });
    $("#player-x").addEventListener("change", (e) => { state.playerX = e.target.value; renderPlayers(); });
    $("#player-y").addEventListener("change", (e) => { state.playerY = e.target.value; renderPlayers(); });
    $("#player-set").addEventListener("change", (e) => { state.playerSet = e.target.value; renderPlayers(); });
    $("#player-qual").addEventListener("change", (e) => { state.playerQual = e.target.checked; renderPlayers(); });

    // Standings / scores / trends
    $("#week-select").addEventListener("change", renderScores);
    $("#team-select").addEventListener("change", () => { state.team = $("#team-select").value; renderTrends(); });
    $("#standings-save").addEventListener("click", exportStandings);

    // Search
    $("#global-search").addEventListener("change", onSearch);
    $("#search-clear").addEventListener("click", clearSearch);

    teamControls();
    playerControls();
    await loadSeason(state.meta.latest);
  }

  function fillSelect(el, stats, selected) {
    el.innerHTML = stats.map((s) => `<option value="${s.k}">${s.l}</option>`).join("");
    el.value = selected;
  }
  function fillSets(el, sets, selected) {
    el.innerHTML = Object.keys(sets).map((k) => `<option value="${k}">${k}</option>`).join("");
    el.value = selected;
  }
  function segmented(sel, cb) {
    $$(sel + " .seg").forEach((b) => b.addEventListener("click", () => {
      $$(sel + " .seg").forEach((x) => x.classList.toggle("active", x === b));
      cb(b.dataset.type || b.dataset.pos);
    }));
  }
  function toggleRoles(builderSel, roles) {
    $$(builderSel + " .ctl[data-role]").forEach((c) => { c.hidden = !roles.includes(c.dataset.role); });
  }
  const teamControls = () => toggleRoles("#view-teams .builder",
    state.teamChart === "scatter" ? ["x", "y"] : state.teamChart === "bar" ? ["rank"] : ["set"]);
  const playerControls = () => toggleRoles("#view-players .builder",
    state.playerChart === "scatter" ? ["x", "y"] : state.playerChart === "bar" ? ["rank"] : ["set"]);

  async function loadSeason(season) {
    state.season = season;
    state.data = await (await fetch(`./data/season_${season}.json`)).json();

    const teams = Object.keys(state.meta.teams).sort((a, b) => teamMeta(a).name.localeCompare(teamMeta(b).name));
    $("#team-select").innerHTML = teams.filter((a) => state.data.trends[a])
      .map((a) => `<option value="${a}">${teamMeta(a).name}</option>`).join("");
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

  function ec(id) {
    if (!charts[id]) {
      const el = document.getElementById(id);
      const chart = echarts.init(el, null, { renderer: "canvas" });
      charts[id] = chart;
      if (window.ResizeObserver) {
        let raf = 0;
        new ResizeObserver(() => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => { if (el.clientWidth) chart.resize(); });
        }).observe(el);
      }
    }
    return charts[id];
  }

  const signed = (v, d = 3) => (v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(d));

  function chartExtras(name) {
    return {
      toolbox: {
        right: 8, top: 6, itemSize: 16, itemGap: 8,
        iconStyle: { borderColor: AXIS }, emphasis: { iconStyle: { borderColor: TEXT } },
        feature: { saveAsImage: { title: "Save PNG", name: name, pixelRatio: 2, backgroundColor: BG } },
      },
      graphic: [{
        type: "text", right: 12, bottom: 8, z: 12, silent: true,
        style: { text: "@mikeapter", fill: AXIS, opacity: 0.55, fontSize: 12, fontWeight: 600 },
      }],
    };
  }
  const axisCommon = () => ({ axisLine: { lineStyle: { color: LINE } }, axisLabel: { color: AXIS }, splitLine: { lineStyle: { color: LINE } } });

  // ---- Teams explorer -----------------------------------------------------
  function renderTeams() {
    const rows = state.data.teams;
    const c = state.teamChart;
    $("#team-hint").textContent =
      c === "scatter" ? "Each logo is a team · up / right = better · dashed lines = league average" :
      c === "bar" ? "All 32 teams ranked · best at top" :
      "Teams × stats · color shows how good each value is (teal = better, red = worse)";
    if (c === "scatter") teamScatter(rows);
    else if (c === "bar") teamBar(rows);
    else heatmap("team-chart-el", rows, (t) => t.team, (t) => t.team, TEAM_SETS[state.teamSet], TSTAT, "teams-heatmap");
  }

  function teamScatter(rows) {
    const sx = TSTAT[state.teamX], sy = TSTAT[state.teamY];
    const pts = rows.map((t) => ({ x: pval(t, sx), y: pval(t, sy), team: t.team }))
      .filter((p) => p.x != null && p.y != null);
    const ax = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const ay = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const data = pts.map((p) => ({
      value: [p.x, p.y], name: p.team,
      symbol: logo(p.team) ? "image://" + logo(p.team) : "circle",
      symbolSize: state.focus && state.focus.type === "team" && state.focus.id === p.team ? 42 : 28,
      label: state.focus && state.focus.type === "team" && state.focus.id === p.team
        ? { show: true, position: "top", formatter: p.team, color: TEXT, fontWeight: 700 } : { show: false },
    }));
    ec("team-chart-el").setOption({
      backgroundColor: "transparent",
      ...chartExtras(`nfl-teams-${sx.k}-vs-${sy.k}-${state.season}`),
      grid: { left: 64, right: 26, top: 26, bottom: 54 },
      tooltip: {
        trigger: "item", backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT },
        formatter: (p) => `<b>${teamMeta(p.name).name}</b><br/>${sx.l}: ${pfmt(p.value[0], sx)}<br/>${sy.l}: ${pfmt(p.value[1], sy)}`,
      },
      xAxis: { ...axisCommon(), name: sx.l, nameLocation: "middle", nameGap: 32, nameTextStyle: { color: AXIS }, inverse: !sx.hi, scale: true },
      yAxis: { ...axisCommon(), name: sy.l, nameLocation: "middle", nameGap: 46, nameTextStyle: { color: AXIS }, inverse: !sy.hi, scale: true },
      series: [{
        type: "scatter", data,
        markLine: { silent: true, symbol: "none", lineStyle: { color: "#5a6a86", type: "dashed", opacity: 0.7 }, label: { show: false }, data: [{ xAxis: ax }, { yAxis: ay }] },
      }],
    }, true);
  }

  function teamBar(rows) {
    const s = TSTAT[state.teamRank];
    const list = rows.map((t) => ({ team: t.team, v: pval(t, s) })).filter((r) => r.v != null)
      .sort((a, b) => s.hi ? a.v - b.v : b.v - a.v); // best ends up on top (category axis is bottom-up)
    ec("team-chart-el").setOption({
      backgroundColor: "transparent",
      ...chartExtras(`nfl-teams-rank-${s.k}-${state.season}`),
      grid: { left: 54, right: 60, top: 26, bottom: 20 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (ps) => `${teamMeta(ps[0].name).name}<br/>${s.l}: ${pfmt(ps[0].value, s)}` },
      xAxis: { ...axisCommon(), type: "value" },
      yAxis: { type: "category", data: list.map((r) => r.team), axisLine: { lineStyle: { color: LINE } }, axisLabel: { color: TEXT, fontSize: 10 } },
      series: [{
        type: "bar", data: list.map((r) => ({ value: r.v, itemStyle: { color: color(r.team), borderRadius: [0, 4, 4, 0] } })),
        label: { show: true, position: "right", color: AXIS, formatter: (p) => pfmt(p.value, s) }, barMaxWidth: 13,
      }],
    }, true);
  }

  // ---- Players explorer ---------------------------------------------------
  const POS_MATCH = {
    QB: (p) => p.pos === "QB", RB: (p) => p.pos === "RB" || p.pos === "FB",
    WR: (p) => p.pos === "WR", TE: (p) => p.pos === "TE",
    SKILL: (p) => ["RB", "FB", "WR", "TE"].includes(p.pos),
  };
  // Sensible stat defaults per position so switching position never leaves a
  // nonsense pairing (e.g. WRs ranked by passing yards).
  const POS_DEFAULTS = {
    QB: { rank: "passing_yards", x: "attempts", y: "passing_epa", set: "Passing" },
    RB: { rank: "rushing_yards", x: "carries", y: "rushing_epa", set: "Rushing" },
    WR: { rank: "receiving_yards", x: "targets", y: "receiving_epa", set: "Receiving" },
    TE: { rank: "receiving_yards", x: "targets", y: "receiving_epa", set: "Receiving" },
    SKILL: { rank: "fantasy_points_ppr", x: "rushing_yards", y: "receiving_yards", set: "Fantasy" },
  };
  function applyPlayerDefaults(pos) {
    const d = POS_DEFAULTS[pos] || POS_DEFAULTS.QB;
    state.playerPos = pos;
    state.playerRank = d.rank; state.playerX = d.x; state.playerY = d.y; state.playerSet = d.set;
    $("#player-rank").value = d.rank; $("#player-x").value = d.x; $("#player-y").value = d.y; $("#player-set").value = d.set;
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
      c === "bar" ? "Top 15 by the selected stat · colored by team" :
      c === "scatter" ? "Every qualified player · colored by team · hover for names" :
      "Top 20 players × stats · teal = better, red = worse";
    if (c === "bar") playerBar(list);
    else if (c === "scatter") playerScatter(list);
    else {
      const stats = PLAYER_SETS[state.playerSet];
      const primary = PSTAT[stats[0]];
      const top = list.slice().map((p) => ({ p, v: pval(p, primary) })).filter((r) => r.v != null)
        .sort((a, b) => b.v - a.v).slice(0, 20).map((r) => r.p);
      heatmap("player-chart-el", top, (p) => p.player, (p) => `${p.player} (${p.team})`, stats, PSTAT, "players-heatmap");
    }
    renderPlayerTable(list);
  }

  function playerBar(list) {
    const s = PSTAT[state.playerRank];
    const rows = list.map((p) => ({ p, v: pval(p, s) })).filter((r) => r.v != null)
      .sort((a, b) => s.hi ? b.v - a.v : a.v - b.v).slice(0, 15).reverse();
    ec("player-chart-el").setOption({
      backgroundColor: "transparent",
      ...chartExtras(`nfl-players-${state.playerPos}-${s.k}-${state.season}`),
      grid: { left: 140, right: 46, top: 26, bottom: 20 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (ps) => `${ps[0].name}<br/>${s.l}: ${pfmt(ps[0].value, s)}` },
      xAxis: { ...axisCommon(), type: "value" },
      yAxis: { type: "category", data: rows.map((r) => r.p.player), axisLine: { lineStyle: { color: LINE } }, axisLabel: { color: TEXT, fontSize: 11 } },
      series: [{
        type: "bar", data: rows.map((r) => ({ value: r.v, itemStyle: { color: color(r.p.team), borderRadius: [0, 4, 4, 0] } })),
        label: { show: true, position: "right", color: AXIS, formatter: (p) => pfmt(p.value, s) }, barMaxWidth: 22,
      }],
    }, true);
  }

  function playerScatter(list) {
    const sx = PSTAT[state.playerX], sy = PSTAT[state.playerY];
    const pts = list.map((p) => ({ x: pval(p, sx), y: pval(p, sy), p })).filter((o) => o.x != null && o.y != null);
    const foc = state.focus && state.focus.type === "player" ? state.focus.id : null;
    ec("player-chart-el").setOption({
      backgroundColor: "transparent",
      ...chartExtras(`nfl-players-${state.playerPos}-${sx.k}-vs-${sy.k}-${state.season}`),
      grid: { left: 60, right: 26, top: 26, bottom: 52 },
      tooltip: { trigger: "item", backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (o) => `<b>${o.data.pl}</b> (${o.data.tm})<br/>${sx.l}: ${pfmt(o.value[0], sx)}<br/>${sy.l}: ${pfmt(o.value[1], sy)}` },
      xAxis: { ...axisCommon(), name: sx.l, nameLocation: "middle", nameGap: 32, nameTextStyle: { color: AXIS }, inverse: !sx.hi, scale: true },
      yAxis: { ...axisCommon(), name: sy.l, nameLocation: "middle", nameGap: 46, nameTextStyle: { color: AXIS }, inverse: !sy.hi, scale: true },
      series: [{
        type: "scatter", symbolSize: 11,
        data: pts.map((o) => {
          const isFoc = o.p.player === foc;
          return {
            value: [o.x, o.y], pl: o.p.player, tm: o.p.team,
            itemStyle: { color: color(o.p.team), borderColor: isFoc ? TEXT : "transparent", borderWidth: isFoc ? 2 : 0, opacity: foc && !isFoc ? 0.5 : 0.95 },
            symbolSize: isFoc ? 18 : 11,
            label: isFoc ? { show: true, position: "top", formatter: o.p.player, color: TEXT, fontWeight: 700 } : { show: false },
          };
        }),
      }],
    }, true);
  }

  function renderPlayerTable(list) {
    const s = PSTAT[state.playerRank];
    const setKey = state.playerChart === "heatmap" ? state.playerSet
      : (state.playerPos === "QB" ? "Passing" : state.playerPos === "RB" ? "Rushing" : "Receiving");
    const cols = Array.from(new Set([state.playerRank, ...PLAYER_SETS[setKey]])).slice(0, 6).map((k) => PSTAT[k]);
    const sorted = list.slice().map((p) => ({ p, v: pval(p, s) })).filter((r) => r.v != null)
      .sort((a, b) => s.hi ? b.v - a.v : a.v - b.v);
    const head = `<thead><tr><th class="rank">#</th><th>Player</th><th>Tm</th><th>Pos</th>${cols.map((c) => `<th>${c.l}</th>`).join("")}<th>G</th></tr></thead>`;
    const foc = state.focus && state.focus.type === "player" ? state.focus.id : null;
    const body = sorted.map((r, i) => `<tr${r.p.player === foc ? ' class="hl"' : ""}>
      <td class="rank">${i + 1}</td><td class="pname">${r.p.player}</td>
      <td class="pteam">${r.p.team || ""}</td><td class="pteam">${r.p.pos || ""}</td>
      ${cols.map((c) => `<td>${pfmt(pval(r.p, c), c)}</td>`).join("")}
      <td>${r.p.games ?? ""}</td></tr>`).join("");
    $("#player-table").innerHTML = head + `<tbody>${body}</tbody>`;
    const hl = $("#player-table .hl");
    if (hl) hl.scrollIntoView({ block: "nearest" });
  }

  // ---- Heatmap (shared) ---------------------------------------------------
  function heatmap(elId, entities, nameFn, longNameFn, statKeys, statMap, fileprefix) {
    const stats = statKeys.map((k) => statMap[k]);
    // z-score per column, oriented so positive = better
    const cols = stats.map((s) => {
      const vals = entities.map((e) => pval(e, s)).filter((v) => v != null);
      const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length || 1)) || 1;
      return { s, mean, sd };
    });
    const data = [];
    entities.forEach((e, yi) => stats.forEach((s, xi) => {
      const raw = pval(e, s);
      if (raw == null) return;
      const z = (raw - cols[xi].mean) / cols[xi].sd * (s.hi ? 1 : -1);
      data.push({ value: [xi, entities.length - 1 - yi, +z.toFixed(3)], raw, ent: longNameFn(e), lab: s.l, s });
    }));
    ec(elId).setOption({
      backgroundColor: "transparent",
      ...chartExtras(`nfl-${fileprefix}-${state.season}`),
      grid: { left: 130, right: 20, top: 30, bottom: 60 },
      tooltip: { backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (p) => `<b>${p.data.ent}</b><br/>${p.data.lab}: ${pfmt(p.data.raw, p.data.s)}` },
      xAxis: { type: "category", data: stats.map((s) => s.l), position: "top", axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: AXIS, interval: 0, fontSize: 10, rotate: 0, overflow: "break", width: 70 } },
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
        ${st[d].map((r) => `<div class="divrow">
          <img src="${logo(r.team)}" alt="" loading="lazy"/>
          <span class="tname">${teamMeta(r.team).name}</span>
          <span class="rec">${r.w}-${r.l}${r.t ? "-" + r.t : ""}</span>
          <span class="pd ${r.pd >= 0 ? "pos" : "neg"}">${r.pd >= 0 ? "+" : ""}${r.pd}</span>
        </div>`).join("")}
      </div>`).join("");
  }
  function renderScores() {
    const wk = $("#week-select").value;
    const games = (state.data.scores[wk] || []).slice();
    $("#scores").innerHTML = games.map((g) => {
      const awin = g.as > g.hs, hwin = g.hs > g.as;
      const side = (t, s, win, lose) => `<div class="gteam ${win ? "win" : lose ? "lose" : ""}">
        <img src="${logo(t)}" alt="" loading="lazy"/><span class="gt-name">${t}</span><span class="gt-score">${s}</span></div>`;
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
    const t = state.data.trends[state.team];
    if (!t) return;
    const c = color(state.team);
    ec("trend-pd").setOption({
      backgroundColor: "transparent",
      ...chartExtras(`nfl-${state.team}-pointdiff-${state.season}`),
      title: { text: teamMeta(state.team).name + " — weekly point differential", left: 8, top: 4, textStyle: { color: TEXT, fontSize: 13, fontWeight: 600 } },
      grid: { left: 44, right: 20, top: 40, bottom: 30 },
      tooltip: { trigger: "axis", backgroundColor: TIP, borderColor: LINE, textStyle: { color: TEXT }, formatter: (ps) => { const p = ps[0]; return `Week ${p.axisValue}<br/>${t.result[p.dataIndex]} · ${p.value >= 0 ? "+" : ""}${p.value}`; } },
      xAxis: { ...axisCommon(), type: "category", data: t.weeks },
      yAxis: { ...axisCommon(), type: "value" },
      series: [{ type: "bar", data: t.pd.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? c : "#f87171", borderRadius: v >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3] } })), barMaxWidth: 26 }],
    }, true);
    const hasEpa = t.off_epa && t.epa_weeks;
    ec("trend-epa").setOption({
      backgroundColor: "transparent",
      ...chartExtras(`nfl-${state.team}-epa-${state.season}`),
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
      idx[label.toLowerCase()] = { type: "team", id: a };
      idx[a.toLowerCase()] = { type: "team", id: a };
      opts.push(label);
    });
    const seen = new Set();
    state.data.players.forEach((p) => {
      if (!p.player || seen.has(p.player)) return;
      seen.add(p.player);
      const label = `${p.player} — ${p.pos || ""} ${p.team || ""}`.trim();
      idx[label.toLowerCase()] = { type: "player", id: p.player, pos: p.pos };
      idx[p.player.toLowerCase()] = { type: "player", id: p.player, pos: p.pos };
      opts.push(label);
    });
    state.searchIndex = idx;
    $("#search-options").innerHTML = opts.map((o) => `<option value="${o.replace(/"/g, "&quot;")}"></option>`).join("");
  }
  function onSearch(e) {
    const q = (e.target.value || "").trim().toLowerCase();
    if (!q) return;
    const hit = state.searchIndex[q] || Object.entries(state.searchIndex).find(([k]) => k.startsWith(q) || k.includes(q));
    const match = Array.isArray(hit) ? hit[1] : hit;
    if (!match) return;
    $("#search-clear").hidden = false;
    if (match.type === "team") {
      state.focus = { type: "team", id: match.id };
      showView("teams");
      renderTeams();
    } else {
      state.focus = { type: "player", id: match.id };
      const pos = ["QB", "RB", "WR", "TE"].includes(match.pos) ? match.pos : "SKILL";
      applyPlayerDefaults(pos);
      $$("#player-pos .seg").forEach((b) => b.classList.toggle("active", b.dataset.pos === pos));
      // ensure the player is visible even if below the qualifier threshold
      state.playerQual = false; $("#player-qual").checked = false;
      showView("players");
      renderPlayers();
    }
  }
  function clearSearch() {
    state.focus = null;
    $("#global-search").value = "";
    $("#search-clear").hidden = true;
    renderTeams(); renderPlayers();
  }

  // ---- Standings PNG export ----------------------------------------------
  const imgCache = {};
  function loadImg(src) {
    return imgCache[src] || (imgCache[src] = new Promise((res) => {
      const im = new Image(); im.crossOrigin = "anonymous";
      im.onload = () => res(im); im.onerror = () => res(null); im.src = src;
    }));
  }
  async function exportStandings() {
    const btn = $("#standings-save");
    btn.disabled = true; btn.textContent = "Rendering…";
    try {
      const cs = getComputedStyle(document.documentElement);
      const C = (n, f) => (cs.getPropertyValue(n).trim() || f);
      const col = { bg: C("--bg", BG), panel: C("--panel", "#131a26"), panel2: C("--panel-2", "#1a2233"), line: C("--line", LINE), text: C("--text", TEXT), muted: C("--muted", AXIS), good: C("--good", "#34d399"), bad: C("--bad", "#f87171") };
      const st = state.data.standings;
      const divs = DIV_ORDER.filter((d) => st[d]);
      const dpr = 2, W = 1040, M = 28, colGap = 20, colW = (W - 2 * M - colGap) / 2;
      const topPad = 84, headerH = 34, rowH = 42, cardGap = 20;
      const cardH = headerH + 4 * rowH;
      const rowsCount = Math.ceil(divs.length / 2);
      const H = topPad + rowsCount * cardH + (rowsCount - 1) * cardGap + 46;

      const cv = document.createElement("canvas");
      cv.width = W * dpr; cv.height = H * dpr;
      const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
      ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, H);
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = col.text; ctx.font = "700 26px -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText(`NFL Standings · ${state.season}`, M, 44);
      ctx.fillStyle = col.muted; ctx.font = "400 14px -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText("Regular season · ranked by win %, then point differential", M, 66);

      const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };

      // preload logos
      const logos = {};
      await Promise.all(divs.flatMap((d) => st[d].map(async (r) => { logos[r.team] = await loadImg(logo(r.team)); })));

      divs.forEach((d, i) => {
        const cx = M + (i < rowsCount ? 0 : 1) * (colW + colGap);
        const cy = topPad + (i % rowsCount) * (cardH + cardGap);
        rr(cx, cy, colW, cardH, 12); ctx.fillStyle = col.panel; ctx.fill();
        ctx.strokeStyle = col.line; ctx.lineWidth = 1; ctx.stroke();
        rr(cx, cy, colW, headerH, 12); ctx.fillStyle = col.panel2; ctx.fill();
        ctx.fillStyle = col.muted; ctx.font = "700 12px -apple-system, Segoe UI, Roboto, sans-serif";
        ctx.fillText(d.toUpperCase(), cx + 14, cy + 22);
        st[d].forEach((r, j) => {
          const ry = cy + headerH + j * rowH;
          if (j) { ctx.strokeStyle = col.line; ctx.beginPath(); ctx.moveTo(cx + 12, ry); ctx.lineTo(cx + colW - 12, ry); ctx.stroke(); }
          const im = logos[r.team]; if (im) ctx.drawImage(im, cx + 14, ry + 7, 28, 28);
          ctx.fillStyle = col.text; ctx.font = "600 15px -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(teamMeta(r.team).name, cx + 52, ry + 27);
          ctx.textAlign = "right";
          ctx.fillStyle = col.text; ctx.font = "600 14px -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(`${r.w}-${r.l}${r.t ? "-" + r.t : ""}`, cx + colW - 66, ry + 27);
          ctx.fillStyle = r.pd >= 0 ? col.good : col.bad; ctx.font = "600 13px -apple-system, Segoe UI, Roboto, sans-serif";
          ctx.fillText(`${r.pd >= 0 ? "+" : ""}${r.pd}`, cx + colW - 16, ry + 27);
          ctx.textAlign = "left";
        });
      });

      ctx.fillStyle = col.muted; ctx.font = "600 13px -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText("nflverse data", M, H - 18);
      ctx.textAlign = "right"; ctx.fillText("@mikeapter", W - M, H - 18); ctx.textAlign = "left";

      cv.toBlob((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = `nfl-standings-${state.season}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }, "image/png");
    } finally {
      btn.disabled = false; btn.textContent = "⬇ Save PNG";
    }
  }

  // Set theme before first paint: saved choice, else system preference.
  (function initTheme() {
    let stored = null;
    try { stored = localStorage.getItem("nflg-theme"); } catch (e) {}
    const sys = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    applyTheme(stored || sys);
  })();

  boot();
})();
