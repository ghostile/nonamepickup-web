"use strict";

const path = require("path");

const SCORE_SCHEMA_VERSION = 1;
const MAX_SCORE_RECORDS = 2000;

function emptyScores() {
  return { version: SCORE_SCHEMA_VERSION, records: [] };
}

function normalizeScores(value) {
  if (!value || value.version !== SCORE_SCHEMA_VERSION || !Array.isArray(value.records)) return emptyScores();
  return { version: SCORE_SCHEMA_VERSION, records: value.records.slice(-MAX_SCORE_RECORDS) };
}

function createSpellingScoreStore({ fs, file }) {
  const storeFile = path.resolve(file);

  function read() {
    try {
      return normalizeScores(JSON.parse(fs.readFileSync(storeFile, "utf8")));
    } catch {
      return emptyScores();
    }
  }

  function write(data) {
    fs.mkdirSync(path.dirname(storeFile), { recursive: true });
    const temp = `${storeFile}.tmp`;
    const serialized = JSON.stringify(normalizeScores(data), null, 2);
    fs.writeFileSync(temp, serialized, { mode: 0o640 });
    if (process.platform === "win32") {
      fs.writeFileSync(storeFile, serialized, { mode: 0o640 });
      fs.rmSync(temp, { force: true });
      return;
    }
    try {
      fs.renameSync(temp, storeFile);
    } catch (error) {
      if (error.code !== "EPERM" && error.code !== "EEXIST") throw error;
      fs.rmSync(storeFile, { force: true });
      fs.renameSync(temp, storeFile);
    }
  }

  function append(record) {
    const current = read();
    if (current.records.some(item => item.id === record.id)) return current;
    const next = { version: SCORE_SCHEMA_VERSION, records: [...current.records, record].slice(-MAX_SCORE_RECORDS) };
    write(next);
    return next;
  }

  function clear() {
    const next = emptyScores();
    write(next);
    return next;
  }

  return { read, append, clear };
}

module.exports = { MAX_SCORE_RECORDS, createSpellingScoreStore, normalizeScores };
