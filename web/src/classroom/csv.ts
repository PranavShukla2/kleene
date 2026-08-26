/**
 * A class's results, as the same CSV `kleene grade` produces (phase C5.3).
 *
 * Named `csv.ts` rather than `results.ts`, beside `Results.tsx`. Two files differing only in
 * case is the collision this project has now hit five times — macOS resolves it and CI does
 * not — and the rule it settled on is that a data file never shares a name with its component.
 * Here the compiler caught it immediately, which is the difference between this and the ts-rs
 * version of the same mistake: that one is silent.
 *
 * ## Why the columns are copied rather than chosen
 *
 * A lecturer may mark through the browser or through the command line, and the two paths must
 * not produce different spreadsheets. If they disagree — a column renamed, an order swapped —
 * then whichever one a department automates against is the one that becomes the real format,
 * and the other quietly becomes wrong.
 *
 * So the header is `kleene grade`'s header, verbatim:
 *
 *     file,verdict,counterexample,direction,states
 *
 * `file` holds the student rather than a filename here, which is the one honest difference:
 * there is no file in this path. Everything else means exactly what it means there, including
 * `direction` being written from the submission's point of view, because that is who reads it.
 *
 * The quoting rule is copied for the same reason. A student's display name is far more likely
 * to contain a comma than a filename is — "Doe, Jane" is how half of a roster is written.
 */

import type { Standing } from '@/classroom/api';

/** A CSV field, quoted when it has to be. Same rule as the CLI's. */
function field(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Results as CSV.
 *
 * Sorted by name, because a report whose row order changes between runs cannot be diffed
 * against the previous one — and re-exporting after a late submission is the second thing
 * anyone does.
 */
export function asCsv(standings: readonly Standing[]): string {
  const rows = [...standings].sort((a, b) => a.displayName.localeCompare(b.displayName));

  const lines = rows.map((row) => {
    const verdict = row.solved ? 'correct' : row.attempts > 0 ? 'wrong' : 'not submitted';
    // Only a failure carries a witness, and only a submitted one carries a direction.
    const witness = row.solved || row.attempts === 0 ? '' : (row.lastFailure ?? '');
    const direction = witness === '' ? '' : 'submission disagrees';
    const states = row.bestStates !== undefined ? String(row.bestStates) : '';

    return [field(row.displayName), verdict, field(witness), direction, states].join(',');
  });

  return ['file,verdict,counterexample,direction,states', ...lines].join('\n') + '\n';
}

/** A filename that sorts and does not collide. */
export function csvName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'results'}.csv`;
}
