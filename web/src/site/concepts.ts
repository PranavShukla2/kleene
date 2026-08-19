/**
 * The vocabulary of the subject, written for someone three weeks into a course.
 *
 * This is the one part of the site that is useful to a stranger who never opens the tool, and
 * it is deliberately not documentation. Documentation explains a product; this explains the
 * *subject*, and the product appears only where seeing something beats reading about it.
 *
 * Every entry carries a `mistake`, and that field is the reason the page exists. Definitions
 * are freely available and mostly identical; what a student cannot easily find is a list of
 * the specific wrong beliefs that make the definitions stop working — and those are extremely
 * consistent from year to year, which is what makes them worth writing down.
 */

/** Where an entry sends you when reading is not enough. */
export type Demo =
  /** Open `/convert` with this expression already compiling. */
  | { kind: 'convert'; expression: string; label: string }
  /** Open the editor with a built-in machine. */
  | { kind: 'example'; key: string; label: string }
  /** Somewhere on this site that says more. */
  | {
      kind: 'page';
      route: 'editor' | 'convert' | 'examples' | 'docs' | 'roadmap';
      label: string;
    };

export interface Concept {
  term: string;
  /** How it is written in a lecture, if it is written at all. */
  notation?: string;
  /** What it is, in one paragraph, assuming nothing. */
  detail: string;
  /** The wrong belief that specifically breaks this idea. */
  mistake: string;
  demo?: Demo;
}

export interface Chapter {
  /** Two digits, because the page is set in the engineering register the content uses. */
  number: string;
  title: string;
  blurb: string;
  concepts: readonly Concept[];
}

/**
 * The Greek letters this subject uses, spelled out.
 *
 * Stripping them instead is what broke this function the first time: `ε-NFA` and `NFA` both
 * became `nfa`, which is a colliding anchor *and* a duplicate React key — and the duplicate
 * key is the worse half, because it leaves rows from a previous query stranded in the DOM,
 * where they are visible and unreachable.
 */
const SPELLED: Record<string, string> = {
  ε: 'epsilon',
  Σ: 'sigma',
  δ: 'delta',
  λ: 'lambda',
  μ: 'mu',
  '∅': 'empty-set',
};

/**
 * A concept's anchor.
 *
 * Derived from the term rather than stored, because a hand-written id is a second name for
 * the same thing and the two drift the moment a term is reworded. `conceptIdsAreUnique` in the
 * tests is what keeps deriving them safe.
 */
export function conceptId(term: string): string {
  return [...term.toLowerCase()]
    .map((character) => SPELLED[character] ?? character)
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Every concept, flattened, with the chapter it belongs to. */
export function allConcepts(): { concept: Concept; chapter: Chapter }[] {
  return CHAPTERS.flatMap((chapter) =>
    chapter.concepts.map((concept) => ({ concept, chapter })),
  );
}

export const CHAPTERS: readonly Chapter[] = [
  {
    number: '01',
    title: 'The objects',
    blurb:
      'Four definitions, none of them difficult, all of them assumed by everything that follows.',
    concepts: [
      {
        term: 'Alphabet',
        notation: 'Σ',
        detail:
          'A finite set of symbols — usually something like {a, b} or {0, 1}. It is fixed before anything else is said, and every string and every machine in the discussion is over that same alphabet. It is not the English alphabet, and its symbols do not have to be single characters.',
        mistake:
          'Treating Σ as a suggestion. A machine over {a, b} has to say what it does on *every* symbol in Σ from *every* state, or it is not deterministic — and the missing cases are the ones that make a run get stuck rather than reject.',
      },
      {
        term: 'String',
        notation: 'w ∈ Σ*',
        detail:
          'A finite sequence of symbols from the alphabet. `abb` is a string over {a, b}; so is the empty string, written ε, which has length zero. Σ* means "all strings over Σ", including ε, and it is infinite for any non-empty alphabet.',
        mistake:
          'Confusing ε with ∅. ε is a string — the one with no symbols. ∅ is a set with nothing in it. {ε} is a language containing one string, and ∅ is a language containing none, and those two are not the same language.',
      },
      {
        term: 'Language',
        notation: 'L ⊆ Σ*',
        detail:
          'Any set of strings over the alphabet. That is the whole definition — a language does not have to be describable, useful, or finite. The interesting question is never what a language *is* but whether some finite machine can decide membership in it.',
        mistake:
          'Reading "language" as "grammar" or "syntax". It is a set. When a proof says two machines are equivalent, it means their *sets of accepted strings* are equal — not that they have the same shape.',
      },
      {
        term: 'Finite automaton',
        notation: 'M = (Q, Σ, δ, q₀, F)',
        detail:
          'Five things: a finite set of states Q, the alphabet Σ, a transition function δ saying where each symbol takes you, a start state q₀, and a set of accepting states F. A string is accepted if reading it from q₀ leaves you in F. Everything else in the subject is a variation on which of these five is allowed to be strange.',
        mistake:
          'Thinking the diagram *is* the machine. The diagram is a picture of δ. The same machine drawn twice with different layouts is the same machine, and two identical-looking pictures with different start states are not.',
        demo: { kind: 'example', key: 'ends_with_ab', label: 'Open a 5-tuple you can edit' },
      },
    ],
  },
  {
    number: '02',
    title: 'The machines',
    blurb:
      'Three kinds, in increasing order of how much freedom they have — and none of them can recognise more than the others.',
    concepts: [
      {
        term: 'DFA',
        notation: 'δ : Q × Σ → Q',
        detail:
          'Deterministic: exactly one transition from every state on every symbol. Reading a string traces exactly one path, so there is nothing to search and nothing to guess. This is what you want to *end up* with, because running a DFA is trivial.',
        mistake:
          'Calling a machine a DFA when δ is partial. If some state has no move on some symbol, a run can get stuck — which is not the same as rejecting, and it is why the interface says "δ is partial" rather than silently adding a trap state.',
        demo: {
          kind: 'example',
          key: 'even_number_of_as',
          label: 'The smallest DFA with a real invariant',
        },
      },
      {
        term: 'NFA',
        notation: 'δ : Q × Σ → 𝒫(Q)',
        detail:
          'Nondeterministic: a symbol can lead to several states, or none. A string is accepted if *some* path accepts it. Nothing is actually guessing — the honest reading is that the machine is in a *set* of states at once, and acceptance means that set eventually contains an accepting state.',
        mistake:
          'Believing an NFA is more powerful than a DFA. It is not. Subset construction turns any NFA into a DFA accepting exactly the same language. What an NFA buys is a smaller, more readable machine — sometimes exponentially smaller — never a larger class of languages.',
        demo: { kind: 'convert', expression: '(a|b)*abb', label: 'Watch an NFA become a DFA' },
      },
      {
        term: 'ε-NFA',
        notation: 'δ : Q × (Σ ∪ {ε}) → 𝒫(Q)',
        detail:
          'An NFA that may also move without reading anything. That sounds like a technicality and is the reason Thompson’s construction is as clean as it is: every regular-expression operator becomes a small fragment glued to the next with ε-transitions, so there is never a case analysis about how to join two pieces.',
        mistake:
          'Forgetting to close over ε *after* consuming a symbol. Move first, then take the ε-closure. Doing it the other way misses every state reachable only by an ε-edge after the symbol was read, and produces a DFA that is wrong on exactly the strings that matter.',
        demo: {
          kind: 'convert',
          expression: 'a(b|c)*',
          label: 'See ε-transitions, and where they go',
        },
      },
    ],
  },
  {
    number: '03',
    title: 'The conversions',
    blurb:
      'The algorithms courses examine by hand, which is why watching one run is worth more than reading its pseudocode.',
    concepts: [
      {
        term: 'ε-closure',
        notation: 'E(S)',
        detail:
          'Every state reachable from a set S without reading input, including the states of S themselves. It is a fixed point: keep following ε-edges until nothing new appears. Almost every step of subset construction begins or ends with one.',
        mistake:
          'Leaving a state out of its own closure. E({q}) always contains q, because reading nothing leaves you where you are — and a closure that omits it will quietly lose acceptance.',
        demo: {
          kind: 'convert',
          expression: '(a|b)*abb',
          label: 'Unfold a closure, one state at a time',
        },
      },
      {
        term: 'Subset construction',
        detail:
          'Turns an NFA into a DFA. A state of the DFA *is* a set of NFA states — the set you could be in. Start from the ε-closure of the NFA’s start state, and for each set and each symbol work out where you land; if that set is new, it becomes a new DFA state and joins a worklist. Stop when the worklist empties.',
        mistake:
          'Creating a new state for a subset that has already appeared. The construction terminates *because* repeats are recognised, and a run that duplicates them never finishes. It is also why the interface says "already seen as B" rather than only drawing the arrow.',
        demo: {
          kind: 'convert',
          expression: '(a|b)*abb',
          label: 'Watch the worklist drain',
        },
      },
      {
        term: 'Minimization',
        detail:
          'Finds the unique smallest DFA accepting the same language, by merging states nothing can tell apart. Two states are distinguishable if some string leads one to acceptance and the other not; partition refinement starts by separating accepting from non-accepting and repeatedly splits blocks that disagree.',
        mistake:
          'Merging states that look symmetric. Sameness is behavioural, not visual: two states merge only if *no* string distinguishes them, and the string that separates them is usually short and easy to miss by eye.',
        demo: {
          kind: 'convert',
          expression: 'a*b*',
          label: 'Compare a DFA with its minimal form',
        },
      },
      {
        term: 'Thompson’s construction',
        detail:
          'Turns a regular expression into an ε-NFA, one operator at a time. Each operator has a fixed fragment with a single entry and a single exit, and composing them is only ever a matter of adding ε-edges. The result is larger than necessary and completely mechanical — which is the trade it is making.',
        mistake:
          'Expecting the output to be small or pretty. Thompson’s gives you fourteen states for `(a|b)*abb`. That is not a mistake in your working; the construction is optimised for being obviously correct, and subset construction plus minimization cleans up afterwards.',
        demo: { kind: 'convert', expression: '(ab)*+b', label: 'Build one from an expression' },
      },
    ],
  },
  {
    number: '04',
    title: 'Regular expressions',
    blurb:
      'The other way of writing a regular language — and the reason "regular" is the word in both names.',
    concepts: [
      {
        term: 'The operators',
        notation: '| · *',
        detail:
          'Union (`a|b`, sometimes written `a+b`), concatenation (`ab`, usually with no symbol at all), and Kleene star (`a*`, meaning zero or more). Plus the two constants: ε for the empty string and ∅ for the empty language. That is the entire syntax — everything else you have seen in a text editor is convenience built on top.',
        mistake:
          'Reading `a*` as "one or more". It is *zero* or more, so `a*` matches the empty string, and `a*b*` matches strings with no a’s and no b’s at all. Half of all wrong answers about star come from this one.',
        demo: { kind: 'convert', expression: 'a*b*', label: 'See what a* actually accepts' },
      },
      {
        term: 'Kleene’s theorem',
        detail:
          'A language is describable by a regular expression if and only if some finite automaton accepts it. The two notations have exactly the same power, and both directions are constructive: Thompson’s builds a machine from an expression, and state elimination builds an expression from a machine.',
        mistake:
          'Assuming "regular expression" means what a programming language calls one. Backreferences and lookahead are not regular, and a `regex` library that supports them is recognising languages no finite automaton can.',
      },
      {
        term: 'State elimination',
        detail:
          'The other direction: rip states out of a DFA one at a time, relabelling the edges around each with a regular expression that accounts for the paths through it, until only a start and an accept state remain. The label left on the edge between them is the answer.',
        mistake:
          'Expecting one right answer. The expression you get depends on the order you eliminate in, and two students with different orders can both be correct. Equivalence has to be checked by machine, not by comparing strings.',
        demo: { kind: 'page', route: 'roadmap', label: 'Planned — see the roadmap' },
      },
    ],
  },
];
