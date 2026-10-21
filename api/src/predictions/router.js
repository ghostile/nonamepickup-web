"use strict";

const express = require("express");
const { standings } = require("./metrics");
const { publicRows, previewPersonal, previewActivity } = require("./preview");
const { createPredictionAuth } = require("./auth");

const COLUMNS = [
  { key: "rank", label: "Rank", type: "integer" },
  { key: "displayName", label: "Player", type: "string" },
  { key: "netProfit", label: "Net profit", type: "points" },
  { key: "settledGames", label: "Settled games", type: "integer" },
  { key: "winRate", label: "Correct picks", type: "ratio", nullable: true }
];
const integer = (value, fallback, max) => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d{1,9}$/.test(value) || Number(value) < 1 || Number(value) > max) {
    throw new Error("invalid_query");
  }
  return Number(value);
};
function pageQuery(query) {
  const page = integer(query.page, 1, 1000000), pageSize = integer(query.pageSize, 20, 100);
  const sort = query.sort || "netProfit", direction = query.direction || "desc";
  if (!COLUMNS.some(column => column.key === sort) || !["asc", "desc"].includes(direction) ||
      (query.search !== undefined && (typeof query.search !== "string" || query.search.length > 100))) throw new Error("invalid_query");
  return { page, pageSize, sort, direction, search: query.search || "" };
}
function createPredictionsRouter({ mode = "off", repository = null, approvedPolicy = false,
  consents = [], authOptions = {}, minimumGames = 10 } = {}) {
  if (!["off", "preview", "live"].includes(mode)) throw new Error("Unknown prediction mode");
  const router = express.Router(), auth = createPredictionAuth(authOptions);
  router.use((req, res, next) => {
    res.set({ "Cache-Control": "private, no-store, max-age=0", "Pragma": "no-cache",
      "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" });
    if (mode === "off") return res.status(404).json({ ok: false, error: "predictions_disabled" });
    next();
  });
  const envelope = (data, state) => ({ ok: true, data, meta: { contractVersion: 1,
    mode, synthetic: mode === "preview",
    updatedAt: Date.now() - (mode === "preview" && state === "stale" ? 7200000 : 0),
    stale: mode === "preview" && state === "stale" } });
  const fail = (res, error) => res.status(error.message === "invalid_query" ? 400 : 503)
    .json({ ok: false, error: error.message === "invalid_query" ? "invalid_query" : "predictions_unavailable" });
  // Deterministic UI states are only accepted in synthetic mode.
  router.use((req, res, next) => {
    if (mode === "preview" && req.query.state === "unavailable") {
      return res.status(503).json({ ok: false, error: "preview_backend_unavailable" });
    }
    next();
  });
  router.get("/config", (req, res) => res.json(envelope({ columns: COLUMNS,
    ranking: { metric: "netProfit", ties: "competition", minimumGames, inactive: "included" },
    publicPolicy: approvedPolicy ? "approved" : "pending", loginAvailable: mode === "live" && auth.configured,
    publicAvailable: mode === "preview" || approvedPolicy, wagering: "discord" })));
  router.get("/standings", (req, res) => {
    if (mode === "live" && !approvedPolicy) return res.status(403).json({ ok: false, error: "public_policy_not_approved" });
    try {
      const query = pageQuery(req.query);
      const rows = mode === "preview" ? (req.query.state === "empty" ? [] : publicRows) : repository.publicRows(consents, minimumGames);
      const response = envelope({ columns: COLUMNS, ...standings(rows, query) }, req.query.state);
      res.json(response);
    } catch (error) { fail(res, error); }
  });
  router.get("/me", (req, res) => {
    const user = mode === "preview" ? { displayName: "Demo Scout" } : auth.identify(req);
    if (!user) return res.status(401).json({ ok: false, error: "discord_login_required" });
    try {
      const page = integer(req.query.page, 1, 1000000), pageSize = integer(req.query.pageSize, 10, 100);
      const personal = mode === "preview" ? previewPersonal() : repository.personal(user.id);
      if (mode === "preview" && req.query.state === "empty") {
        Object.assign(personal, { initialized: false, balance: null, lockedPoints: 0,
          settledGames: 0, finalizedGames: 0, personalLimit: 100, netProfit: 0,
          reviewGames: 0, reviewNetProfit: 0, winRate: null, updatedAt: null, history: [] });
      }
      const { history, ...summary } = personal;
      const pages = Math.max(1, Math.ceil(history.length / pageSize)), current = Math.min(page, pages);
      res.json(envelope({ ...summary, displayName: user.displayName,
        history: history.slice((current - 1) * pageSize, current * pageSize),
        page: current, pageSize, pages, total: history.length }, req.query.state));
    } catch (error) { fail(res, error); }
  });
  router.get("/me/activity", (req, res) => {
    const user = mode === "preview" ? { displayName: "Demo Scout" } : auth.identify(req);
    if (!user) return res.status(401).json({ ok: false, error: "discord_login_required" });
    try {
      const page = integer(req.query.page, 1, 1000000), pageSize = integer(req.query.pageSize, 10, 100);
      let data;
      if (mode === "preview") {
        const rows = req.query.state === "empty" ? [] : previewActivity();
        const pages = Math.max(1, Math.ceil(rows.length / pageSize)), current = Math.min(page, pages);
        data = { page: current, pageSize, pages, total: rows.length, rows: rows.slice((current - 1) * pageSize, current * pageSize) };
      } else data = repository.activity(user.id, page, pageSize);
      res.json(envelope(data));
    } catch (error) { fail(res, error); }
  });
  if (mode === "live") auth.mount(router);
  // No mutation endpoints for accounts, stakes, payouts, or consent.
  return router;
}

module.exports = { createPredictionsRouter };
