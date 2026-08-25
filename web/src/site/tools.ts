/**
 * One page per task (roadmap §6.1).
 *
 * Someone with a conversion to do does not search for an automata workbench. They search for
 * "nfa to dfa converter", and they arrive wanting that one thing done — not a product tour.
 * These pages exist to be the end of that search: name the task, do it immediately, and put
 * everything else below the fold.
 *
 * ## Why they are data rather than four hand-written pages
 *
 * Because they are the same page four times, and four copies would drift. The differences are
 * a title, a worked example and a short explanation — and keeping them in a table means the
 * shared parts cannot slowly stop being shared.
 *
 * Each tool declares which stage of the pipeline it *is*, so the page can open the converter
 * with the right pane showing rather than making the visitor find it.
 */

import type { PaneId } from '@/convert/panes';

export interface Tool {
  /** The URL segment: `/tools/<slug>`. */
  slug: string;
  /** What someone typed into a search box. */
  title: string;
  /** The sentence under it. One line, no product name. */
  tagline: string;
  /** The expression the page opens with, already converting. */
  example: string;
  /** Which panes to show — the answer this page is about, plus what it came from. */
  panes: readonly PaneId[];
  /** Why the answer looks the way it does. Two paragraphs at most. */
  detail: readonly string[];
  /** The question people ask on the page for this task specifically. */
  faq: readonly { question: string; answer: string }[];
  /**
   * Open the state-elimination section on arrival.
   *
   * For the one tool that *is* that section. Everywhere else it stays collapsed, because it
   * costs a conversion run and is not what the visitor came for.
   */
  elimination?: boolean;
}

export const TOOLS: readonly Tool[] = [
  {
    slug: 'regex-to-dfa',
    title: 'Regular expression to DFA',
    tagline: 'Type an expression, get a deterministic machine — and every step in between.',
    example: '(a|b)*abb',
    panes: ['nfa', 'dfa'],
    detail: [
      'It is two conversions, not one. Thompson’s construction turns the expression into an ε-NFA — mechanically, one operator at a time — and subset construction turns that into a DFA. Doing them in one leap is possible and is not how the result is derived, which is why both stages are on screen.',
      'The ε-NFA will look larger than you expect. Thompson’s optimises for being obviously correct rather than for being small, and the tidying up is what subset construction and minimization are for.',
    ],
    faq: [
      {
        question: 'Why does the ε-NFA have so many states?',
        answer:
          'Thompson’s construction gives every operator its own fragment with one entry and one exit, glued with ε-transitions. That regularity is what makes it obviously correct and what makes it wasteful — `(a|b)*abb` becomes fourteen states, and the DFA that follows has five.',
      },
      {
        question: 'Is the DFA I get the smallest one?',
        answer:
          'Not necessarily. Subset construction gives *a* DFA; minimization gives the unique smallest one accepting the same language. Turn on the minimal pane to see whether yours could be smaller.',
      },
    ],
  },
  {
    slug: 'nfa-to-dfa',
    title: 'NFA to DFA converter',
    tagline: 'Subset construction, one round at a time, with the worklist and the reasoning.',
    example: '(a|b)*abb',
    panes: ['nfa', 'dfa'],
    detail: [
      'A state of the DFA *is* a set of NFA states — the set you could be in. Start from the ε-closure of the NFA’s start state; for each set and each symbol, work out where you land; if that set is new it becomes a DFA state and joins a worklist. Stop when the worklist empties.',
      'Every round below says which subset it is expanding, what it reached, and — the part most often got wrong — whether that subset was new or had already been seen. Hover any DFA state to light up the NFA states it stands for.',
    ],
    faq: [
      {
        question: 'Can an NFA accept a language a DFA cannot?',
        answer:
          'No. Subset construction turns any NFA into a DFA accepting exactly the same language, so the two have identical power. What an NFA buys is a smaller and more readable machine — sometimes exponentially smaller — never a larger class of languages.',
      },
      {
        question: 'Why did my DFA end up with fewer states than 2ⁿ?',
        answer:
          'Because most subsets are never reached. The construction only creates a state for a subset it actually arrives at, and the 2ⁿ bound is the worst case rather than the usual one.',
      },
    ],
  },
  {
    slug: 'minimize-dfa',
    title: 'DFA minimizer',
    tagline: 'The smallest machine accepting the same language, and why each merge is allowed.',
    example: 'a*b*',
    panes: ['dfa', 'minimal'],
    detail: [
      'Two states can be merged when no string tells them apart — when, from either one, exactly the same strings lead to acceptance. Partition refinement starts by separating accepting states from the rest and repeatedly splits any block whose members disagree on some symbol.',
      'The result is unique. Two correct minimizations of the same DFA give the same machine up to renaming, which is what makes minimization a reasonable way to test whether two machines are equivalent.',
    ],
    faq: [
      {
        question: 'My two states look identical. Why were they not merged?',
        answer:
          'Sameness is behavioural, not visual. Two states merge only if *no* string distinguishes them, and the string that separates them is usually short and easy to miss by eye — following each state on the same symbol is the quickest way to find it.',
      },
      {
        question: 'Does minimizing change the language?',
        answer:
          'No, and that is the whole point. The minimal DFA accepts exactly the strings the original did; it just has no state that could be merged with another.',
      },
    ],
  },
  {
    slug: 'regex-to-nfa',
    title: 'Regular expression to NFA',
    tagline: 'Thompson’s construction, operator by operator, with the ε-transitions shown.',
    example: 'a(b|c)*',
    panes: ['nfa'],
    detail: [
      'Each operator becomes a small fragment with exactly one entry and one exit, and composing them is only ever a matter of adding ε-transitions. That uniformity is why there is never a case analysis about how two pieces join — and why the output is bigger than one you would draw by hand.',
      'The ε-transitions are not clutter. They are what let the construction stay mechanical, and they disappear the moment you determinize.',
    ],
    faq: [
      {
        question: 'What is an ε-transition?',
        answer:
          'A move the machine may make without reading any input. It is what makes an NFA an ε-NFA, and it is how Thompson’s construction glues two fragments together without needing to know anything about either.',
      },
      {
        question: 'Can I get rid of the ε-transitions?',
        answer:
          'Yes — that is what subset construction does. Turn on the DFA pane and the ε-transitions are gone, replaced by states that stand for sets of the ones you can see here.',
      },
    ],
  },
  {
    slug: 'dfa-to-regex',
    title: 'DFA to regular expression',
    tagline: 'State elimination, one state at a time, with what is left on the edges.',
    // Small on purpose. State elimination is worst-case exponential and this page runs it on
    // arrival, so the worked example has to be one whose answer stays readable.
    example: '(a|b)*abb',
    panes: ['dfa'],
    elimination: true,
    detail: [
      'The other direction, and the one most courses spend least time on. Add a new start and accept state, then remove the original states one by one — each time a state goes, every path *through* it is rewritten as a single edge whose label is the expression describing those paths. When only the two added states are left, the expression on the edge between them is the answer.',
      'The order you remove states in changes the expression but not the language. There is no known way to pick the order that gives the shortest result, which is why two correct answers to the same exercise can look nothing like each other — and why the order is a control on this page rather than a decision made for you.',
    ],
    faq: [
      {
        question: 'My answer looks completely different from this one. Is it wrong?',
        answer:
          'Probably not. Eliminating states in a different order gives a different expression for the same language, and both are correct. The way to check is to convert both back to DFAs and compare — or run the two through `kleene equiv`, which reports the shortest string they disagree on if they do.',
      },
      {
        question: 'Why does the expression get so long?',
        answer:
          'Because each elimination can multiply the number of paths that have to be described. It is exponential in the worst case: a 33-state machine produces an expression of about 177,000 characters. Kleene refuses above 25 states and says so rather than freezing, which is a measured limit and not a bug.',
      },
    ],
  },
];

/** The tool at a slug, if there is one. */
export function toolAt(slug: string | undefined): Tool | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}
