/**
 * Everything the command palette can do.
 *
 * A module rather than a `useMemo` inside the component, so the one property this list must
 * have can be tested: **every id is unique**. It was not. Every unwritten docs article got the
 * id `doc:`, and `ε-NFA` and `NFA` both slugged to `concept:nfa` — and duplicate ids become
 * duplicate React keys, which let a row from a previous query survive into the next one. The
 * palette showed three rows, reported two results, and could not highlight the third, because
 * it was in the DOM and not in the list.
 *
 * The id is also the dispatch: the prefix before the first colon says what the row does.
 */

import { EXAMPLES } from '@/overview/examples';
import { SECTIONS } from '@/site/articles';
import { allConcepts, conceptId } from '@/site/concepts';
import type { Action } from '@/site/palette';
import { TOOLS } from '@/site/tools';

/** A fragment safe to put in an id, from arbitrary prose. */
function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Conversions worth one keystroke. The same expressions the hero offers. */
export const PRESETS = ['(a|b)*abb', 'a*b*', '(ab)*+b', 'a(b|c)*'] as const;

/** Everything the palette can do, given what the theme button currently says. */
export function siteActions(themeLabel: string): Action[] {
  return [
    { id: 'go:overview', label: 'Home', group: 'Go to', keywords: ['overview', 'landing'] },
    { id: 'go:editor', label: 'The editor', group: 'Go to', keywords: ['draw', 'canvas'] },
    { id: 'go:convert', label: 'Convert', group: 'Go to', keywords: ['regex', 'dfa', 'nfa'] },
    { id: 'go:examples', label: 'Examples', group: 'Go to', keywords: ['gallery'] },
    {
      id: 'go:learn',
      label: 'Learn the concepts',
      group: 'Go to',
      keywords: ['theory', 'glossary', 'definitions', 'dfa', 'nfa', 'closure'],
    },
    { id: 'go:docs', label: 'Docs', group: 'Go to', keywords: ['documentation', 'help'] },
    {
      id: 'go:start',
      label: 'Getting started',
      group: 'Go to',
      keywords: ['start', 'begin', 'new', 'tutorial', 'how'],
    },
    {
      id: 'go:practice',
      label: 'Practice problems',
      group: 'Go to',
      keywords: ['exercise', 'problems', 'homework', 'solve', 'set'],
    },
    {
      id: 'go:pumping',
      label: 'Pumping lemma game',
      group: 'Go to',
      keywords: ['pumping', 'lemma', 'non-regular', 'proof', 'game'],
    },
    {
      id: 'go:download',
      label: 'Download',
      group: 'Go to',
      keywords: ['install', 'desktop', 'app', 'offline', 'native'],
    },
    { id: 'go:pricing', label: 'Pricing', group: 'Go to', keywords: ['free', 'cost'] },
    { id: 'go:roadmap', label: 'Roadmap', group: 'Go to', keywords: ['plan', 'phases'] },
    { id: 'go:changelog', label: 'Changelog', group: 'Go to', keywords: ['releases', 'new'] },
    { id: 'go:about', label: 'About', group: 'Go to', keywords: ['who', 'why', 'author'] },
    {
      id: 'go:jflap',
      label: 'Compared to JFLAP',
      group: 'Go to',
      // "jflap" is the search that brings people here in the first place, and `.jff` is what
      // they have in a folder. Both have to reach this row.
      keywords: ['jflap', 'jff', 'alternative', 'comparison', 'import'],
    },

    ...TOOLS.map((tool): Action => ({
      id: `tool:${tool.slug}`,
      label: tool.title,
      group: 'Convert',
      keywords: [tool.slug.replace(/-/g, ' '), tool.example],
      hint: 'tool page',
    })),

    ...PRESETS.map((preset): Action => ({
      id: `regex:${preset}`,
      label: `Convert ${preset}`,
      group: 'Convert',
      keywords: [preset],
      hint: 'regex → DFA',
    })),

    // The whole of `/learn`, searchable by term. This is what turns the palette from a
    // navigator into something you can ask a question of: "what is an ε-closure" is a query
    // people have, and the nav bar's answer to it is "Learn", which is not one.
    ...allConcepts().map(({ concept, chapter }): Action => ({
      id: `concept:${conceptId(concept.term)}`,
      label: concept.term,
      group: 'Concepts',
      keywords: [concept.notation ?? '', chapter.title].filter((word) => word !== ''),
      hint: chapter.title.toLowerCase(),
    })),

    ...SECTIONS.flatMap((section) =>
      section.articles.map((article): Action => ({
        // Keyed by section and title, not by route. Several articles share a route and every
        // unwritten one has none, so `doc:${route}` collided both ways. `slug` keeps the id
        // readable, and the trailing route is what the handler dispatches on.
        id: `doc:${slug(section.heading)}:${slug(article.title)}:${article.route ?? 'unwritten'}`,
        label: article.title,
        group: 'Docs',
        keywords: [section.heading],
        hint: article.status.kind === 'ready' ? undefined : 'coming soon',
      })),
    ),

    ...EXAMPLES.map((example): Action => ({
      id: `example:${example.key}`,
      label: example.title,
      group: 'Open an example',
      keywords: [...example.topics, example.tier],
      hint: 'in the editor',
    })),

    { id: 'theme', label: 'Toggle theme', group: 'Actions', hint: themeLabel },
    {
      id: 'source',
      label: 'View the source on GitHub',
      group: 'Actions',
      keywords: ['repository', 'code'],
    },
  ];
}
