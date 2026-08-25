/**
 * Solving a problem someone handed you (teaching layer Track B).
 *
 * The whole page is: a prompt, the editor you already know, and a Check button. Nothing about
 * the editing is different from `/editor` — deliberately, because a student who learns to draw
 * a machine here should be able to draw one anywhere, and a stripped-down "assignment editor"
 * would be a second implementation of the thing this project exists to have exactly one of.
 *
 * ## The honesty note is not boilerplate
 *
 * Task B5 requires the page to say, in the UI rather than in documentation, that the check
 * happens in the browser and the answer is therefore inspectable. That is not a legal
 * disclaimer — it is the difference between a tool a student trusts and one they catch out.
 * Someone who discovers on their own that the target language is sitting in the URL will
 * reasonably stop believing anything else the tool tells them.
 *
 * It also points at the thing that *is* trustworthy: `kleene grade`, where the reference lives
 * on the marker's machine and the student never had it.
 */

import { useCallback, useState } from 'react';

import { AutomatonView } from '@/canvas/AutomatonView';
import { rowLayout } from '@/canvas/geometry';
import { FeedbackNote } from '@/teach/Feedback';
import { Band, Masthead } from '@/site/page';
import { Lift, Reveal } from '@/site/motion';
import { useEditor } from '@/store/editor';
import { useSavedAnswer } from '@/teach/useSavedAnswer';
import { record } from '@/teach/progress';
import type { Automaton, Feedback, ProblemSpec } from '@/model/automaton';
import type { Engine } from '@/wasm/loader';
import type { Route } from '@/router';

export function Solve({
  engine,
  spec,
  problemKey,
  onNavigate,
  onEdit,
}: {
  engine: Engine | undefined;
  /** The problem, decoded from the fragment. `undefined` when the link was not readable. */
  spec: ProblemSpec | undefined;
  /**
   * Which problem of the set this is, when it is one.
   *
   * Absent for a lecturer's own link, and then nothing is recorded — there is no set entry for
   * a problem that is not in the set.
   */
  problemKey: string | undefined;
  onNavigate: (to: Route) => void;
  /** Open the answer in the editor to work on it. */
  onEdit: () => void;
}) {
  /*
    The answer is whatever is in the editor.

    Not a separate "assignment document" kept beside it. A student who draws a machine, opens
    the problem link, and finds an empty canvas has lost work in the way that feels most like
    the tool being broken — and keeping two documents would mean deciding which one Save
    saves. There is one document; this page is another view onto it.
  */
  // Without this the answer someone drew in the editor is invisible here — the store is
  // empty on load and only `App` restores it.
  useSavedAnswer();

  const document = useEditor((state) => state.history.present);
  const answer: Automaton | undefined = document.automaton;
  const layout = document.layout;
  /*
    Feedback, remembered together with the machine it was about.

    Derived rather than cleared from an effect. Feedback belongs to one machine: leaving
    "solved" on screen while someone edits their answer tells them a machine they have since
    changed is correct, and they will believe it. An effect watching `answer` would do that
    too, at the cost of a cascading render — and the store hands out a new document object on
    every edit, so identity is exactly the question being asked.
  */
  const [checked, setChecked] = useState<{ of: Automaton; feedback: Feedback } | undefined>(
    undefined,
  );
  const feedback = checked?.of === answer ? checked.feedback : undefined;

  const check = useCallback(() => {
    if (!engine || !spec || !answer) return;
    const result = engine.checkAnswer(JSON.stringify(spec), answer);
    setChecked({ of: answer, feedback: result });

    if (problemKey !== undefined) {
      record(problemKey, {
        solved: result.solved,
        // A budget met counts only when there was one to meet, so a problem without a budget
        // never reports a constraint it did not have.
        withinBudget: result.solved && spec.budget !== undefined && spec.budget !== null,
        states: result.states,
      });
    }
  }, [engine, spec, answer, problemKey]);

  if (!spec) {
    return (
      <main>
        <Masthead
          eyebrow="Problem"
          title="This link did not open."
          detail="A problem travels inside its own link, so a truncated one carries nothing to solve. Email clients and chat apps both do this. Ask whoever sent it for the link again."
        >
          <Lift>
            <button
              type="button"
              onClick={() => {
                onNavigate('editor');
              }}
              className="k-glow rounded-full bg-k-primary px-5 py-3 font-medium text-white"
            >
              Open the editor instead →
            </button>
          </Lift>
        </Masthead>
      </main>
    );
  }

  const states = answer?.states.length ?? 0;

  return (
    <main>
      <Masthead eyebrow="Problem" title={spec.prompt} detail="">
        <div className="flex flex-wrap items-center gap-3">
          <Lift>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-full border border-k-border-strong bg-k-surface-raised px-5 py-3 font-medium"
            >
              {states === 0 ? 'Draw an answer →' : 'Keep editing →'}
            </button>
          </Lift>
          <Lift>
            <button
              type="button"
              onClick={check}
              disabled={!engine || states === 0}
              className="k-glow rounded-full bg-k-primary px-5 py-3 font-medium text-white disabled:opacity-40"
            >
              Check
            </button>
          </Lift>
          {spec.budget !== undefined && spec.budget !== null && (
            /* B2. Shown always, not only on failure: a budget someone discovers by breaking it
               is a rule they were not told. */
            <span className="font-mono text-sm text-k-text-muted">
              {states} of {spec.budget} states
            </span>
          )}
        </div>
      </Masthead>

      <Band>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Reveal>
            <div className="overflow-hidden rounded-3xl border border-k-border bg-k-surface">
              <div className="h-80">
                {answer && states > 0 ? (
                  <AutomatonView
                    automaton={answer}
                    layout={layout ?? rowLayout(answer.states.map((state) => state.id))}
                    title="Your answer"
                    grid={false}
                    className="h-full w-full"
                  />
                ) : (
                  <div className="grid h-full place-items-center px-6 text-center">
                    <p className="max-w-sm text-sm text-k-text-muted">
                      Nothing drawn yet. Open the editor, build a machine for the language
                      above, and come back to check it.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Reveal>

          <div className="space-y-4">
            <FeedbackNote feedback={feedback} />

            <Reveal delay={0.05}>
              <div className="rounded-2xl border border-k-border p-4 text-xs leading-relaxed text-k-text-faint">
                <p className="font-medium text-k-text-muted">How this is checked</p>
                <p className="mt-2">
                  In this browser, by the same engine that draws the diagram — nothing is
                  uploaded. The problem travels inside the link, which means the target language
                  is in the link too and anyone can read it out.
                </p>
                <p className="mt-2">
                  That is worth knowing rather than discovering. If this is being marked, it
                  will be marked with <code className="font-mono">kleene grade</code>, where the
                  reference lives on the marker&rsquo;s machine and was never in your copy of
                  the link.
                </p>
              </div>
            </Reveal>

            <p className="text-xs text-k-text-faint">
              Unlimited attempts, and nothing is counted. This is practice.
            </p>
          </div>
        </div>
      </Band>
    </main>
  );
}
