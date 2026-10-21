"use strict";

(() => {
  const view = document.body.dataset.predictionView;
  if (view !== "standings") return;
  const $ = id => document.getElementById(id);
  const number = value => value == null ? "—" : Number(value).toLocaleString("en-US");
  const signed = value => value == null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${number(Math.abs(value))}`;
  const percent = value => value == null ? "—" : `${(value * 100).toFixed(1)}%`;
  const node = (tag, value, className) => {
    const element = document.createElement(tag);
    if (value !== undefined) element.textContent = value;
    if (className) element.className = className;
    return element;
  };
  let page = 1, pages = 1, controller, lastData = null, busy = false;
  let sort = "netProfit", direction = "desc";
  const endpoint = "standings";
  const columnCount = 5;
  function message(text, retry = false) {
    const cell = node("td", undefined, "prediction-state");
    cell.colSpan = columnCount;
    cell.append(node("p", text));
    if (retry) {
      const button = node("button", "Try again", "prediction-button");
      button.type = "button";
      button.addEventListener("click", load);
      cell.append(button);
    }
    const row = node("tr"); row.append(cell);
    $("prediction-body").replaceChildren(row);
    $("prediction-count").textContent = text;
  }
  function pager(data) {
    page = data.page; pages = data.pages;
    $("prediction-prev").disabled = page <= 1;
    $("prediction-next").disabled = page >= pages;
    $("prediction-page").textContent = `Page ${page} of ${pages}`;
    $("prediction-count").textContent = `${number(data.total)} players`;
  }
  function profitCell(value) { return node("td", signed(value), value > 0 ? "positive" : value < 0 ? "negative" : ""); }
  function renderStandings(data) {
    $("prediction-body").replaceChildren(...data.rows.map(player => {
      const row = node("tr");
      if (player.rank <= 3) row.className = "prediction-top";
      const name = node("td");
      const label = node("span", undefined, "prediction-player");
      const initial = node("span", player.displayName.trim().charAt(0), "prediction-initial");
      initial.setAttribute("aria-hidden", "true");
      label.append(initial, node("span", player.displayName)); name.append(label);
      row.append(node("td", `#${number(player.rank)}`, "prediction-rank"), name,
        profitCell(player.netProfit), node("td", number(player.settledGames)), node("td", percent(player.winRate)));
      return row;
    }));
    if (!data.rows.length) message("No players match this view. Try another search or check back after players join.");
    pager(data);
  }
  async function load({ background = false } = {}) {
    if (background && (document.hidden || busy)) return;
    controller?.abort(); controller = new AbortController();
    busy = true;
    const active = controller;
    $("prediction-table").setAttribute("aria-busy", "true");
    $("prediction-prev").disabled = true; $("prediction-next").disabled = true;
    if (!background) { lastData = null; message("Loading predictions…"); }
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; active.abort(); }, 10000);
    try {
      const query = new URLSearchParams({ page, pageSize: $("prediction-size").value });
      query.set("sort", sort); query.set("direction", direction);
      query.set("search", $("prediction-search").value.trim());
      const response = await fetch(`/api/predictions/${endpoint}?${query}`, { cache: "no-store", signal: active.signal });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "unavailable");
      lastData = result.data;
      renderStandings(result.data);
      $("prediction-updated").textContent = `Updated ${new Date(result.meta.updatedAt).toLocaleString()}`;
      $("prediction-stale").hidden = true;
    } catch (error) {
      if (active === controller && (error.name !== "AbortError" || timedOut)) {
        if (background && lastData) {
          $("prediction-stale").hidden = false;
          pager(lastData);
        } else {
          const messages = {
            predictions_schema_unavailable: "The bot prediction database is not ready. Standings will appear when its prediction schema is available.",
            predictions_database_unavailable: "The prediction database cannot be read. Please try again shortly.",
            predictions_configuration_unavailable: "Live prediction updates need the server configuration refreshed."
          };
          message(messages[error.message] || "Predictions are unavailable. Please try again shortly.", true);
          $("prediction-updated").textContent = "Live updates unavailable";
          $("prediction-stale").hidden = true;
        }
      }
    } finally {
      clearTimeout(timeout);
      if (active === controller) {
        busy = false;
        $("prediction-table").setAttribute("aria-busy", "false");
      }
    }
  }

  $("prediction-prev").addEventListener("click", () => { if (page > 1) { page--; load(); } });
  $("prediction-next").addEventListener("click", () => { if (page < pages) { page++; load(); } });
  $("prediction-size").addEventListener("change", () => { page = 1; load(); });
  let debounce;
  $("prediction-search")?.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(() => { page = 1; load(); }, 200); });
  document.querySelectorAll("[data-sort]").forEach(button => button.addEventListener("click", () => {
    direction = sort === button.dataset.sort && direction === "desc" ? "asc" : "desc";
    sort = button.dataset.sort; page = 1;
    document.querySelectorAll("[data-sort]").forEach(item => item.closest("th").setAttribute("aria-sort", item === button ? (direction === "desc" ? "descending" : "ascending") : "none"));
    load();
  }));
  let refreshTimer;
  function startRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => load({ background: true }), 15000);
  }
  startRefresh();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load({ background: true }); });
  window.addEventListener("pagehide", () => { clearInterval(refreshTimer); controller?.abort(); });
  window.addEventListener("pageshow", event => {
    if (event.persisted) { startRefresh(); load({ background: true }); }
  });
  load();
})();
