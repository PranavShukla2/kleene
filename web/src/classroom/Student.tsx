/**
 * The student's half of the classroom (phase C6).
 *
 * Join with a code, see what is set, submit the machine currently in the editor, and read back
 * every attempt with what each one got wrong.
 *
 * ## Submitting is deliberately the editor's document
 *
 * There is no separate "assignment workspace". A student draws in the editor they already know
 * and presses submit here, and the thing submitted is the document the editor holds. Two
 * documents would mean deciding which one Save saves, and the wrong answer to that question
 * loses somebody's work.
 *
 * ## Every attempt is kept
 *
 * Not just the latest. A student asking "what did I submit at four o'clock" deserves an
 * answer, and an appeal needs the history — so the list is every submission, most recent
 * first, each with the counterexample it earned. Keeping only the last one throws both away
 * to save a row.
 */

import { useCallback, useEffect, useState } from 'react';

import { Pill } from '@/site/Badge';
import { Lift, Reveal, RevealGroup, RevealItem } from '@/site/motion';
import { Band, BandHeading } from '@/site/page';
import { explain } from '@/teach/explain';
import { useEditor } from '@/store/editor';
import { useSavedAnswer } from '@/teach/useSavedAnswer';
import type { Assignment, Attempt, ClassSummary, ClassroomApi } from '@/classroom/api';
import type { Engine } from '@/wasm/loader';
import type { Route } from '@/router';

export function Student({
  api,
  engine,
  classes,
  generation,
  onSubmitted,
  onJoined,
  onNavigate,
}: {
  api: ClassroomApi;
  engine: Engine | undefined;
  classes: ClassSummary[];
  /** Changes when the assignments have, so the lists below reload. */
  generation: number;
  /** Called after a submission, so the teacher's results table stops showing stale numbers. */
  onSubmitted: () => void;
  onJoined: (joined: ClassSummary) => void;
  onNavigate: (to: Route) => void;
}) {
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);

  return (
    <>
      <Band>
        <BandHeading
          title="Join a class"
          detail="Six characters, read out in a lecture. There is nothing to accept by email and no roster to be added to."
        />
        <Reveal>
          <form
            className="mt-6 flex flex-wrap items-center gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setProblem(undefined);
              void api
                .joinClass(code)
                .then((joined) => {
                  onJoined(joined);
                  setCode('');
                })
                .catch((error: unknown) => {
                  setProblem(error instanceof Error ? error.message : 'That did not work.');
                });
            }}
          >
            <input
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
              }}
              placeholder="ABC234"
              aria-label="Class join code"
              maxLength={6}
              className="w-32 rounded-lg border border-k-border bg-k-surface-raised px-3 py-2 text-center font-mono tracking-widest outline-none focus:border-k-primary"
            />
            <Lift>
              <button
                type="submit"
                disabled={code.length < 6}
                className="rounded-full bg-k-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Join
              </button>
            </Lift>
            {problem && (
              <span role="alert" className="text-sm text-k-error">
                {problem}
              </span>
            )}
          </form>
        </Reveal>
      </Band>

      {classes.map((entry) => (
        <ClassWork
          key={entry.id}
          api={api}
          engine={engine}
          entry={entry}
          generation={generation}
          onSubmitted={onSubmitted}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
}

function ClassWork({
  api,
  engine,
  entry,
  generation,
  onSubmitted,
  onNavigate,
}: {
  api: ClassroomApi;
  engine: Engine | undefined;
  entry: ClassSummary;
  generation: number;
  onSubmitted: () => void;
  onNavigate: (to: Route) => void;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    let live = true;
    void api.assignments(entry.id).then((found) => {
      if (live) setAssignments(found);
    });
    return () => {
      live = false;
    };
  }, [api, entry.id, generation]);

  if (assignments.length === 0) return null;

  return (
    <Band>
      <BandHeading title={entry.name} detail={entry.term} />
      <RevealGroup className="mt-6 grid gap-3">
        {assignments.map((assignment) => (
          <RevealItem key={assignment.id}>
            <Work
              api={api}
              engine={engine}
              assignment={assignment}
              onSubmitted={onSubmitted}
              onNavigate={onNavigate}
            />
          </RevealItem>
        ))}
      </RevealGroup>
    </Band>
  );
}

function Work({
  api,
  engine,
  assignment,
  onSubmitted,
  onNavigate,
}: {
  api: ClassroomApi;
  engine: Engine | undefined;
  assignment: Assignment;
  onSubmitted: () => void;
  onNavigate: (to: Route) => void;
}) {
  // The answer is whatever is in the editor — the same document, seen from here.
  useSavedAnswer();
  const document = useEditor((state) => state.history.present);
  const states = document.automaton.states.length;

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    void api.attempts(assignment.id).then(setAttempts);
  }, [api, assignment.id]);

  useEffect(load, [load]);

  const overdue = assignment.dueAt !== undefined && new Date() > new Date(assignment.dueAt);
  const solved = attempts.some((attempt) => attempt.solved);

  const submit = () => {
    if (!engine) return;
    setSending(true);
    setProblem(undefined);

    void api
      .submit(assignment.id, engine.toKln(document))
      .then(() => {
        load();
        onSubmitted();
      })
      .catch((error: unknown) => {
        setProblem(error instanceof Error ? error.message : 'That did not send.');
      })
      .finally(() => {
        setSending(false);
      });
  };

  return (
    <div className="rounded-2xl border border-k-border bg-k-surface p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium tracking-tight">{assignment.title}</h3>
            {solved && <Pill tone="brand">solved</Pill>}
            {/* Said before the deadline passes, not after. A student who did not know it was
                late learns it at the worst moment. */}
            {overdue && !solved && <Pill tone="soon">past due</Pill>}
          </div>
          <p className="mt-1 text-sm text-k-text-muted">{assignment.prompt}</p>
          <p className="mt-2 font-mono text-xs text-k-text-faint">
            {assignment.budget !== undefined
              ? `at most ${String(assignment.budget)} states`
              : 'no state budget'}
            {assignment.dueAt !== undefined &&
              ` · due ${new Date(assignment.dueAt).toLocaleString()}`}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onNavigate('editor');
            }}
            className="rounded-full border border-k-border px-4 py-1.5 text-sm"
          >
            {states === 0 ? 'Draw an answer' : `Edit (${String(states)} states)`}
          </button>
          <Lift>
            <button
              type="button"
              onClick={submit}
              disabled={sending || states === 0 || !engine}
              className="rounded-full bg-k-primary px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {sending ? 'Sending…' : 'Submit'}
            </button>
          </Lift>
        </div>
      </div>

      {problem && (
        <p role="alert" className="mt-3 text-sm text-k-error">
          {problem}
        </p>
      )}

      {attempts.length > 0 && (
        <ol className="mt-4 space-y-2 border-t border-k-border pt-4">
          {attempts.map((attempt) => (
            <li key={attempt.id} className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="font-mono text-xs text-k-text-faint">
                {new Date(attempt.submittedAt).toLocaleString()}
              </span>
              {attempt.late && <Pill tone="soon">late</Pill>}
              <span className={attempt.solved ? 'text-k-accepting' : 'text-k-text-muted'}>
                {attempt.solved
                  ? `Solved — ${String(attempt.states)} states.`
                  : /* The whole point of the project, in the place a mark would normally
                       go: what was wrong, not that something was. */
                    attempt.feedback?.failure
                    ? explain(attempt.feedback.failure)
                    : 'Not accepted.'}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
