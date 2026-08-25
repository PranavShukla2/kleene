/**
 * A failure, as one sentence of plain text.
 *
 * Split out of the component so the *wording* can be tested without rendering anything, and
 * so the same words can be reused where JSX cannot go — a title attribute, an aria-label, a
 * future CLI. The component adds emphasis and layout; this decides what is said.
 *
 * B3's requirement lives here: never a bare "incorrect". Every branch names something the
 * student can act on — a string to trace, a pair of states to look at, or the fact that the
 * problem itself is broken and it is not their mistake.
 */

import type { Failure } from '@/model/automaton';

/** The empty string, shown rather than left as a gap. */
export const witness = (input: string) => (input === '' ? 'ε' : input);

export function explain(failure: Failure): string {
  switch (failure.kind) {
    case 'wrong-language':
      return failure.accepted_by_answer
        ? `Your machine accepts ${witness(failure.input)} and it should not. Trace that string through your machine and find where it reaches an accepting state.`
        : `Your machine rejects ${witness(failure.input)} and it should not. Trace that string through your machine and find where it stops short.`;

    case 'over-budget':
      return `The language is right — this machine accepts exactly what it should. It uses ${String(failure.used)} states and the limit is ${String(failure.limit)}. Two states can be merged when no string tells them apart.`;

    case 'wrong-alphabet':
      return `The language is right, but this problem is over {${failure.expected.join(', ')}} and your machine is over {${failure.found.join(', ')}}.`;

    case 'bad-problem':
      return `This problem link is broken — ${failure.detail}. That is not something you did: a link can be truncated by an email client or a chat app, so ask for it again.`;
  }
}
