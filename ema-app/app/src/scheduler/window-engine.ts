/**
 * Computes prompt fire times within daily time windows.
 *
 * EMA best practice: divide the allowed window into N equal sub-windows,
 * then pick a uniformly random time within each sub-window. This prevents
 * clustering while still preserving randomness.
 */

interface TimeWindow {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

function parseHHMM(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Divide the combined window span into N sub-windows and pick a random
 * time within each, respecting the minimum gap constraint.
 */
function randomizeWithinWindows(
  date: Date,
  windows: TimeWindow[],
  totalPrompts: number,
  minGapMinutes: number,
): Date[] {
  // Flatten all windows into a single sorted list of [start, end] ms pairs
  const spans = windows.map((w) => ({
    start: parseHHMM(date, w.start).getTime(),
    end: parseHHMM(date, w.end).getTime(),
  }));

  const totalMs = spans.reduce((sum, s) => sum + (s.end - s.start), 0);
  const subWindowMs = Math.floor(totalMs / totalPrompts);
  const minGapMs = minGapMinutes * 60_000;

  const results: Date[] = [];
  let cursor = spans[0].start;

  for (let i = 0; i < totalPrompts; i++) {
    const subStart = cursor;
    const subEnd = cursor + subWindowMs;

    // Pick a random time in the sub-window, leaving room for min gap
    const jitter = Math.floor(
      Math.random() * Math.max(1, subWindowMs - minGapMs),
    );
    const fireAt = subStart + jitter;

    results.push(new Date(fireAt));
    cursor = subEnd;
  }

  return results;
}

/**
 * Distribute prompts evenly across the window span (deterministic).
 */
function distributeEvenly(
  date: Date,
  windows: TimeWindow[],
  totalPrompts: number,
): Date[] {
  const spans = windows.map((w) => ({
    start: parseHHMM(date, w.start).getTime(),
    end: parseHHMM(date, w.end).getTime(),
  }));

  const totalMs = spans.reduce((sum, s) => sum + (s.end - s.start), 0);
  const stepMs = Math.floor(totalMs / totalPrompts);
  const firstStart = spans[0].start;

  return Array.from(
    { length: totalPrompts },
    (_, i) => new Date(firstStart + stepMs * i + Math.floor(stepMs / 2)),
  );
}

export const windowEngine = { randomizeWithinWindows, distributeEvenly };
