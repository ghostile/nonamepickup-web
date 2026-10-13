"use strict";

const express = require("express");
const path = require("path");

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

function createSpellingRouter({ fs, file, adminUser, adminPassword }) {
  const router = express.Router();
  const store = createSpellingStore({ fs, file });
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

module.exports = { createSpellingRouter };
