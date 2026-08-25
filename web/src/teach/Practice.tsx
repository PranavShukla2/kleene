/**
 * The problem set, as a page (teaching layer C1–C3).
 *
 * Twenty problems in difficulty order, each one click from being solved, with what you have
 * done kept in this browser and exportable to a file.
 *
 * ## Why the tiers are headings rather than filters
 *
 * The gallery filters, because someone browsing examples arrives looking for a particular kind
 * of machine. Someone working a problem set arrives to *work through it*, and the order is the
 * teaching — a filter that lets you start at "pathological" is a filter that lets you conclude
 * the subject is beyond you on your first evening.
 *
 * ## Why there is no percentage
 *
 * "17 of 20" is a fact. "85%" is a grade, and task B4 rules grading out for the same reason it
 * rules out attempt counters: this is practice, and a number that looks like a mark changes
 * what someone optimises for.
 */

import { useMemo, useState } from 'react';

import { Pill } from '@/site/Badge';
import { Lift, Reveal, RevealGroup, RevealItem } from '@/site/motion';
import { Band, BandHeading, Masthead } from '@/site/page';
import {
  clearProgress,
  exportProgress,
  importProgress,
  readProgress,
  tally,
  type Progress,
} from '@/teach/progress';
import type { SetProblem } from '@/model/automaton';
import type { Engine } from '@/wasm/loader';

const TIERS = [
  { id: 'introductory', title: 'Start here', blurb: 'Draw it straight from the description.' },
  {
    id: 'standard',
    title: 'The ordinary business of the course',
    blurb: 'A moment’s thought about what the states have to remember.',
  },
  {
    id: 'pathological',
    title: 'Where the intuition runs out',
    blurb: 'The states stand for something the wording does not say.',
  },
] as const;

export function Practice({
  engine,
  onOpen,
}: {
  engine: Engine | undefined;
  /** Open one problem in the solve view. */
  onOpen: (problem: SetProblem) => void;
}) {
  const problems = useMemo(() => engine?.problemSet() ?? [], [engine]);
  const [progress, setProgress] = useState<Progress>(readProgress);
  const [note, setNote] = useState<string | undefined>(undefined);

  const counts = tally(
    progress,
    problems.map((problem) => problem.key),
  );

  const download = () => {
    const blob = new Blob([exportProgress(progress)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kleene-progress.json';
    link.click();
    requestAnimationFrame(() => {
      URL.revokeObjectURL(url);
    });
  };

  const upload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      void file.text().then((text) => {
        const merged = importProgress(text);
        if (merged) {
          setProgress(merged);
          setNote('Progress merged. Nothing already solved was lost.');
        } else {
          setNote('That file is not a Kleene progress export.');
        }
      });
    });
    input.click();
  };

  return (
    <main>
      <Masthead
        eyebrow="Practice"
        title="Twenty problems, in the order they get harder."
        detail="Each one is a language to build a machine for. Check as often as you like — nothing is scored, nothing is timed, and a wrong answer comes back with the string that proves it wrong."
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm text-k-text-muted">
            {counts.solved} of {counts.total} solved
          </span>
          {counts.attempted > counts.solved && (
            <span className="font-mono text-sm text-k-text-faint">
              {counts.attempted - counts.solved} in progress
            </span>
          )}
        </div>
      </Masthead>

      {TIERS.map((tier) => {
        const inTier = problems.filter((problem) => problem.tier === tier.id);
        if (inTier.length === 0) return null;

        return (
          <Band key={tier.id}>
            <BandHeading title={tier.title} detail={tier.blurb} />
            <RevealGroup className="mt-6 grid gap-3">
              {inTier.map((problem) => {
                const done = progress[problem.key];
                return (
                  <RevealItem key={problem.key}>
                    <button
                      type="button"
                      onClick={() => {
                        onOpen(problem);
                      }}
                      className="k-card flex w-full flex-col gap-2 rounded-2xl border border-k-border bg-k-surface p-5 text-left hover:border-k-primary/50 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium tracking-tight">{problem.spec.prompt}</h3>
                          {done?.solved && <Pill tone="brand">solved</Pill>}
                          {!done?.solved && done?.attempted && <Pill tone="soon">tried</Pill>}
                        </div>
                        <p className="mt-1 text-sm text-k-text-muted">{problem.about}</p>
                      </div>

                      <div className="shrink-0 text-right font-mono text-xs text-k-text-faint sm:ml-auto">
                        {problem.spec.budget !== undefined && problem.spec.budget !== null && (
                          <div>{problem.spec.budget} states</div>
                        )}
                        {done?.best !== undefined && <div>your best: {done.best}</div>}
                      </div>
                    </button>
                  </RevealItem>
                );
              })}
            </RevealGroup>
          </Band>
        );
      })}

      <Band>
        <Reveal>
          <div className="rounded-3xl border border-k-border p-8">
            <h2 className="text-xl font-semibold tracking-tight">Keeping this</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-k-text-muted">
              Your progress is in this browser and nowhere else — there is no account, so there
              is also no copy to restore from. Clearing site data clears this. Export it if it
              matters to you, and importing merges rather than replaces, so nothing already
              solved is lost.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Lift>
                <button
                  type="button"
                  onClick={download}
                  className="rounded-full border border-k-border-strong bg-k-surface-raised px-4 py-2 text-sm font-medium"
                >
                  Export progress
                </button>
              </Lift>
              <Lift>
                <button
                  type="button"
                  onClick={upload}
                  className="rounded-full border border-k-border-strong bg-k-surface-raised px-4 py-2 text-sm font-medium"
                >
                  Import
                </button>
              </Lift>
              <button
                type="button"
                onClick={() => {
                  setProgress(clearProgress());
                  setNote('Progress cleared.');
                }}
                className="rounded-full px-3 py-2 text-sm text-k-text-faint hover:text-k-error"
              >
                Clear
              </button>
              {note && (
                <span role="status" className="text-sm text-k-text-muted">
                  {note}
                </span>
              )}
            </div>
          </div>
        </Reveal>
      </Band>
    </main>
  );
}
