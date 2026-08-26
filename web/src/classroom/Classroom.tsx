/**
 * The classroom, behind the development latch.
 *
 * Two things on one route: the locked view a visitor meets, and the classroom itself once the
 * PIN has been entered. Kept in one file because they are one page in two states, and splitting
 * them would mean two places deciding which to show.
 */

import { useEffect, useState } from 'react';

import { Pill } from '@/site/Badge';
import { Lift, Reveal, RevealGroup, RevealItem } from '@/site/motion';
import { Band, BandHeading, Masthead } from '@/site/page';
import { useAccount, useClassroomApi, hasServer } from '@/classroom/useClassroom';
import { signInLocally } from '@/classroom/local';
import { lock, tryPin, unlocked } from '@/classroom/gate';
import { Compose } from '@/classroom/Compose';
import { Student } from '@/classroom/Student';
import { Results } from '@/classroom/Results';
import type { Assignment, ClassSummary } from '@/classroom/api';
import type { Engine } from '@/wasm/loader';
import type { Route } from '@/router';

export function Classroom({
  engine,
  onNavigate,
}: {
  engine: Engine | undefined;
  onNavigate: (to: Route) => void;
}) {
  const [open, setOpen] = useState(unlocked);
  return open ? (
    <Inside
      engine={engine}
      onNavigate={onNavigate}
      onLock={() => {
        lock();
        setOpen(false);
      }}
    />
  ) : (
    <Locked
      onNavigate={onNavigate}
      onOpen={() => {
        setOpen(true);
      }}
    />
  );
}

/** What someone following a link sees. */
function Locked({
  onNavigate,
  onOpen,
}: {
  onNavigate: (to: Route) => void;
  onOpen: () => void;
}) {
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);

  return (
    <main>
      <Masthead
        eyebrow="Classroom"
        title="Not finished yet."
        detail="Set an assignment, hand out a join code, and see who has solved what — with every submission re-checked by the same engine that draws the diagrams. It is being built; there is nothing to sign in to today."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone="soon">Coming soon</Pill>
          <Lift>
            <button
              type="button"
              onClick={() => {
                onNavigate('practice');
              }}
              className="k-glow rounded-full bg-k-primary px-5 py-3 font-medium text-white"
            >
              Try the problem set instead →
            </button>
          </Lift>
        </div>
      </Masthead>

      <Band>
        <BandHeading
          title="What it will do"
          detail="Everything below already works signed out — the classroom adds who did it and when, and nothing else."
        />
        <RevealGroup className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: 'A class with a join code',
              detail:
                'Six characters read out in a lecture. No email invitations, no roster upload, nothing for anyone’s IT department to approve.',
            },
            {
              title: 'Assignments that check themselves',
              detail:
                'Set a language and an optional state budget. Every submission is re-checked on the server by the same Rust engine the browser uses — so a student cannot claim a pass, and there is one definition of correct.',
            },
            {
              title: 'Results with counterexamples',
              detail:
                'Not a mark. Who solved it, how many states they used, and the shortest string the others got wrong — which is the part a student can act on.',
            },
          ].map((card) => (
            <RevealItem
              key={card.title}
              className="rounded-2xl border border-k-border bg-k-surface p-5"
            >
              <h3 className="font-medium tracking-tight">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-k-text-muted">{card.detail}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Band>

      <Band>
        <Reveal>
          <details className="rounded-2xl border border-k-border p-5">
            <summary className="cursor-pointer text-sm text-k-text-faint">
              Working on this?
            </summary>
            <form
              className="mt-4 flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void tryPin(pin).then((ok) => {
                  if (ok) onOpen();
                  else setWrong(true);
                });
              }}
            >
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(event) => {
                  setPin(event.target.value);
                  setWrong(false);
                }}
                aria-label="Development PIN"
                placeholder="PIN"
                className="w-28 rounded-lg border border-k-border bg-k-surface-raised px-3 py-1.5 font-mono text-sm outline-none focus:border-k-primary"
              />
              <button
                type="submit"
                className="rounded-full border border-k-border-strong bg-k-surface-raised px-4 py-1.5 text-sm font-medium"
              >
                Open
              </button>
              {wrong && (
                <span role="alert" className="text-sm text-k-error">
                  Not that one.
                </span>
              )}
            </form>
          </details>
        </Reveal>
      </Band>
    </main>
  );
}

/** The classroom, once someone is in. */
function Inside({
  engine,
  onLock,
  onNavigate,
}: {
  engine: Engine | undefined;
  onLock: () => void;
  onNavigate: (to: Route) => void;
}) {
  const api = useClassroomApi(engine);
  const { account, loading, refresh, signOut } = useAccount(api);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  /** Which class is having an assignment written for it, if any. */
  const [composing, setComposing] = useState<string | undefined>(undefined);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  /*
    Bumped whenever the set of assignments changes, and passed down so the student's list
    reloads.

    Needed because teacher and student are two views of one state here, and the student's list
    is fetched once when it mounts. Setting an assignment left it stale — invisible in a
    two-person system, where the teacher and the student are different browsers, and immediate
    in this one. A counter rather than lifting the whole list, because the list belongs to the
    view that shows it.
  */
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    // Nothing to fetch signed out, and nothing to clear either: the list is rendered only when
    // there is an account, so emptying it here would be a render to hide something invisible.
    if (!account) return;

    let live = true;
    void api
      .classes()
      .then((found) => {
        if (live) setClasses(found);
      })
      .catch((problem: unknown) => {
        if (live)
          setError(problem instanceof Error ? problem.message : 'Something went wrong.');
      });

    return () => {
      live = false;
    };
  }, [api, account]);

  return (
    <main>
      <Masthead
        eyebrow="Classroom · in development"
        title={account ? `Signed in as ${account.displayName}` : 'Sign in to begin'}
        detail={
          hasServer
            ? 'Talking to the API.'
            : 'No server is configured, so this classroom lives entirely in this browser. Everything works — creating a class, setting an assignment, submitting and being checked — but only for you, on this machine.'
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          {account ? (
            <>
              <Lift>
                <button
                  type="button"
                  onClick={() => {
                    void api
                      .createClass({ name: 'Formal Languages', term: 'Autumn 2026' })
                      .then((created) => {
                        setClasses((was) => [...was, created]);
                      });
                  }}
                  className="k-glow rounded-full bg-k-primary px-5 py-3 font-medium text-white"
                >
                  Create a class
                </button>
              </Lift>
              <button
                type="button"
                onClick={signOut}
                className="rounded-full border border-k-border px-4 py-2 text-sm"
              >
                Sign out
              </button>
            </>
          ) : (
            <Lift>
              <button
                type="button"
                onClick={() => {
                  // The local stand-in for the Google round trip. The real adapter sends the
                  // browser to `api.signInUrl()` instead; nothing else on this page changes.
                  signInLocally('Development user', 'dev@example.test');
                  refresh();
                }}
                className="k-glow rounded-full bg-k-primary px-5 py-3 font-medium text-white"
              >
                {hasServer ? 'Sign in with Google' : 'Sign in (local)'}
              </button>
            </Lift>
          )}
          <button
            type="button"
            onClick={onLock}
            className="rounded-full px-3 py-2 text-sm text-k-text-faint hover:text-k-text"
          >
            Lock again
          </button>
        </div>
      </Masthead>

      {error && (
        <Band>
          <p role="alert" className="text-sm text-k-error">
            {error}
          </p>
        </Band>
      )}

      {account && (
        <Band>
          <BandHeading
            title="Your classes"
            detail={
              classes.length === 0
                ? 'None yet. Create one, and the join code is what students use.'
                : 'The join code is read out in a lecture — there is nothing to email.'
            }
          />
          <RevealGroup className="mt-6 grid gap-3">
            {classes.map((entry) => (
              <RevealItem
                key={entry.id}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-k-border bg-k-surface p-5"
              >
                <div>
                  <h3 className="font-medium tracking-tight">{entry.name}</h3>
                  <p className="mt-1 text-sm text-k-text-muted">
                    {entry.term} · {entry.studentCount} enrolled · {entry.assignmentCount}{' '}
                    assignments
                  </p>
                </div>
                <code
                  title="Students join with this. Read it out; there is nothing to email."
                  className="ml-auto rounded-full border border-k-border px-3 py-1 font-mono text-sm"
                >
                  {entry.joinCode}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    setComposing(composing === entry.id ? undefined : entry.id);
                  }}
                  className="rounded-full border border-k-border-strong bg-k-surface-raised px-4 py-1.5 text-sm font-medium"
                >
                  {composing === entry.id ? 'Close' : 'Set an assignment'}
                </button>

                {composing === entry.id && (
                  <div className="w-full">
                    <Compose
                      engine={engine}
                      onCancel={() => {
                        setComposing(undefined);
                      }}
                      onCreate={(input) => {
                        void api.createAssignment(entry.id, input).then((created) => {
                          setAssignments((was) => [...was, created]);
                          setGeneration((was) => was + 1);
                          setComposing(undefined);
                          setClasses((was) =>
                            was.map((candidate) =>
                              candidate.id === entry.id
                                ? {
                                    ...candidate,
                                    assignmentCount: candidate.assignmentCount + 1,
                                  }
                                : candidate,
                            ),
                          );
                        });
                      }}
                    />
                  </div>
                )}

                {assignments
                  .filter((assignment) => assignment.classId === entry.id)
                  .map((assignment) => (
                    <div
                      key={assignment.id}
                      className="w-full rounded-xl border border-k-border bg-k-surface-raised p-4"
                    >
                      <p className="text-sm font-medium">{assignment.title}</p>
                      <p className="mt-1 text-sm text-k-text-muted">{assignment.prompt}</p>
                      <p className="mt-2 font-mono text-xs text-k-text-faint">
                        {assignment.budget !== undefined
                          ? `at most ${String(assignment.budget)} states`
                          : 'no state budget'}
                        {assignment.dueAt !== undefined &&
                          ` · due ${new Date(assignment.dueAt).toLocaleString()}`}
                      </p>

                      <Results api={api} assignment={assignment} generation={generation} />
                    </div>
                  ))}
              </RevealItem>
            ))}
          </RevealGroup>
        </Band>
      )}

      {account && (
        <Student
          api={api}
          engine={engine}
          classes={classes}
          generation={generation}
          onSubmitted={() => {
            setGeneration((was) => was + 1);
          }}
          onJoined={(joined) => {
            // Replace rather than append: joining a class you are already in is idempotent on
            // the server, and appending would show it twice.
            setClasses((was) => [...was.filter((entry) => entry.id !== joined.id), joined]);
          }}
          onNavigate={onNavigate}
        />
      )}

      {loading && (
        <Band>
          <p className="text-sm text-k-text-faint">Checking who is signed in…</p>
        </Band>
      )}
    </main>
  );
}
