/**
 * What a student has solved (teaching layer C2 and C3).
 *
 * In `localStorage`, because there is no server and there is deliberately never going to be
 * one. That has a consequence the plan is blunt about: this is one cleared cache away from
 * gone, and there is no account to restore it from. So C3 requires export and import, and they
 * are not a nice-to-have — they are the entire backup story.
 *
 * ## What is recorded, and what is deliberately not
 *
 * Three facts per problem: attempted, solved, and solved within the budget. That is enough to
 * show someone where they are and nothing more.
 *
 * There is **no streak counter, no daily goal, and no total score** (task C4, roadmap §9.2).
 * Not an oversight and not austerity. A streak measures showing up rather than understanding,
 * and it punishes exactly the student who took a week off because they were struggling — the
 * one a teaching tool should be most careful with. The mechanics here are the subject: the
 * counterexample, the state budget, the minimal machine. Those are already the game.
 */

const KEY = 'kleene.progress';

/** What is known about one problem. */
export interface Attempt {
  /** Checked at least once. */
  attempted: boolean;
  /** Checked and correct. */
  solved: boolean;
  /** Correct *and* within the stated budget, when there was one. */
  withinBudget: boolean;
  /** The fewest states this student has managed, for golf (task F4). */
  best?: number;
}

export type Progress = Record<string, Attempt>;

const EMPTY: Attempt = { attempted: false, solved: false, withinBudget: false };

/** Read progress, tolerating anything that is not what we expect. */
export function readProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return sanitise(parsed as Record<string, unknown>);
  } catch {
    // Private browsing, blocked storage, corrupt JSON. Losing progress is bad; failing to
    // start is worse, and the student can still solve everything in front of them.
    return {};
  }
}

/**
 * Keep only records that have the shape of a record.
 *
 * This file is one `localStorage` key that anybody can edit in a console, and it is read on
 * every page load. A single malformed entry must not take the list view down with it.
 */
function sanitise(raw: Record<string, unknown>): Progress {
  const out: Progress = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'object' || value === null) continue;
    const record = value as Record<string, unknown>;
    out[key] = {
      attempted: record.attempted === true,
      solved: record.solved === true,
      withinBudget: record.withinBudget === true,
      ...(typeof record.best === 'number' && Number.isFinite(record.best)
        ? { best: record.best }
        : {}),
    };
  }
  return out;
}

function write(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage full or blocked. Non-fatal, as above.
  }
}

/** Record the outcome of one check. */
export function record(
  key: string,
  outcome: { solved: boolean; withinBudget: boolean; states: number },
): Progress {
  const progress = readProgress();
  const previous = progress[key] ?? EMPTY;

  progress[key] = {
    attempted: true,
    // Never revoked. A student who solves a problem and then keeps experimenting has not
    // un-learned it, and watching a tick disappear because you tried something is a reason to
    // stop trying things.
    solved: previous.solved || outcome.solved,
    withinBudget: previous.withinBudget || outcome.withinBudget,
    best: outcome.solved
      ? Math.min(previous.best ?? Number.POSITIVE_INFINITY, outcome.states)
      : previous.best,
  };

  write(progress);
  return progress;
}

/** Forget everything. */
export function clearProgress(): Progress {
  write({});
  return {};
}

/** How far through the set someone is. */
export function tally(progress: Progress, keys: readonly string[]) {
  const solved = keys.filter((key) => progress[key]?.solved).length;
  const attempted = keys.filter((key) => progress[key]?.attempted).length;
  return { solved, attempted, total: keys.length };
}

/** The file format for export. Versioned, so an old export still imports. */
export interface ProgressFile {
  kind: 'kleene-progress';
  version: 1;
  saved: string;
  progress: Progress;
}

/** Progress as a file's worth of text. */
export function exportProgress(progress = readProgress()): string {
  const file: ProgressFile = {
    kind: 'kleene-progress',
    version: 1,
    saved: new Date().toISOString(),
    progress,
  };
  return JSON.stringify(file, null, 2);
}

/**
 * Read an exported file back.
 *
 * Merged with what is already stored rather than replacing it, because the realistic import is
 * "I moved to a different machine" and not "I want to erase today". Solved stays solved on
 * either side — the union is the only merge that cannot lose a solved problem, and losing one
 * is the only outcome here that would matter.
 */
export function importProgress(text: string): Progress | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }

  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const file = parsed as Partial<ProgressFile>;
  if (file.kind !== 'kleene-progress') return undefined;
  if (typeof file.progress !== 'object' || file.progress === null) return undefined;

  const incoming = sanitise(file.progress);
  const merged = readProgress();

  for (const [key, attempt] of Object.entries(incoming)) {
    const existing = merged[key] ?? EMPTY;
    merged[key] = {
      attempted: existing.attempted || attempt.attempted,
      solved: existing.solved || attempt.solved,
      withinBudget: existing.withinBudget || attempt.withinBudget,
      best: bestOf(existing.best, attempt.best),
    };
  }

  write(merged);
  return merged;
}

function bestOf(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
}
