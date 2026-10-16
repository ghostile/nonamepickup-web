"use strict";

(() => {
  const labels = { hwguy: "HWGuy", demoman: "Demoman", soldier: "Soldier", engineer: "Engineer" };
  const icons = { hwguy: "Heavy", demoman: "Demoman", soldier: "Soldier", engineer: "Engineer" };
  const classes = Object.keys(labels);
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const date = timestamp => new Date(timestamp * 1000).toLocaleString(undefined,
    { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  const initial = new URLSearchParams(location.search);
  let mode = initial.has("player") ? "player" : "match";
  let options;
  let controller;
  let requestId = 0;
  let retry = null;
  let optionsError = "";

  function status(message, error = false) {
    el("diq-status").textContent = message;
    el("diq-status").classList.toggle("is-error", error);
  }
  function setMode(next) {
    mode = next;
    controller?.abort();
    requestId++;
    for (const value of ["match", "player"]) {
      el(`mode-${value}`).setAttribute("aria-pressed", String(value === mode));
      el(`${value}-form`).hidden = value !== mode;
    }
    el("selection-note").textContent = mode === "match"
      ? "Historical reviews use only data recorded before that match."
      : "Select a player and map to estimate their next dominant defensive class.";
    el("diq-results").innerHTML = "";
    el("diq-results").setAttribute("aria-busy", "false");
    el("diq-retry").hidden = !optionsError;
    status(optionsError || (options ? mode === "match" ? "Choose a match to compare both lineups." : "Choose a player and map to read their defensive habits." : "Loading available matches and players…"), Boolean(optionsError));
  }
  async function fetchData(path, signal) {
    const response = await fetch(path, { signal, headers: { Accept: "application/json" } });
    let payload;
    try { payload = await response.json(); } catch { throw new Error("The server returned an unreadable response. Try again after the API is available."); }
    if (!response.ok || !payload.ok) {
      const messages = {
        defense_iq_data_unavailable: "Recorded class history is unavailable on this server. The stats database needs to be available before Defense IQ can load.",
        completed_pickup_not_found: "That match was not found among completed 4v4 pickups. Check the match ID.",
        player_defense_history_not_found: "That player has no linked defensive history. Choose another player.",
        map_defense_history_not_found: "That map has no recorded defensive history. Choose another map.",
        missing_player_or_map: "Choose both a player and a map."
      };
      throw new Error(messages[payload.error] || "Defense IQ could not load this analysis. Please try again.");
    }
    return payload.data;
  }
  function addOptions(select, rows, placeholder, selected) {
    select.replaceChildren(new Option(placeholder, ""));
    for (const row of rows) select.add(new Option(row.label, row.value));
    if (rows.some(row => row.value === selected)) select.value = selected;
    select.disabled = !rows.length;
  }
  function fillPlayers(selected = el("player-select").value) {
    const query = el("player-search").value.trim().toLowerCase();
    const players = options.players.filter(player => player.name.toLowerCase().includes(query) || player.id.includes(query));
    addOptions(el("player-select"), players.map(player => ({ value: player.id, label: player.name })),
      players.length ? "Choose a player" : "No players match", selected);
  }
  function className(name) {
    return `<span class="diq-class-name"><img src="assets/images/classes/${icons[name]}old_tfc.png" alt="" loading="lazy">${labels[name]}</span>`;
  }
  function bar(value, seconds) {
    return `<div class="diq-bar-value"><strong>${value}%</strong>${seconds == null ? "" : `<small>${clock(seconds)}</small>`}</div><div class="diq-track" aria-hidden="true"><span style="width:${value}%"></span></div>`;
  }
  function distribution(player, showActual, unusedClasses = []) {
    return `<div class="diq-column-labels"><span>Defensive class</span><span>Expected pick</span>${showActual ? "<span>Actual time</span>" : ""}</div>${classes.map(name => {
      const prediction = player.prediction?.find(row => row.name === name);
      const actual = player.actual?.classes.find(row => row.name === name);
      return `<div class="diq-class-row" data-class="${name}"${unusedClasses.includes(name) ? ' data-unused="true" hidden' : ""}>${className(name)}<div>${prediction ? bar(prediction.percent) : '<span class="diq-na">No estimate</span>'}</div>${showActual ? `<div class="diq-actual">${actual ? bar(actual.percent, actual.seconds) : '<span class="diq-na">No record</span>'}</div>` : ""}</div>`;
    }).join("")}`;
  }
  function sampleNote(player, historical) {
    if (!player.prediction) return "No earlier dominant-class history to estimate a pick.";
    const { overall, map, mixed } = player.samples;
    const basis = map ? `${map} on this map · ${overall} across all maps.` : `Overall fallback · ${overall} across all maps; none on this map.`;
    const sparse = map < 5 ? " Limited map history." : "";
    return `${historical ? "Pre-match history:" : "History:"} ${basis}${sparse}${mixed ? ` ${mixed} mixed match${mixed === 1 ? "" : "es"} excluded.` : ""}`;
  }
  function outcomeTable(player) {
    return `<div class="diq-table-wrap"><table class="diq-table"><caption class="diq-results-note">Team results on this map, grouped by dominant defensive class</caption><thead><tr><th scope="col">Class</th><th scope="col">W–L–T</th><th scope="col">Win %</th><th scope="col">Matches</th></tr></thead><tbody>${player.outcomes.map(row => `<tr><th scope="row" class="diq-result-class" data-class="${row.name}">${labels[row.name]}</th><td>${row.wins}–${row.losses}–${row.ties}</td><td>${row.winPercent == null ? "—" : `${row.winPercent}%`}</td><td>${row.matches}${row.unknown ? ` (${row.unknown} unknown)` : ""}</td></tr>`).join("")}</tbody></table></div><p class="diq-results-note">Win % excludes ties and unknown results. Class switches, teammates, and opponents affect outcomes. Small samples are descriptive, not a class recommendation.</p>`;
  }
  function playerCard(player, unusedClasses = []) {
    const actual = player.actual;
    const changed = player.topClass && actual?.dominant && player.topClass !== actual.dominant;
    const chance = actual?.dominant ? player.prediction?.find(row => row.name === actual.dominant)?.percent : null;
    const actualText = actual ? `${actual.dominant ? labels[actual.dominant] : "Mixed (tied time)"} · ${clock(actual.totalSeconds)} defensive-class time` : "No recorded defensive-class time";
    const tag = !actual ? "Unscored" : !player.prediction ? "No prior estimate" : !actual.dominant || !player.topClass ? "Mixed / tied" : changed ? "Different from expected" : "Matched expected";
    return `<article class="diq-player"><header class="diq-player-header"><div><h4><a href="player.html?id=${encodeURIComponent(player.id)}">${escape(player.name)}</a></h4><p>${escape(actualText)}</p></div><span class="diq-tag ${changed ? "is-unexpected" : ""}">${tag}</span></header><div class="diq-match-distribution">${distribution(player, true, unusedClasses)}</div><details class="diq-results-detail"><summary>History · ${player.samples.map} map / ${player.samples.overall} overall${chance != null ? ` · actual pick ${chance}% likely` : ""}</summary><p class="diq-sample">${escape(sampleNote(player, true))}${chance != null ? ` <strong>Actual dominant class had a ${chance}% estimated chance.</strong>` : ""}</p>${outcomeTable(player)}</details></article>`;
  }
  function renderMatch(data) {
    const comparable = data.players.filter(player => player.topClass && player.actual?.dominant);
    const matched = comparable.filter(player => player.topClass === player.actual.dominant).length;
    const coverage = data.players.filter(player => player.actual).length;
    // Missing records do not establish zero use. Only hide with full roster coverage.
    const unusedClasses = coverage === data.players.length && coverage > 0
      ? classes.filter(name => data.players.every(player =>
        player.actual.classes.some(row => row.name === name && row.seconds === 0)))
      : [];
    const visibilityControl = unusedClasses.length
      ? `<label class="diq-unused-toggle"><input type="checkbox" id="show-unused-classes"> Show unused classes (${unusedClasses.map(name => labels[name]).join(", ")})<span>Expected odds unchanged</span></label>`
      : "";
    return `<header class="diq-result-heading"><div><h2>${escape(data.match.map || "Unknown map")}</h2><p>${escape(date(data.match.createdAt))} · ${escape(data.match.id)} · ${matched}/${comparable.length} scored picks matched · class records for ${coverage}/${data.players.length} players</p></div><a href="match.html?id=${encodeURIComponent(data.match.id)}">Open match details</a></header>${!coverage ? '<p class="diq-empty">This match has no linked defensive-class time records yet. Earlier predictions may still be available below; actual choices remain unscored.</p>' : ""}${visibilityControl}<div class="diq-team-grid" data-unused-count="${unusedClasses.length}" style="--diq-class-count:${classes.length - unusedClasses.length}">${["BLUE", "RED"].map(team => `<section class="diq-team ${team === "RED" ? "is-red" : ""}" aria-label="${team} team"><h3>${team === "BLUE" ? "Blue" : "Red"} team${data.match.winner === team ? " · Won" : data.match.winner === "TIE" ? " · Tie" : data.match.winner && ["BLUE", "RED"].includes(data.match.winner) ? " · Lost" : ""}</h3>${data.players.filter(player => player.team === team).map(player => playerCard(player, unusedClasses)).join("") || '<p class="diq-empty">No roster recorded.</p>'}</section>`).join("")}</div>`;
  }
  function renderPlayer(data) {
    const player = data.player;
    return `<header class="diq-result-heading"><div><h2>${escape(player.name)} <span class="diq-na">on</span> ${escape(data.map)}</h2><p>Next dominant defensive class · history available as of ${escape(date(data.cutoff))}</p></div><a href="player.html?id=${encodeURIComponent(player.id)}">Open player profile</a></header><div class="diq-single"><section class="diq-player"><h3>Expected pick</h3><p class="diq-sample">${player.topClass ? `Most likely: <strong>${labels[player.topClass]}</strong>` : player.prediction ? "No single class leads this estimate." : "No dominant-class estimate available."}</p>${distribution(player, false)}<p class="diq-sample">${escape(sampleNote(player, false))}</p></section><section class="diq-player"><h3>Historical results</h3>${outcomeTable(player)}</section></div><section class="diq-recent"><h3>Recent choices on ${escape(data.map)}</h3>${player.recent.length ? `<div class="diq-table-wrap"><table class="diq-table"><thead><tr><th scope="col">Match</th><th scope="col">Dominant class</th><th scope="col">Time share</th><th scope="col">Team result</th></tr></thead><tbody>${player.recent.map(row => `<tr><td><a href="defense-iq.html?match=${encodeURIComponent(row.matchId)}">${escape(date(row.createdAt))}</a></td><td>${row.actual.dominant ? labels[row.actual.dominant] : "Mixed (tied time)"}</td><td>${row.actual.classes.filter(item => item.seconds > 0).map(item => `${labels[item.name]} ${item.percent}%`).join(" / ")}</td><td>${escape(row.result)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="diq-empty">No recorded defensive-class choices on this map. Predictions use overall history when available.</p>'}</section>`;
  }
  async function analyze(params, updateUrl = true) {
    controller?.abort();
    controller = new AbortController();
    const id = ++requestId;
    el("diq-results").innerHTML = "";
    el("diq-results").setAttribute("aria-busy", "true");
    el("diq-retry").hidden = true;
    status("Reading class history and calculating expected picks…");
    try {
      const data = await fetchData(`api/defense-iq?${params}`, controller.signal);
      if (id !== requestId) return;
      el("diq-results").innerHTML = data.mode === "match" ? renderMatch(data) : renderPlayer(data);
      status(data.mode === "match" ? "Pre-match estimates compared with recorded defensive-class time. Expand a player’s results for context." : "Estimated class habits and same-map team results. See the method below for sample limits.");
      if (updateUrl) history.replaceState(null, "", `${location.pathname}?${params}`);
    } catch (error) {
      if (error.name === "AbortError" || id !== requestId) return;
      status(error.message || "Unable to reach the API. Check your connection and try again.", true);
      retry = () => analyze(params, updateUrl);
      el("diq-retry").hidden = false;
    } finally {
      if (id === requestId) el("diq-results").setAttribute("aria-busy", "false");
    }
  }
  async function initialize() {
    optionsError = "";
    el("diq-retry").hidden = true;
    status("Loading available matches and players…");
    try {
      options = await fetchData("api/defense-iq/options");
      addOptions(el("match-select"), options.matches.map(match => ({ value: match.id,
        label: `${match.map || "Unknown map"} · ${date(match.createdAt)}${match.hasDefenseData ? "" : " · no class records"}` })), "Choose a recent match", initial.get("match") || "");
      fillPlayers(initial.get("player") || "");
      addOptions(el("map-select"), options.maps.map(map => ({ value: map, label: map })), "Choose a map", initial.get("map") || "");
      document.querySelectorAll(".diq-primary").forEach(button => { button.disabled = false; });
      setMode(mode);
      if (mode === "match") {
        const match = initial.get("match") || options.matches.find(row => row.hasDefenseData)?.id;
        if (match) {
          if (options.matches.some(row => row.id === match)) el("match-select").value = match;
          else el("match-id").value = match;
          await analyze(new URLSearchParams({ match }));
        } else status("No completed matches with defensive records yet. You can still enter a match ID to inspect available history.");
      } else if (initial.get("player") && initial.get("map")) {
        await analyze(new URLSearchParams({ player: initial.get("player"), map: initial.get("map") }));
      }
    } catch (error) {
      optionsError = error.message || "Unable to reach the API. Check your connection and try again.";
      status(optionsError, true);
      for (const id of ["match-select", "player-select", "map-select"]) {
        el(id).replaceChildren(new Option("Class history unavailable", ""));
        el(id).disabled = true;
      }
      retry = initialize;
      el("diq-retry").hidden = false;
    }
  }
  for (const value of ["match", "player"]) el(`mode-${value}`).addEventListener("click", () => {
    if (mode === value) return;
    setMode(value);
    history.replaceState(null, "", location.pathname);
  });
  el("player-search").addEventListener("input", () => { if (options) fillPlayers(); });
  el("match-select").addEventListener("change", () => { el("match-id").value = ""; });
  el("match-id").addEventListener("input", () => { el("match-select").value = ""; });
  el("match-form").addEventListener("submit", event => {
    event.preventDefault();
    const match = el("match-id").value.trim() || el("match-select").value;
    if (!match) { status("Choose a recent match or enter a match ID.", true); return; }
    analyze(new URLSearchParams({ match }));
  });
  el("player-form").addEventListener("submit", event => {
    event.preventDefault();
    const player = el("player-select").value;
    const map = el("map-select").value;
    if (!player || !map) { status("Choose both a player and a map.", true); return; }
    analyze(new URLSearchParams({ player, map }));
  });
  el("diq-results").addEventListener("change", event => {
    if (event.target.id !== "show-unused-classes") return;
    const show = event.target.checked;
    const grid = el("diq-results").querySelector(".diq-team-grid");
    grid.querySelectorAll('.diq-class-row[data-unused="true"]').forEach(row => { row.hidden = !show; });
    grid.style.setProperty("--diq-class-count", show ? classes.length : classes.length - Number(grid.dataset.unusedCount));
  });
  el("diq-retry").addEventListener("click", () => retry?.());
  setMode(mode);
  initialize();
})();
