"use strict";

const crypto = require("crypto");

// Single-process staging sessions. No Discord access/refresh token is persisted.
function createPredictionAuth({ clientId, clientSecret, redirectUri, fetchImpl = fetch }) {
  const sessions = new Map(), pending = new Map();
  const configured = Boolean(clientId && clientSecret && redirectUri);
  const origin = configured ? new URL(redirectUri).origin : null;
  const secure = configured && new URL(redirectUri).protocol === "https:";
  if (configured && !secure && !["localhost", "127.0.0.1"].includes(new URL(redirectUri).hostname)) {
    throw new Error("Discord redirect must use HTTPS");
  }
  const cookieOptions = { httpOnly: true, secure, sameSite: "lax", path: "/api/predictions" };
  const cookies = req => Object.fromEntries(String(req.headers.cookie || "").split(";").map(part => {
    const index = part.indexOf("=");
    return index > 0 ? [part.slice(0, index).trim(), part.slice(index + 1)] : ["", ""];
  }));
  const prune = () => {
    const now = Date.now();
    for (const map of [sessions, pending]) for (const [key, value] of map) if (value.expiresAt <= now) map.delete(key);
  };
  const token = () => crypto.randomBytes(32).toString("hex");
  const fail = (res, status, error) => res.status(status).json({ ok: false, error });
  return {
    configured,
    identify(req) {
      prune();
      return sessions.get(cookies(req).nn_prediction_session)?.user || null;
    },
    mount(router) {
      router.get("/auth/login", (req, res) => {
        if (!configured) return fail(res, 503, "discord_login_not_configured");
        prune();
        if (pending.size >= 1000) return fail(res, 503, "login_busy_try_again");
        const state = token();
        pending.set(state, { expiresAt: Date.now() + 300000 });
        res.cookie("nn_prediction_state", state, { ...cookieOptions, maxAge: 300000 });
        const url = new URL("https://discord.com/oauth2/authorize");
        url.search = new URLSearchParams({ response_type: "code", client_id: clientId,
          redirect_uri: redirectUri, scope: "identify", state }).toString();
        res.redirect(url.toString());
      });
      router.get("/auth/callback", async (req, res) => {
        if (!configured) return fail(res, 503, "discord_login_not_configured");
        prune();
        const state = typeof req.query.state === "string" ? req.query.state : "";
        const valid = pending.has(state) && cookies(req).nn_prediction_state === state;
        pending.delete(state);
        res.clearCookie("nn_prediction_state", cookieOptions);
        if (!valid || typeof req.query.code !== "string" || (req.query.iss && req.query.iss !== "https://discord.com")) {
          return fail(res, 400, "discord_login_expired_or_invalid");
        }
        try {
          const exchange = await fetchImpl("https://discord.com/api/oauth2/token", {
            method: "POST", signal: AbortSignal.timeout(10000),
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId,
              client_secret: clientSecret, code: req.query.code, redirect_uri: redirectUri })
          });
          if (!exchange.ok) throw new Error("OAuth unavailable");
          const result = await exchange.json();
          if (typeof result.access_token !== "string") throw new Error("Missing token");
          const response = await fetchImpl("https://discord.com/api/v10/users/@me", {
            signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${result.access_token}` }
          });
          if (!response.ok) throw new Error("Identity unavailable");
          const identity = await response.json();
          if (!/^\d{1,25}$/.test(identity.id)) throw new Error("Invalid identity");
          if (sessions.size >= 10000) throw new Error("Session capacity");
          sessions.delete(cookies(req).nn_prediction_session);
          const session = token();
          sessions.set(session, { user: { id: identity.id,
            displayName: String(identity.global_name || identity.username || "Player").slice(0, 100) },
            expiresAt: Date.now() + 3600000 });
          res.cookie("nn_prediction_session", session, { ...cookieOptions, maxAge: 3600000 });
          res.redirect("/my-predictions.html");
        } catch {
          fail(res, 503, "discord_login_unavailable_try_again");
        }
      });
      router.post("/auth/logout", (req, res) => {
        if (!configured || req.headers.origin !== origin) return fail(res, 403, "same_origin_required");
        sessions.delete(cookies(req).nn_prediction_session);
        res.clearCookie("nn_prediction_session", cookieOptions);
        res.json({ ok: true });
      });
    }
  };
}

module.exports = { createPredictionAuth };
