/**
 * Who has solved what (phase C5.3).
 *
 * Deliberately not a gradebook. The columns are: who, how many attempts, whether it is solved,
 * how small their machine is, and — for anyone who has not got it — the string their last
 * submission got wrong.
 *
 * ## Why there is no mark
 *
 * Because the system does not know one. It knows whether a machine accepts the right language
 * and how many states it used; turning that into a number out of ten is a judgement made with
 * context this table does not have — how much the topic is worth, whether an extension was
 * agreed, what the student did in the tutorial. A `grade` column would invite the table to
 * pretend it knew, and a lecturer would end up correcting it.
 *
 * What it does instead is make the *feedback* free. The counterexample column is the thing
 * worth handing back, and it costs nothing extra to hand back once it is a column.
 */

import { useEffect, useState } from 'react';

import { Pill } from '@/site/Badge';
import { asCsv, csvName } from '@/classroom/csv';
import type { Assignment, ClassroomApi, Standing } from '@/classroom/api';

export function Results({
  api,
  assignment,
  generation,
}: {
  api: ClassroomApi;
  assignment: Assignment;
  /** Changes when a submission has been made, so the table reloads. */
  generation: number;
}) {
  const [standings, setStandings] = useState<Standing[]>([]);

  useEffect(() => {
    let live = true;
    void api.standings(assignment.id).then((found) => {
      if (live) setStandings(found);
    });
    return () => {
      live = false;
    };
  }, [api, assignment.id, generation]);

  if (standings.length === 0) {
    return (
      <p className="mt-3 border-t border-k-border pt-3 text-xs text-k-text-faint">
        Nobody has submitted yet.
      </p>
    );
  }

  const download = () => {
    const blob = new Blob([asCsv(standings)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = csvName(assignment.title);
    link.click();
    requestAnimationFrame(() => {
      URL.revokeObjectURL(url);
    });
  };

  const solved = standings.filter((row) => row.solved).length;

  return (
    <div className="mt-3 border-t border-k-border pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-k-text-faint">
          {solved} of {standings.length} solved
        </p>
        <button
          type="button"
          onClick={download}
          title="The same columns kleene grade writes, so a spreadsheet built on one works on the other"
          className="ml-auto rounded-full border border-k-border px-3 py-1 font-mono text-xs text-k-text-muted hover:border-k-primary/50 hover:text-k-text"
        >
          export csv
        </button>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-auto border-collapse text-sm">
          <thead>
            <tr className="text-left">
              {['Student', 'Attempts', 'States', 'Last failure'].map((heading) => (
                <th
                  key={heading}
                  className="px-3 py-1.5 font-mono text-[10px] tracking-wider text-k-text-faint uppercase"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.studentId} className="border-t border-k-border/60">
                <td className="px-3 py-1.5">
                  <span className="flex items-center gap-2">
                    {row.displayName}
                    {row.solved && <Pill tone="brand">solved</Pill>}
                  </span>
                </td>
                <td className="px-3 py-1.5 font-mono text-xs text-k-text-muted">
                  {row.attempts}
                </td>
                <td className="px-3 py-1.5 font-mono text-xs text-k-text-muted">
                  {row.bestStates ?? '—'}
                </td>
                <td className="px-3 py-1.5 font-mono text-xs text-k-text-muted">
                  {/* The column that turns a grade into feedback. Empty when there is nothing
                      to say, rather than a word that would read as data. */}
                  {row.solved ? '' : (row.lastFailure ?? '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
