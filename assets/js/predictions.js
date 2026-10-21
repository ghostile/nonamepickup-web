"use strict";

(() => {
  const view = document.body.dataset.predictionView;
  if (!view) return;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const state = ["empty", "unavailable", "stale"].includes(params.get("state")) ? params.get("state") : null;
  const number = value => value == null ? "—" : Number(value).toLocaleString("en-US");
  const signed = value => value == null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${number(Math.abs(value))}`;
  const percent = value => value == null ? "—" : `${(value * 100).toFixed(1)}%`;
  const node = (tag, value, className) => {
    const element = document.createElement(tag);
    if (value !== undefined) element.textContent = value;
    if (className) element.className = className;
    return element;
  };
  let page = 1, pages = 1, controller, config;
  let sort = "netProfit", direction = "desc";
  const endpoint = view === "account" ? "me" : "standings";
  const columnCount = view === "account" ? 8 : 5;
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
    $("prediction-count").textContent = `${number(data.total)} ${view === "account" ? "history entries" : "players"}`;
  }
  function profitCell(value) { return node("td", signed(value), value > 0 ? "positive" : value < 0 ? "negative" : ""); }
  function renderStandings(data) {
    $("prediction-body").replaceChildren(...data.rows.map(player => {
      const row = node("tr");
      if (player.rank <= 3) row.className = "prediction-top";
      const name = node("td");
      const label = node("span", undefined, "prediction-player");
      const initial = node("span", player.displayName.replace(/^Demo /, "").charAt(0), "prediction-initial");
      initial.setAttribute("aria-hidden", "true");
      label.append(initial, node("span", player.displayName)); name.append(label);
      row.append(node("td", `#${number(player.rank)}`, "prediction-rank"), name,
        profitCell(player.netProfit), node("td", number(player.settledGames)), node("td", percent(player.winRate)));
      return row;
    }));
    if (!data.rows.length) message("No players match this view. Try another search or check back after players join.");
    pager(data);
  }
  const team = pick => ({ blue: "Blue / Team 1", red: "Red / Team 2", tie: "Tie" })[pick] || "—";
  function renderAccount(data) {
    $("account-name").textContent = `${data.displayName}’s predictions`;
    $("account-balance").textContent = number(data.balance);
    $("account-locked").textContent = number(data.lockedPoints);
    $("account-limit").textContent = number(data.personalLimit);
    $("account-settled").textContent = number(data.settledGames);
    $("account-review").hidden = !data.reviewGames;
    $("account-review").textContent = `${number(data.reviewGames)} settled game(s) under review. Retained net credits: ${signed(data.reviewNetProfit)} points. These stay separate from finalized results; earned limit progression remains.`;
    $("account-uninitialized").hidden = data.initialized;
    $("prediction-body").replaceChildren(...data.history.map(item => {
      const row = node("tr"), status = node("td");
      const statusText = item.status === "review_required" ? "Under review" : item.refunded ? "Settled · refunded" :
        item.marketState === "countdown" ? "Closing window" : item.status.charAt(0).toUpperCase() + item.status.slice(1);
      status.append(node("span", statusText, `prediction-status${item.status === "review_required" ? " review" : ""}`));
      row.append(node("td", item.matchId), node("td", team(item.pick)), node("td", number(item.stake)),
        node("td", number(item.credits)), profitCell(item.netProfit), status,
        node("td", number(item.gameLimit)), node("td", new Date(item.updatedAt).toLocaleDateString()));
      return row;
    }));
    if (!data.history.length) message(data.initialized ? "No prediction history yet. Place predictions privately in Discord." : "Your prediction account has not been initialized. Check your balance privately in Discord to get started.");
    pager(data);
  }
  async function load() {
    controller?.abort(); controller = new AbortController();
    const active = controller;
    $("prediction-table").setAttribute("aria-busy", "true");
    $("prediction-prev").disabled = true; $("prediction-next").disabled = true;
    message("Loading predictions…");
    try {
      const query = new URLSearchParams({ page, pageSize: $("prediction-size").value });
      if (view !== "account") {
        query.set("sort", sort); query.set("direction", direction);
        query.set("search", $("prediction-search").value.trim());
      }
      if (state) query.set("state", state);
      const response = await fetch(`/api/predictions/${endpoint}?${query}`, { cache: "no-store", signal: active.signal });
      if (response.status === 401) {
        message("Sign in with Discord to see your private account.");
        $("account-login").hidden = !config?.loginAvailable;
        $("account-logout").hidden = true;
        return;
      }
      if (!response.ok) throw new Error("unavailable");
      const result = await response.json();
      if (!result.ok) throw new Error("unavailable");
      $("prediction-banner").hidden = !result.meta.synthetic;
      if (view === "account") {
        renderAccount(result.data);
        $("account-logout").hidden = result.meta.synthetic;
        $("account-login").hidden = true;
        loadActivity();
      } else renderStandings(result.data);
      $("prediction-updated").textContent = `${result.meta.stale ? "Stale preview · " : "Updated "}${new Date(result.meta.updatedAt).toLocaleString()}`;
      $("prediction-stale").hidden = !result.meta.stale;
    } catch (error) {
      if (error.name !== "AbortError") {
        message("Predictions are unavailable. Please try again shortly.", true);
        $("prediction-updated").textContent = "Backend unavailable";
      }
    } finally {
      if (active === controller) $("prediction-table").setAttribute("aria-busy", "false");
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
  $("account-logout")?.addEventListener("click", async () => {
    try {
      const response = await fetch("/api/predictions/auth/logout", { method: "POST", cache: "no-store" });
      if (!response.ok) throw new Error("logout");
      location.reload();
    } catch { $("account-review").hidden = false; $("account-review").textContent = "Sign out failed. Try again."; }
  });
  let activityPage = 1;
  async function loadActivity() {
    const list = $("account-activity");
    if (!list) return;
    try {
      const query = new URLSearchParams({ page: activityPage, pageSize: 5 });
      if (state) query.set("state", state);
      const response = await fetch(`/api/predictions/me/activity?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("activity");
      const { data } = await response.json();
      const labels = { grant: "Initial grant", stake: "Stake reserved / replaced", cancel: "Cancellation refund",
        refund: "Pregame / void refund", betting_return: "Betting return · includes returned stake",
        player_reward: "Official-player reward", betting_correction: "House-funded betting correction",
        player_correction: "House-funded player-reward correction", adjustment: "Owner adjustment" };
      list.replaceChildren(...data.rows.map(item => {
        const row = node("li"), label = node("span", labels[item.category] || "Point movement");
        label.append(node("small", `${item.matchId || "Account"} · ${new Date(item.createdAt).toLocaleDateString()}`));
        row.append(label, node("strong", signed(item.amount), item.amount < 0 ? "negative" : "positive"));
        return row;
      }));
      if (!data.rows.length) list.append(node("li", "No point activity yet."));
      activityPage = data.page;
      $("activity-page").textContent = `Page ${data.page} of ${data.pages}`;
      $("activity-prev").disabled = data.page <= 1;
      $("activity-next").disabled = data.page >= data.pages;
    } catch { list.replaceChildren(node("li", "Point activity is unavailable. Refresh to try again.")); }
  }
  $("activity-prev")?.addEventListener("click", () => { activityPage--; loadActivity(); });
  $("activity-next")?.addEventListener("click", () => { activityPage++; loadActivity(); });
  (async () => {
    try {
      const response = await fetch("/api/predictions/config", { cache: "no-store" });
      if (!response.ok) throw new Error("config");
      const result = await response.json(); config = result.data;
      $("prediction-banner").hidden = !result.meta.synthetic;
      await load();
    } catch { message("Predictions are unavailable. Start the preview backend or try again shortly.", true); }
  })();
})();
