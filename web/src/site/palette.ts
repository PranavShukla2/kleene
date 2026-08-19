/**
 * What the command palette can do, and how a query finds it.
 *
 * Pure and separate from the component, because the ranking is the part that is easy to get
 * subtly wrong and impossible to notice: a palette that finds the right thing *second* feels
 * broken in a way nobody can articulate, and no amount of looking at the UI reveals it.
 *
 * ## Subsequence matching, not substring
 *
 * `cnv` finds "Convert" and `mndfa` finds "Minimal DFA". This is what people actually type
 * into a palette — the first letters of the words they mean — and a substring search rejects
 * every one of those. The cost is that a subsequence match is easy to satisfy by accident, so
 * the *ranking* has to do the work the filter is not doing.
 */

/** What a match is worth. Ordered by how strongly each signal predicts the intended item. */
const SCORE = {
  /** The query is the whole label. Nothing beats this. */
  exact: 1000,
  /** The label starts with the query — `con` for "Convert". */
  prefix: 500,
  /** The query matches the first letters of the words — `mdfa` for "Minimal DFA". */
  initials: 400,
  /** A run of adjacent characters, per character beyond the first. */
  adjacent: 12,
  /** Any matched character, wherever it landed. */
  character: 4,
  /** The match began at a word boundary. */
  boundary: 20,
} as const;

/** How much a group is worth before any query is typed, so an empty palette is still ordered. */
export type Group = 'Go to' | 'Convert' | 'Concepts' | 'Docs' | 'Open an example' | 'Actions';

const GROUP_ORDER: readonly Group[] = [
  'Go to',
  'Convert',
  'Concepts',
  'Docs',
  'Open an example',
  'Actions',
];

export interface Action {
  /** Stable identity, for React keys and for tests that should not depend on wording. */
  id: string;
  label: string;
  group: Group;
  /** Extra words that should find this item but are not worth showing. */
  keywords?: readonly string[];
  /** Shown on the right — a shortcut, or where it goes. */
  hint?: string;
  /** Marked as not built yet, and not selectable. */
  soon?: string;
}

export interface Match {
  action: Action;
  score: number;
}

/**
 * Rank `actions` against `query`.
 *
 * An empty query returns everything in group order, which is what makes the palette a menu
 * before it is a search box — the first thing someone sees on pressing ⌘K should be a list of
 * what is possible, not an empty box demanding they already know.
 */
export function search(actions: readonly Action[], query: string): Match[] {
  const trimmed = query.trim();

  if (trimmed === '') {
    return actions
      .map((action) => ({ action, score: 0 }))
      .sort((a, b) => groupRank(a.action.group) - groupRank(b.action.group));
  }

  const matches: Match[] = [];
  for (const action of actions) {
    const score = scoreOf(action, trimmed);
    if (score > 0) matches.push({ action, score });
  }

  // Score first, then group, then label — so ties resolve to something stable rather than to
  // whatever order the source array happened to be in.
  return matches.sort(
    (a, b) =>
      b.score - a.score ||
      groupRank(a.action.group) - groupRank(b.action.group) ||
      a.action.label.localeCompare(b.action.label),
  );
}

function groupRank(group: Group): number {
  const at = GROUP_ORDER.indexOf(group);
  return at === -1 ? GROUP_ORDER.length : at;
}

/** The best score this action can manage against the query, over its label and its keywords. */
function scoreOf(action: Action, query: string): number {
  const haystacks = [action.label, ...(action.keywords ?? [])];
  return Math.max(...haystacks.map((text) => scoreAgainst(text, query)));
}

function scoreAgainst(text: string, query: string): number {
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();

  if (lower === needle) return SCORE.exact;
  if (lower.startsWith(needle)) return SCORE.prefix + needle.length;
  if (initialsOf(lower).startsWith(needle)) return SCORE.initials + needle.length;

  return subsequence(lower, needle);
}

/** The first letter of each word: "Minimal DFA" → "md". */
function initialsOf(lower: string): string {
  return lower
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0)
    .map((word) => word[0] ?? '')
    .join('');
}

/**
 * Score a subsequence match, or 0 if the query is not one.
 *
 * Adjacency and word boundaries are what separate a real match from an accidental one:
 * `dfa` genuinely matches "**D**raw automata **f**rom **a**..." as a subsequence, and should
 * lose badly to "DFA", which matches it as a run.
 */
function subsequence(lower: string, needle: string): number {
  let score = 0;
  let at = 0;
  let previous = -2;

  for (const character of needle) {
    const found = lower.indexOf(character, at);
    if (found === -1) return 0;

    score += SCORE.character;
    if (found === previous + 1) score += SCORE.adjacent;
    if (found === 0 || /[^a-z0-9]/.test(lower[found - 1] ?? '')) score += SCORE.boundary;

    previous = found;
    at = found + 1;
  }

  // Shorter haystacks win on equal evidence: "DFA" should beat "Convert a DFA to a regular
  // expression" when the query is `dfa`, and both match identically well up to this point.
  return score + Math.max(0, 40 - lower.length);
}

/** The matches, grouped in display order, with empty groups dropped. */
export function grouped(matches: readonly Match[]): { group: Group; matches: Match[] }[] {
  return GROUP_ORDER.map((group) => ({
    group,
    matches: matches.filter((match) => match.action.group === group),
  })).filter((section) => section.matches.length > 0);
}

/** Move a highlighted index by `delta`, wrapping at both ends. */
export function moveBy(index: number, delta: number, count: number): number {
  if (count === 0) return 0;
  return (index + delta + count) % count;
}
