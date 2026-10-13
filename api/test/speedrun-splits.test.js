"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildSplitAnalysis,
  compareSplitEvents,
  compatibleSplitMetadata,
  parseRecordedSplitEvents,
  sumBestSegments
} = require("../src/speedruns/splits");

test("builds ordered elapsed and segment timings from recorded events", () => {
  const result = buildSplitAnalysis({
    timeMs: 31_850,
    events: [
      { kind: "finish", elapsedMs: 31_850 },
      { kind: "checkpoint", checkpointNumber: 2, elapsedMs: 15_750 },
      { kind: "start", elapsedMs: 0 },
      { kind: "checkpoint", checkpointNumber: 1, elapsedMs: 8_420 }
    ]
  });

  assert.deepEqual(result.events.map(event => event.key), ["start", "checkpoint:1", "checkpoint:2", "finish"]);
  assert.deepEqual(result.events.map(event => event.elapsedMs), [0, 8420, 15750, 31850]);
  assert.deepEqual(result.events.map(event => event.segmentMs), [null, 8420, 7330, 16100]);
  assert.equal(result.available, true);
});

test("calculates cumulative and segment deltas with explicit signs", () => {
  const current = buildSplitAnalysis({
    timeMs: 31_850,
    events: [
      { kind: "start", elapsedMs: 0 },
      { kind: "checkpoint", checkpointNumber: 1, elapsedMs: 8420 },
      { kind: "finish", elapsedMs: 31_850 }
    ]
  });
  const comparison = buildSplitAnalysis({
    timeMs: 32_000,
    events: [
      { kind: "start", elapsedMs: 0 },
      { kind: "checkpoint", checkpointNumber: 1, elapsedMs: 8600 },
      { kind: "finish", elapsedMs: 32_000 }
    ]
  });

  const deltas = compareSplitEvents(current, comparison);
  assert.deepEqual(deltas.map(event => event.cumulativeDeltaMs), [0, -180, -150]);
  assert.deepEqual(deltas.map(event => event.segmentDeltaMs), [null, -180, 30]);
});

test("rejects mismatched checkpoint sequences and preserves unavailable legacy data", () => {
  assert.equal(compatibleSplitMetadata(
    { map: "aowconc", classId: 3, ruleset: 2, checkpointSequence: [1, 2] },
    { map: "aowconc", classId: 3, ruleset: 2, checkpointSequence: [1, 3] }
  ), false);
  assert.deepEqual(parseRecordedSplitEvents(null), []);
  assert.deepEqual(parseRecordedSplitEvents(JSON.stringify({ events: [{ kind: "checkpoint", checkpointNumber: 1, elapsedMs: 8420 }] })), [
    { kind: "checkpoint", checkpointNumber: 1, elapsedMs: 8420 }
  ]);
  assert.equal(buildSplitAnalysis({
    timeMs: 10_000,
    events: [
      { kind: "start", elapsedMs: 0 },
      { kind: "checkpoint", checkpointNumber: 1, elapsedMs: 4_000 },
      { kind: "checkpoint", checkpointNumber: 1, elapsedMs: 5_000 },
      { kind: "finish", elapsedMs: 10_000 }
    ]
  }).available, false);
});

test("sums the fastest compatible historical segments and keeps their source run", () => {
  const best = sumBestSegments([
    {
      runId: 11,
      available: true,
      events: [
        { key: "start", segmentMs: null },
        { key: "checkpoint:1", segmentMs: 8_500 },
        { key: "finish", segmentMs: 20_000 }
      ]
    },
    {
      runId: 12,
      available: true,
      events: [
        { key: "start", segmentMs: null },
        { key: "checkpoint:1", segmentMs: 8_200 },
        { key: "finish", segmentMs: 20_400 }
      ]
    }
  ]);

  assert.equal(best.totalMs, 28_200);
  assert.deepEqual(best.segments, [
    { key: "checkpoint:1", segmentMs: 8_200, runId: 12 },
    { key: "finish", segmentMs: 20_000, runId: 11 }
  ]);
});
