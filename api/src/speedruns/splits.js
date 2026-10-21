"use strict";

function finiteMs(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function checkpointNumber(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeEvent(event) {
  if (!event || typeof event !== "object") return null;
  const rawKind = String(event.kind || event.type || event.event || "").toLowerCase();
  const kind = rawKind === "start" || rawKind === "begin" ? "start"
    : rawKind === "finish" || rawKind === "end" ? "finish"
    : rawKind === "checkpoint" || rawKind === "cp" ? "checkpoint"
    : null;
  const elapsedMs = finiteMs(event.elapsedMs ?? event.timeMs ?? event.time ?? event.t);
  if (!kind || elapsedMs == null) return null;
  const number = kind === "checkpoint"
    ? checkpointNumber(event.checkpointNumber ?? event.number ?? event.checkpoint)
    : null;
  if (kind === "checkpoint" && number == null) return null;
  return {
    kind,
    ...(number == null ? {} : { checkpointNumber: number }),
    elapsedMs
  };
}

function parseRecordedSplitEvents(raw) {
  if (raw == null || raw === "") return [];
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const events = Array.isArray(value) ? value : Array.isArray(value?.events) ? value.events : [];
  return events.map(normalizeEvent).filter(Boolean);
}

function frameTimeMs(frame) {
  const value = Number(frame?.t);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 1000) : null;
}

function pointInsideZone(frame, zone) {
  if (!frame || !zone?.position) return false;
  const x = Number(frame.x);
  const y = Number(frame.y);
  const z = Number(frame.z);
  const center = zone.position;
  const centerX = Number(center.x);
  const centerY = Number(center.y);
  const centerZ = Number(center.z);
  const radius = Number(zone.radius);
  const height = Number(zone.height);
  if (![x, y, z, centerX, centerY, centerZ, radius, height].every(Number.isFinite)) return false;
  const horizontalDistance = Math.hypot(x - centerX, y - centerY);
  return horizontalDistance <= Math.max(1, radius) && Math.abs(z - centerZ) <= Math.max(1, height / 2);
}

function deriveCheckpointEvents({ frames, zones, startTime = null, finishTime = null } = {}) {
  if (!Array.isArray(frames) || !frames.length || !Array.isArray(zones?.checkpoints) || !zones.checkpoints.length) return [];
  const sortedFrames = frames
    .filter(frame => frameTimeMs(frame) != null)
    .slice()
    .sort((a, b) => Number(a.t) - Number(b.t));
  if (!sortedFrames.length) return [];

  const firstReplayTimeMs = frameTimeMs(sortedFrames[0]);
  const lowerBoundMs = finiteMs(startTime) ?? firstReplayTimeMs;
  const upperBoundMs = finiteMs(finishTime);
  const events = [];
  let previousTimeMs = lowerBoundMs;

  for (const checkpoint of zones.checkpoints.slice().sort((a, b) => Number(a.checkpointNumber) - Number(b.checkpointNumber))) {
    const crossing = sortedFrames.find((frame, index) => {
      const timeMs = frameTimeMs(frame);
      if (timeMs == null || timeMs < lowerBoundMs || (upperBoundMs != null && timeMs > upperBoundMs) || timeMs < previousTimeMs) return false;
      if (!pointInsideZone(frame, checkpoint)) return false;
      const previous = sortedFrames[index - 1];
      return !previous || !pointInsideZone(previous, checkpoint);
    });
    if (!crossing) return [];
    const absoluteTimeMs = frameTimeMs(crossing);
    const elapsedMs = Math.max(0, absoluteTimeMs - lowerBoundMs);
    events.push({ kind: "checkpoint", checkpointNumber: Number(checkpoint.checkpointNumber), elapsedMs });
    previousTimeMs = absoluteTimeMs;
  }
  return events;
}

function eventKey(event) {
  return event.kind === "checkpoint" ? `checkpoint:${event.checkpointNumber}` : event.kind;
}

function buildSplitAnalysis({ timeMs, events } = {}) {
  const officialFinishMs = finiteMs(timeMs);
  const unique = new Map();
  let duplicateEvent = false;
  for (const event of parseRecordedSplitEvents(events)) {
    const key = eventKey(event);
    if (unique.has(key)) {
      duplicateEvent = true;
    } else {
      unique.set(key, event);
    }
  }
  if (officialFinishMs != null && unique.has("finish")) {
    unique.set("finish", { ...unique.get("finish"), elapsedMs: officialFinishMs });
  }
  const ordered = [...unique.values()].sort((a, b) => (
    a.elapsedMs - b.elapsedMs || (a.kind === "start" ? -1 : b.kind === "start" ? 1 : 0) || (a.checkpointNumber || 0) - (b.checkpointNumber || 0)
  ));
  const startIndex = ordered.findIndex(event => event.kind === "start");
  const finishIndex = ordered.findIndex(event => event.kind === "finish");
  const hasCompleteWindow = startIndex >= 0 && finishIndex > startIndex;
  const eventsInWindow = hasCompleteWindow ? ordered.slice(startIndex, finishIndex + 1) : [];
  const validOrder = eventsInWindow.every((event, index, list) => {
    if (index === 0 || event.kind !== "checkpoint") return true;
    const previous = list[index - 1];
    return previous.kind !== "checkpoint" || event.checkpointNumber > previous.checkpointNumber;
  });
  const available = hasCompleteWindow && validOrder && !duplicateEvent && eventsInWindow[0].elapsedMs === 0;
  const splitEvents = available ? eventsInWindow.map((event, index) => ({
    ...event,
    key: eventKey(event),
    segmentMs: index === 0 ? null : event.elapsedMs - eventsInWindow[index - 1].elapsedMs
  })) : [];
  return {
    available,
    precision: available ? "ms" : null,
    events: splitEvents,
    finishMs: officialFinishMs ?? (splitEvents.at(-1)?.elapsedMs ?? null)
  };
}

function compatibleSplitMetadata(a, b) {
  if (!a || !b) return false;
  if (String(a.map || "") !== String(b.map || "")) return false;
  if (Number(a.classId) !== Number(b.classId)) return false;
  if (Number(a.ruleset) !== Number(b.ruleset)) return false;
  const aSequence = JSON.stringify(a.checkpointSequence || []);
  const bSequence = JSON.stringify(b.checkpointSequence || []);
  return aSequence === bSequence;
}

function compareSplitEvents(current, comparison) {
  if (!current?.available || !comparison?.available) return [];
  const comparisonByKey = new Map(comparison.events.map(event => [event.key, event]));
  return current.events.map(event => {
    const other = comparisonByKey.get(event.key);
    if (!other) return { ...event, comparisonElapsedMs: null, comparisonSegmentMs: null, cumulativeDeltaMs: null, segmentDeltaMs: null };
    return {
      ...event,
      comparisonElapsedMs: other.elapsedMs,
      comparisonSegmentMs: other.segmentMs,
      cumulativeDeltaMs: event.elapsedMs - other.elapsedMs,
      segmentDeltaMs: event.segmentMs == null || other.segmentMs == null ? null : event.segmentMs - other.segmentMs
    };
  });
}

function sumBestSegments(analyses) {
  const byKey = new Map();
  for (const analysis of analyses || []) {
    if (!analysis?.available) continue;
    for (const event of analysis.events) {
      if (event.segmentMs == null) continue;
      const existing = byKey.get(event.key);
      if (!existing || event.segmentMs < existing.segmentMs) {
        byKey.set(event.key, { key: event.key, segmentMs: event.segmentMs, runId: analysis.runId ?? null });
      }
    }
  }
  const segments = [...byKey.values()];
  return {
    available: segments.length > 0,
    segments,
    totalMs: segments.reduce((sum, segment) => sum + segment.segmentMs, 0)
  };
}

module.exports = {
  buildSplitAnalysis,
  compareSplitEvents,
  compatibleSplitMetadata,
  deriveCheckpointEvents,
  parseRecordedSplitEvents,
  sumBestSegments
};
