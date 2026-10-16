"use strict";

const CLASSES = ["hwguy", "demoman", "soldier", "engineer"];
const HALF_LIFE_SECONDS = 180 * 86400;
const MAP_PRIOR = 5;

// Largest-remainder rounding keeps the displayed distribution at exactly 100%.
function percentages(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return values.map(() => 0);
  const exact = values.map(value => value * 100 / total);
  const rounded = exact.map(Math.floor);
  const order = exact.map((value, index) => ({ index, remainder: value - rounded[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const remaining = 100 - rounded.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < remaining; i++) rounded[order[i].index]++;
  return rounded;
}

function dominantClass(seconds) {
  const max = Math.max(...CLASSES.map(name => seconds[name] || 0));
  const leaders = CLASSES.filter(name => max > 0 && seconds[name] === max);
  return leaders.length === 1 ? leaders[0] : null;
}

function actualChoice(observation) {
  if (!observation) return null;
  const values = CLASSES.map(name => observation.seconds[name] || 0);
  const shares = percentages(values);
  return {
    dominant: observation.dominant,
    totalSeconds: values.reduce((sum, seconds) => sum + seconds, 0),
    classes: CLASSES.map((name, index) => ({ name, seconds: values[index], percent: shares[index] }))
  };
}

function analyzePlayer(observations, playerId, map, before) {
  const history = observations.filter(row => row.playerId === playerId && row.createdAt < before);
  const labeled = history.filter(row => row.dominant);
  const sameMap = labeled.filter(row => row.map === map);
  const allCounts = CLASSES.map(() => 1);
  const mapCounts = CLASSES.map(() => 0);
  for (const row of labeled) {
    const weight = Math.pow(0.5, Math.max(0, before - row.createdAt) / HALF_LIFE_SECONDS);
    const index = CLASSES.indexOf(row.dominant);
    allCounts[index] += weight;
    if (row.map === map) mapCounts[index] += weight;
  }
  const allTotal = allCounts.reduce((sum, value) => sum + value, 0);
  const scores = mapCounts.map((value, index) => value + MAP_PRIOR * allCounts[index] / allTotal);
  const rounded = percentages(scores);
  const prediction = labeled.length ? CLASSES.map((name, index) => ({ name, percent: rounded[index] })) : null;
  const maxScore = Math.max(...scores);
  const leaders = CLASSES.filter((name, index) => Math.abs(scores[index] - maxScore) < 1e-10);
  const outcomes = CLASSES.map(name => {
    const rows = sameMap.filter(row => row.dominant === name);
    const wins = rows.filter(row => row.result === "win").length;
    const losses = rows.filter(row => row.result === "loss").length;
    const ties = rows.filter(row => row.result === "tie").length;
    return { name, matches: rows.length, wins, losses, ties,
      unknown: rows.length - wins - losses - ties,
      winPercent: wins + losses ? Math.round(wins * 100 / (wins + losses)) : null };
  });
  return {
    prediction,
    topClass: prediction && leaders.length === 1 ? leaders[0] : null,
    samples: { overall: labeled.length, map: sameMap.length, mixed: history.length - labeled.length },
    basis: !labeled.length ? "none" : !sameMap.length ? "overall" : "map_and_overall",
    outcomes,
    recent: history.filter(row => row.map === map).sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10).map(row => ({ matchId: row.matchId, createdAt: row.createdAt,
        result: row.result, actual: actualChoice(row) }))
  };
}

module.exports = { CLASSES, dominantClass, actualChoice, analyzePlayer };
