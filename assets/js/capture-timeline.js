"use strict";

// Display-only normalization of the API's concatenated gameplay clock.
// Replay recording epochs and fixed round lengths are not interchangeable.
window.nnCaptureTimeline = (() => {
  const number = value => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
  const clock = seconds => seconds == null ? "—" : `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  function build(match, source = match.capTimeline || []) {
    const records = Array.isArray(match.rounds) ? match.rounds : [];
    const roundIds = [...records, ...(match.round_player_stats || [])].map(r => number(r.round_num)).filter(n => n > 0);
    const rounds = [];
    let start = 0;
    for (const record of records.slice().sort((a, b) => Number(a.round_num) - Number(b.round_num))) {
      const id = number(record.round_num), duration = number(record.duration_seconds);
      if (id !== rounds.length + 1 || duration === null || duration <= 0 || records.filter(r => number(r.round_num) === id).length !== 1) break;
      rounds.push({ id, start, duration, end: start + duration, events: [] });
      start += duration;
    }
    const events = source.map(event => ({
      ...event,
      time_seconds: number(event.time_seconds ?? event.timeSeconds),
      cap_num: event.cap_num ?? event.capNumber ?? event.cap,
      capper_name: event.capper_name || event.capperName || ""
    })).filter(e => e.time_seconds !== null && e.time_seconds >= 0)
      .sort((a, b) => a.time_seconds - b.time_seconds).map(event => {
        let round = rounds.find(r => event.time_seconds >= r.start && event.time_seconds <= r.end);
        // Without a capture round ID, a shared boundary is ambiguous.
        if (round && event.time_seconds === round.end && roundIds.some(id => id > round.id)) round = null;
        const relative = { ...event, round: round?.id ?? null, round_time_seconds: round ? event.time_seconds - round.start : null };
        if (round) round.events.push(relative);
        return relative;
      });
    return { rounds, events, extent: Math.max(1, ...rounds.map(r => r.duration)) };
  }
  return { build, clock };
})();
