"use strict";

const fs = require("fs");
const path = require("path");
const { createPredictionsRouter } = require("./router");

function predictionRuntime(env = process.env) {
  const mode = env.PREDICTIONS_WEB_MODE || "off";
  if (mode !== "live") return { router: createPredictionsRouter({ mode }), close() {} };
  const Database = require("better-sqlite3");
  const { createPredictionRepository } = require("./repository");
  // Separate read-only connection; no WAL mode changes, migrations or account grants.
  const file = env.ELO_DB || require("./../config").ELO_DB;
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const repository = createPredictionRepository(db);
    const approvedPolicy = env.PREDICTIONS_PUBLIC_POLICY === "net-profit-v1-approved";
    const consentFile = env.PREDICTIONS_CONSENT_FILE;
    if (consentFile) {
      const resolved = path.resolve(consentFile);
      for (const root of [path.resolve(__dirname, "../../..", ".."), env.PUBLIC_DIR].filter(Boolean)) {
        const relative = path.relative(path.resolve(root), resolved);
        if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
          throw new Error("Prediction consent file must be outside website/public directories");
        }
      }
    }
    const consents = approvedPolicy && consentFile ? JSON.parse(fs.readFileSync(consentFile, "utf8")) : [];
    if (!Array.isArray(consents) || consents.some(row => !row || row.optedIn !== true ||
        !/^\d{1,25}$/.test(row.discordId) || typeof row.displayName !== "string" ||
        !row.displayName.trim() || row.displayName.length > 100) ||
        new Set(consents.map(row => row.discordId)).size !== consents.length) throw new Error("Invalid prediction consent configuration");
    const router = createPredictionsRouter({ mode, repository, approvedPolicy, consents });
    return { router, close() { db.close(); } };
  } catch (error) { db.close(); throw error; }
}

module.exports = { predictionRuntime };
