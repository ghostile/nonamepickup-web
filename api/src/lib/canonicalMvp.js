"use strict";

// 2026-10-07 12:00:00 America/New_York (EDT, UTC-04:00).
const NN_MVP_CUTOFF_EPOCH = 1791388800;

function isNnMvpCanonicalMatch(createdAt) {
  const timestamp = Number(createdAt);
  return Number.isFinite(timestamp) && timestamp >= NN_MVP_CUTOFF_EPOCH;
}

function canonicalMvpSource(createdAt) {
  return isNnMvpCanonicalMatch(createdAt) ? "nn" : "hampalyzer";
}

module.exports = {
  NN_MVP_CUTOFF_EPOCH,
  isNnMvpCanonicalMatch,
  canonicalMvpSource
};
