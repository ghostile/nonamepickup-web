"use strict";

const Database = require("better-sqlite3");
const config = require("../src/config");
const { createDatabase } = require("../src/db");
const { initializeSchema } = require("../src/db/schema");
const { NN_MVP_CUTOFF_EPOCH } = require("../src/lib/canonicalMvp");
const { syncPendingNnMvps } = require("../src/lib/nnMvpStore");

const apply = process.argv.includes("--apply");
const prepareSchema = process.argv.includes("--prepare-schema");

if (apply && prepareSchema) {
  throw new Error("Use either --prepare-schema or --apply, not both");
}

if (prepareSchema) {
  const schemaDb = new Database(config.ELO_DB);
  try {
    schemaDb.pragma("journal_mode = WAL");
    schemaDb.pragma("synchronous = NORMAL");
    schemaDb.pragma("busy_timeout = 5000");
    schemaDb.pragma("foreign_keys = ON");
    initializeSchema(schemaDb);
    console.log(`Prepared canonical NN MVP schema in ${config.ELO_DB}; no MVP results were written.`);
  } finally {
    schemaDb.close();
  }
  process.exit(0);
}

const db = apply
  ? createDatabase(config.ELO_DB, config.ANALYTICS_RETENTION_DAYS)
  : new Database(config.ELO_DB, { readonly: true, fileMustExist: true });

if (!apply) {
  db.pragma("busy_timeout = 5000");
  db.pragma("query_only = ON");
}

try {
  const summary = syncPendingNnMvps(db, {
    dryRun: !apply,
    force: true,
    limit: 1_000_000
  });

  console.log(`${apply ? "Applying" : "Dry run for"} canonical NN MVPs from epoch ${NN_MVP_CUTOFF_EPOCH}`);
  for (const change of summary.changes) {
    if (change.failed) {
      console.error(`${change.match_id}: FAILED ${change.error}`);
      continue;
    }
    const oldNames = change.hampalyzer.map(row => row.display_name || row.player_key || row.steam_id).filter(Boolean).join(" / ") || "none";
    const nextName = change.proposed?.display_name || change.proposed?.player_key || change.proposed?.steam_id || "unavailable";
    const score = change.proposed ? ` raw=${change.proposed.final_score} display=${change.proposed.display_score}` : "";
    console.log(`${change.match_id}: Hampalyzer=${oldNames} -> NN=${nextName}${score} ${change.changed ? "CHANGE" : "unchanged"}`);
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    processed: summary.processed,
    changed: summary.changed,
    unchanged: summary.unchanged,
    unavailable: summary.unavailable,
    failed: summary.failed
  }));

  if (summary.failed > 0) process.exitCode = 1;
} finally {
  db.close();
}
