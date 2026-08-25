/**
 * What a student is told when they press Check.
 *
 * Teaching layer B3, and the sentence the plan uses for it is worth keeping in front of
 * whoever edits this file: *"never a bare 'incorrect'. This is the entire pedagogical thesis
 * of the project applied to one button."*
 *
 * Everything Kleene does is built on the idea that a result without its reasoning teaches
 * nothing. A checker that says "wrong" is that failure in its purest form — it tells a student
 * they must start again, without telling them where to look. A checker that says *"your machine
 * accepts `aba` and it should not"* hands them a specific thing to trace through, which is the
 * work that actually produces understanding.
 *
 * ## Why there is no score, and no attempt counter
 *
 * Task B4. This is practice, and framing practice as assessment is both dishonest about what a
 * client-side check can promise and worse for learning: a student counting attempts optimises
 * for looking correct rather than for being correct. There is nothing here to game.
 */

import { motion, useReducedMotion } from 'motion/react';

import type { Failure, Feedback } from '@/model/automaton';
import { explain, witness } from '@/teach/explain';

/** The string a failure is about, rendered so the empty one is still visible. */
function Witness({ input }: { input: string }) {
  // ε rather than an empty span. The empty string is a perfectly good counterexample — it is
  // the witness whenever one machine accepts it and the other does not — and showing nothing
  // makes a precise answer look like a missing one.
  return (
    <code className="rounded bg-k-primary/10 px-1.5 py-0.5 font-mono text-k-text">
      {input === '' ? 'ε' : input}
    </code>
  );
}

function Explanation({ failure }: { failure: Failure }) {
  /*
    The words come from `explain`, not from a second copy of them here.

    An earlier draft of this file wrote the sentences inline as JSX so it could emphasise the
    witness string. That is two places saying the same thing, and the tested one would have
    been the one nobody read. Emphasis is worth less than the guarantee that the sentence a
    student sees is the sentence under test.
  */
  const said = explain(failure);

  if (failure.kind === 'wrong-language') {
    // The one case worth splitting, because the witness is the thing to look at and running
    // it into the sentence buries it.
    const [first, ...rest] = said.split('. ');
    return (
      <p className="leading-relaxed">
        {first?.replace(witness(failure.input), '')}
        <Witness input={failure.input} />
        {'. '}
        <span className="text-k-text-muted">{rest.join('. ')}</span>
      </p>
    );
  }

  return <p className="leading-relaxed">{said}</p>;
}

export function FeedbackNote({ feedback }: { feedback: Feedback | undefined }) {
  const still = useReducedMotion();
  if (!feedback) return null;

  const solved = feedback.solved;

  return (
    <motion.div
      // Keyed so a second wrong answer re-animates. Without it, pressing Check twice on two
      // different mistakes looks like nothing happened.
      key={JSON.stringify(feedback)}
      role="status"
      initial={still ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      className={`rounded-2xl border p-4 text-sm ${
        solved
          ? 'border-k-accepting/40 bg-k-accepting/10'
          : 'border-k-border-strong bg-k-surface-raised'
      }`}
    >
      {solved ? (
        <div className="space-y-1">
          <p className="font-medium">Solved.</p>
          <p className="text-k-text-muted">
            {feedback.minimum !== undefined &&
            feedback.minimum !== null &&
            feedback.states > feedback.minimum ? (
              <>
                {feedback.states} states — the smallest machine for this language has{' '}
                {feedback.minimum}. Worth trying, though nothing here is scored.
              </>
            ) : (
              <>{feedback.states} states, which is as small as this language gets.</>
            )}
          </p>
        </div>
      ) : (
        feedback.failure && <Explanation failure={feedback.failure} />
      )}
    </motion.div>
  );
}
