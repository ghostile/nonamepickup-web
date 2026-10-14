"use strict";

const express = require("express");
const path = require("path");
const { createSpellingScoreStore } = require("../spellingScores");

const SAMPLE_WORDS = [
  ["adventure", "Our family went on an exciting adventure through the mountains."],
  ["mysterious", "The mysterious glow came from inside the old cave."],
  ["extraordinary", "The team made an extraordinary discovery."],
  ["necessary", "A helmet is necessary for this mission."],
  ["environment", "We can protect the environment together."],
  ["curiosity", "Her curiosity led her to ask a brilliant question."],
  ["excellent", "You did an excellent job solving that puzzle."],
  ["imagination", "His imagination turned a cardboard box into a spaceship."],
  ["responsible", "A responsible captain checks every control."],
  ["achievement", "Finishing the mission was a huge achievement."],
  ["vocabulary", "Reading helps us grow our vocabulary."],
  ["opportunity", "Every challenge is an opportunity to learn."],
  ["independent", "The independent explorer charted a new moon."],
  ["communicate", "Pilots communicate clearly during a launch."],
  ["competition", "The friendly competition made everyone smile."],
  ["magnificent", "The magnificent nebula lit the night sky."],
  ["temperature", "The robot measured the temperature on Mars."],
  ["knowledge", "Knowledge gives explorers confidence."],
  ["determination", "With determination, the crew repaired the ship."],
  ["experience", "Each mission is a new experience."]
].map(([text, sentence], index) => ({ id: `sample-${index + 1}`, text, sentence }));

function createSpellingStore({ fs, file }) {
  const storeFile = path.resolve(file);
  const fallback = { version: 1, activeListId: "sample-week", lists: [{ id: "sample-week", name: "Galaxy Explorers • Week 1", weekStart: new Date().toISOString().slice(0, 10), words: SAMPLE_WORDS }] };

  function read() {
    try {
      return JSON.parse(fs.readFileSync(storeFile, "utf8"));
    } catch {
      return fallback;
    }
  }

  function write(data) {
    fs.mkdirSync(path.dirname(storeFile), { recursive: true });
    const temp = `${storeFile}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o640 });
    fs.renameSync(temp, storeFile);
  }

  return { read, write };
}

function validList(list) {
  return list && typeof list.name === "string" && Array.isArray(list.words) && list.words.length > 0 && list.words.length <= 100 && list.words.every(word => word && typeof word.text === "string" && word.text.trim().length > 0 && word.text.length <= 80);
}

const SCORE_MODES = new Set(["arcade", "practice", "test"]);

function validScore(score) {
  if (!score || typeof score !== "object") return false;
  if (typeof score.id !== "string" || score.id.trim().length < 1 || score.id.length > 120) return false;
  if (typeof score.playerName !== "string" || score.playerName.trim().length < 1 || score.playerName.trim().length > 40) return false;
  if (typeof score.listId !== "string" || score.listId.trim().length < 1 || score.listId.length > 120) return false;
  if (typeof score.listName !== "string" || score.listName.trim().length < 1 || score.listName.trim().length > 120) return false;
  if (!SCORE_MODES.has(score.mode)) return false;
  if (!Number.isInteger(score.total) || score.total < 1 || score.total > 100) return false;
  if (!Number.isInteger(score.correct) || score.correct < 0 || score.correct > score.total) return false;
  if (!Number.isInteger(score.firstAttemptCorrect) || score.firstAttemptCorrect < 0 || score.firstAttemptCorrect > score.correct) return false;
  if (!Number.isFinite(score.score) || score.score < 0 || score.score > 1_000_000_000) return false;
  if (typeof score.completedAt !== "string" || Number.isNaN(Date.parse(score.completedAt))) return false;
  return true;
}

function normalizeScore(score) {
  return {
    id: score.id.trim(),
    playerName: score.playerName.trim().slice(0, 40),
    listId: score.listId.trim().slice(0, 120),
    listName: score.listName.trim().slice(0, 120),
    mode: score.mode,
    total: score.total,
    correct: score.correct,
    firstAttemptCorrect: score.firstAttemptCorrect,
    accuracy: Math.round(score.correct / score.total * 100),
    score: Math.round(score.score),
    completedAt: new Date(score.completedAt).toISOString()
  };
}

function createSpellingRouter({ fs, file, scoresFile, adminUser, adminPassword }) {
  const router = express.Router();
  const store = createSpellingStore({ fs, file });
  const scoreStore = createSpellingScoreStore({ fs, file: scoresFile });
  function requireAdmin(req, res, next) {
    if (!adminUser || !adminPassword) return res.status(503).json({ ok: false, error: "spelling_admin_not_configured" });
    const header = req.get("authorization") || "";
    const encoded = header.startsWith("Basic ") ? header.slice(6) : "";
    let suppliedUser = "";
    let suppliedPassword = "";
    try { [suppliedUser, suppliedPassword] = Buffer.from(encoded, "base64").toString("utf8").split(/:(.*)/s, 2); } catch { /* invalid credentials */ }
    if (suppliedUser !== adminUser || suppliedPassword !== adminPassword) {
      res.set("WWW-Authenticate", 'Basic realm="Spelling Invaders Parent Zone"');
      return res.status(401).json({ ok: false, error: "spelling_admin_unauthorized" });
    }
    return next();
  }

  router.get("/spelling/active", (req, res) => {
    const data = store.read();
    const list = data.lists.find(item => item.id === data.activeListId) || data.lists[0];
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, list });
  });

  router.post("/spelling/scores", (req, res) => {
    if (!validScore(req.body)) return res.status(400).json({ ok: false, error: "invalid_spelling_score" });
    const next = scoreStore.append(normalizeScore(req.body));
    const record = next.records.find(item => item.id === req.body.id.trim());
    res.status(200).json({ ok: true, record });
  });

  router.get("/spelling/admin/scores", requireAdmin, (req, res) => {
    const records = scoreStore.read().records.slice().sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    const byMode = records.reduce((counts, record) => { counts[record.mode] = (counts[record.mode] || 0) + 1; return counts; }, {});
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, records, totals: { recordCount: records.length, playerCount: new Set(records.map(record => record.playerName.toLowerCase())).size, byMode } });
  });

  router.delete("/spelling/admin/scores", requireAdmin, (req, res) => {
    scoreStore.clear();
    res.json({ ok: true });
  });

  router.put("/spelling/admin/list", requireAdmin, (req, res) => {
    const list = req.body;
    if (!validList(list)) return res.status(400).json({ ok: false, error: "invalid_spelling_list" });
    const data = store.read();
    const normalized = {
      id: String(list.id || `list-${Date.now()}`),
      name: list.name.trim().slice(0, 120),
      weekStart: String(list.weekStart || new Date().toISOString().slice(0, 10)).slice(0, 10),
      words: list.words.map((word, index) => ({ id: String(word.id || `word-${Date.now()}-${index}`), text: word.text.trim(), sentence: String(word.sentence || `Say the word ${word.text.trim()} aloud, then use it in a sentence.`).trim() }))
    };
    const next = { version: 1, activeListId: normalized.id, lists: [...data.lists.filter(item => item.id !== normalized.id), normalized] };
    store.write(next);
    res.json({ ok: true, list: normalized });
  });

  return router;
}

module.exports = { createSpellingRouter, normalizeScore, validScore };
