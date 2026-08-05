/* NFL Graphs — static app. Loads prebuilt JSON, renders ECharts. */
(() => {
  "use strict";

  const AXIS = "#93a1b8", LINE = "#263145", TEXT = "#e8edf6";
  const state = { meta: null, season: null, data: null, leaderCat: "passing", team: null };
  const charts = {}; // id -> echarts instance
  const $ = (s) => document.querySelector(s);

  const teamMeta = (a) => (state.meta && state.meta.teams[a]) || { name: a, color: "#888", logo: "" };
  const color = (a) => teamMeta(a).color;
  const logo = (a) => teamMeta(a).logo;

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

    // tabs
    document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showView(t.dataset.view)));
    // leader category
    document.querySelectorAll("#leader-cat .seg").forEach((b) =>
      b.addEventListener("click", () => { setLeaderCat(b.dataset.cat); }));
    $("#leader-stat").addEventListener("change", renderLeaders);
    $("#week-select").addEventListener("change", renderScores);
    $("#team-select").addEventListener("change", () => { state.team = $("#team-select").value; renderTrends(); });
    window.addEventListener("resize", () => Object.values(charts).forEach((c) => c.resize()));

    await loadSeason(state.meta.latest);
  }

  async function loadSeason(season) {
    state.season = season;
    state.data = await (await fetch(`./data/season_${season}.json`)).json();
    // populate team + week selectors
    const teams = Object.keys(state.meta.teams).sort((a, b) => teamMeta(a).name.localeCompare(teamMeta(b).name));
    $("#team-select").innerHTML = teams
      .filter((a) => state.data.trends[a])
      .map((a) => `<option value="${a}">${teamMeta(a).name}</option>`).join("");
    if (!state.team || !state.data.trends[state.team]) state.team = $("#team-select").value;
    $("#team-select").value = state.team;

    const weeks = Object.keys(state.data.scores).sort(weekOrder);
    $("#week-select").innerHTML = weeks.map((w) => `<option value="${w}">${weekLabel(w)}</option>`).join("");
    $("#week-select").value = weeks[weeks.length - 1];

    // render active view (others render lazily on show)
    const active = document.querySelector(".tab.active").dataset.view;
    renderAll();
    showView(active);
  }

  function renderAll() { renderEPA(); renderLeaders(); renderStandings(); renderScores(); renderTrends(); }

  function showView(view) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    // ECharts must resize once its container is visible
    requestAnimationFrame(() => Object.values(charts).forEach((c) => c.resize()));
  }

  function ec(id) {
    if (!charts[id]) {
      const el = document.getElementById(id);
      const chart = echarts.init(el, null, { renderer: "canvas" });
      charts[id] = chart;
      // Keep the chart sized to its container (handles hidden→visible tabs,
      // phone rotation, and any late layout).
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

  const fmt = (v, d = 3) => (v == null ? "—" : (typeof v === "number" ? v.toFixed(d) : v));
  const signed = (v, d = 3) => (v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(d));

  // ---- Team Efficiency (EPA scatter) --------------------------------------
  function renderEPA() {
    const rows = state.data.team_epa.filter((t) => t.def_epa != null);
    const avgOff = rows.reduce((s, t) => s + t.off_epa, 0) / rows.length;
    const avgDef = rows.reduce((s, t) => s + t.def_epa, 0) / rows.length;
    const data = rows.map((t) => ({
      value: [t.off_epa, t.def_epa],
      name: t.team,
      symbol: logo(t.team) ? "image://" + logo(t.team) : "circle",
      symbolSize: 30,
    }));
    ec("epa-chart").setOption({
      backgroundColor: "transparent",
      grid: { left: 58, right: 24, top: 26, bottom: 52 },
      tooltip: {
        trigger: "item",
        backgroundColor: "#0f1622", borderColor: LINE, textStyle: { color: TEXT },
        formatter: (p) => `<b>${teamMeta(p.name).name}</b><br/>Off EPA/play: ${signed(p.value[0])}<br/>Def EPA/play: ${signed(p.value[1])}`,
      },
      xAxis: {
        name: "Offense  →  better", nameLocation: "middle", nameGap: 30, nameTextStyle: { color: AXIS },
        splitLine: { lineStyle: { color: LINE } }, axisLine: { lineStyle: { color: LINE } },
        axisLabel: { color: AXIS, formatter: (v) => v.toFixed(2) },
      },
      yAxis: {
        name: "better  ←  Defense", nameLocation: "middle", nameGap: 42, nameTextStyle: { color: AXIS },
        inverse: true, // lower EPA allowed = better defense = top
        splitLine: { lineStyle: { color: LINE } }, axisLine: { lineStyle: { color: LINE } },
        axisLabel: { color: AXIS, formatter: (v) => v.toFixed(2) },
      },
      series: [{
        type: "scatter", data,
        markLine: {
          silent: true, symbol: "none", lineStyle: { color: "#3a4a66", type: "dashed" },
          label: { show: false },
          data: [{ xAxis: avgOff }, { yAxis: avgDef }],
        },
      }],
    }, true);
  }

  // ---- Player Leaders ------------------------------------------------------
  const STAT_MENUS = {
    passing: [["Passing yards", "yards"], ["Passing TDs", "tds"], ["EPA", "epa"], ["CPOE", "cpoe"], ["Attempts", "att"]],
    rushing: [["Rushing yards", "yards"], ["Rushing TDs", "tds"], ["EPA", "epa"], ["Yards/carry", "ypc"], ["Carries", "att"]],
    receiving: [["Receiving yards", "yards"], ["Receptions", "rec"], ["Receiving TDs", "tds"], ["EPA", "epa"], ["Yards/rec", "ypr"], ["Targets", "tgt"]],
  };
  const TABLE_COLS = {
    passing: [["Yds", "yards"], ["TD", "tds"], ["INT", "int"], ["EPA", "epa"], ["CPOE", "cpoe"], ["Att", "att"]],
    rushing: [["Yds", "yards"], ["TD", "tds"], ["YPC", "ypc"], ["EPA", "epa"], ["Att", "att"]],
    receiving: [["Yds", "yards"], ["Rec", "rec"], ["TD", "tds"], ["EPA", "epa"], ["YPR", "ypr"], ["Tgt", "tgt"]],
  };

  function setLeaderCat(cat) {
    state.leaderCat = cat;
    document.querySelectorAll("#leader-cat .seg").forEach((b) => b.classList.toggle("active", b.dataset.cat === cat));
    const sel = $("#leader-stat");
    sel.innerHTML = STAT_MENUS[cat].map(([label, key]) => `<option value="${key}">${label}</option>`).join("");
    renderLeaders();
  }

  function renderLeaders() {
    const cat = state.leaderCat;
    if (!$("#leader-stat").options.length) { setLeaderCat(cat); return; }
    const key = $("#leader-stat").value || STAT_MENUS[cat][0][1];
    const rows = [...state.data.leaders[cat]]
      .filter((r) => r[key] != null)
      .sort((a, b) => b[key] - a[key])
      .slice(0, 15);

    const names = rows.map((r) => r.player).reverse();
    const vals = rows.map((r) => r[key]).reverse();
    const cols = rows.map((r) => color(r.team)).reverse();
    const decimals = ["epa", "cpoe", "ypc", "ypr"].includes(key) ? 2 : 0;

    ec("leader-chart").setOption({
      backgroundColor: "transparent",
      grid: { left: 130, right: 40, top: 10, bottom: 24 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "#0f1622", borderColor: LINE, textStyle: { color: TEXT } },
      xAxis: { type: "value", axisLabel: { color: AXIS }, splitLine: { lineStyle: { color: LINE } } },
      yAxis: { type: "category", data: names, axisLabel: { color: TEXT, fontSize: 11 }, axisLine: { lineStyle: { color: LINE } } },
      series: [{
        type: "bar", data: vals.map((v, i) => ({ value: v, itemStyle: { color: cols[i], borderRadius: [0, 4, 4, 0] } })),
        label: { show: true, position: "right", color: AXIS, formatter: (p) => p.value.toFixed(decimals) },
        barMaxWidth: 20,
      }],
    }, true);

    // table
    const tcols = TABLE_COLS[cat];
    const head = `<thead><tr><th class="rank">#</th><th>Player</th><th>Team</th>${tcols.map(([l]) => `<th>${l}</th>`).join("")}<th>G</th></tr></thead>`;
    const body = state.data.leaders[cat]
      .slice().filter((r) => r[key] != null).sort((a, b) => b[key] - a[key])
      .map((r, i) => `<tr>
        <td class="rank">${i + 1}</td>
        <td class="pname">${r.player}</td>
        <td class="pteam">${r.team || ""}</td>
        ${tcols.map(([, k]) => `<td>${cell(r[k], k)}</td>`).join("")}
        <td>${r.games}</td></tr>`).join("");
    $("#leader-table").innerHTML = head + `<tbody>${body}</tbody>`;
  }
  const cell = (v, k) => v == null ? "—" : (["epa", "cpoe", "ypc", "ypr"].includes(k) ? (+v).toFixed(2) : v);

  // ---- Standings + Scores --------------------------------------------------
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
      return `<div class="gcard">
        ${side(g.away, g.as, awin, hwin)}
        ${side(g.home, g.hs, hwin, awin)}
        <div class="gdate">${g.date || ""}</div></div>`;
    }).join("") || '<p class="hint">No games.</p>';
  }

  function weekOrder(a, b) { return weekNum(a) - weekNum(b); }
  function weekNum(w) { const m = w.match(/(\d+)/g); return m ? +m[m.length - 1] : 0; }
  function weekLabel(w) {
    if (/^\d+$/.test(w)) return "Week " + +w;
    const map = { WC: "Wild Card", DIV: "Divisional", CON: "Conf Champ", CONF: "Conf Champ", SB: "Super Bowl" };
    const r = w.split("-")[0];
    return map[r] || w;
  }

  // ---- Team Trends ---------------------------------------------------------
  function renderTrends() {
    const t = state.data.trends[state.team];
    if (!t) return;
    const c = color(state.team);

    ec("trend-pd").setOption({
      backgroundColor: "transparent",
      title: { text: teamMeta(state.team).name + " — weekly point differential", left: 8, top: 4, textStyle: { color: TEXT, fontSize: 13, fontWeight: 600 } },
      grid: { left: 44, right: 20, top: 40, bottom: 30 },
      tooltip: { trigger: "axis", backgroundColor: "#0f1622", borderColor: LINE, textStyle: { color: TEXT },
        formatter: (ps) => { const p = ps[0]; return `Week ${p.axisValue}<br/>${t.result[p.dataIndex]} · ${p.value >= 0 ? "+" : ""}${p.value}`; } },
      xAxis: { type: "category", data: t.weeks, axisLabel: { color: AXIS }, axisLine: { lineStyle: { color: LINE } } },
      yAxis: { type: "value", axisLabel: { color: AXIS }, splitLine: { lineStyle: { color: LINE } } },
      series: [{
        type: "bar", data: t.pd.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? c : "#f87171", borderRadius: v >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3] } })),
        barMaxWidth: 26,
      }],
    }, true);

    const hasEpa = t.off_epa && t.epa_weeks;
    ec("trend-epa").setOption({
      backgroundColor: "transparent",
      title: { text: "Weekly EPA per play (offense vs defense)", left: 8, top: 4, textStyle: { color: TEXT, fontSize: 13, fontWeight: 600 } },
      legend: { data: ["Offense", "Defense"], top: 6, right: 10, textStyle: { color: AXIS } },
      grid: { left: 48, right: 20, top: 40, bottom: 30 },
      tooltip: { trigger: "axis", backgroundColor: "#0f1622", borderColor: LINE, textStyle: { color: TEXT } },
      xAxis: { type: "category", data: hasEpa ? t.epa_weeks : [], axisLabel: { color: AXIS }, axisLine: { lineStyle: { color: LINE } } },
      yAxis: { type: "value", axisLabel: { color: AXIS, formatter: (v) => v.toFixed(2) }, splitLine: { lineStyle: { color: LINE } } },
      series: [
        { name: "Offense", type: "line", smooth: true, data: hasEpa ? t.off_epa : [], lineStyle: { color: c, width: 2.5 }, itemStyle: { color: c }, symbolSize: 6 },
        { name: "Defense", type: "line", smooth: true, data: hasEpa ? t.def_epa : [], lineStyle: { color: "#f87171", width: 2.5 }, itemStyle: { color: "#f87171" }, symbolSize: 6 },
      ],
    }, true);
  }

  boot();
})();
