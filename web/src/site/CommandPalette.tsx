/**
 * ⌘K — everything the site can do, from the keyboard.
 *
 * Not a search box bolted onto a nav bar. The point is that the whole product is reachable
 * without a pointer: every route, every example, every conversion preset and the theme, in one
 * list that opens over whatever you were looking at and closes without changing it.
 *
 * It also does something a nav bar structurally cannot — surface the things that are *not*
 * navigation. "Convert `(a|b)*abb`" is not a page, and putting it in the header would mean
 * either a header full of verbs or a feature nobody finds.
 *
 * The ranking lives in `palette.ts` and is tested there. This file is the shell: a dialog, a
 * listbox, and the keyboard contract people already expect from one.
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Pill } from '@/site/Badge';
import { siteActions } from '@/site/actions';
import { grouped, moveBy, search, type Action } from '@/site/palette';
import { SPRING } from '@/site/spring';
import type { Route } from '@/router';

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onOpenExample,
  onConvert,
  onOpenTool,
  onOpenConcept,
  onCycleTheme,
  themeLabel,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (to: Route) => void;
  onOpenExample: (key: string) => void;
  /** Go to the converter with an expression already in the bar. */
  onConvert: (source: string) => void;
  /** Go to a `/tools/*` page. Parameterised routes cannot go through `onNavigate`. */
  onOpenTool: (path: string) => void;
  /** Go to `/learn` and scroll to a concept. */
  onOpenConcept: (id: string) => void;
  onCycleTheme: () => void;
  themeLabel: string;
}) {
  const [query, setQuery] = useState('');
  const [at, setAt] = useState(0);
  const still = useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);

  const actions = useMemo(() => siteActions(themeLabel), [themeLabel]);

  /**
   * The results, grouped once.
   *
   * `grouped` used to be called twice — once to build the flat list the keyboard walks, once
   * in the render to draw the sections — and the two disagreed: the footer reported two
   * results while three rows were on screen, and the third row could not be highlighted
   * because it was not in the list the arrow keys knew about.
   *
   * One memo, two derivations from it. A value computed twice is a value that can differ.
   */
  const sections = useMemo(() => grouped(search(actions, query)), [actions, query]);
  const flat = useMemo(() => sections.flatMap((section) => section.matches), [sections]);

  // Clamped rather than reset by an effect: the query changes on every keystroke, and zeroing
  // a highlight from an effect is a cascading render for something already known from the
  // input. Typing narrows the list under the cursor, and landing on the first row is right.
  const highlighted = Math.min(at, Math.max(flat.length - 1, 0));

  useEffect(() => {
    if (!open) return;

    // The list scrolls; the highlight must stay in it. Keyboard-driven selection that moves
    // out of view is the single most common way a palette stops being usable without a mouse.
    listRef.current
      ?.querySelector('[data-highlighted="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  const run = (action: Action | undefined) => {
    if (!action) return;
    onClose();
    setQuery('');
    setAt(0);

    if (action.id.startsWith('go:')) {
      onNavigate(action.id.slice(3) as Route);
    } else if (action.id.startsWith('example:')) {
      onOpenExample(action.id.slice('example:'.length));
    } else if (action.id.startsWith('concept:')) {
      onOpenConcept(action.id.slice('concept:'.length));
    } else if (action.id.startsWith('doc:')) {
      const route = action.id.split(':').at(-1) ?? 'unwritten';
      // An article with no route of its own is not written yet; the map on `/docs` is where it
      // says so, and sending someone there beats a dead entry that does nothing when pressed.
      onNavigate(route === 'unwritten' ? 'docs' : (route as Route));
    } else if (action.id.startsWith('tool:')) {
      onOpenTool(`/tools/${action.id.slice('tool:'.length)}`);
    } else if (action.id.startsWith('regex:')) {
      onConvert(action.id.slice('regex:'.length));
    } else if (action.id === 'theme') {
      onCycleTheme();
    } else if (action.id === 'source') {
      window.open('https://github.com/PranavShukla2/kleene', '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
          initial={still ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={still ? undefined : { opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          {/* The scrim. Clicking it closes, which is the gesture everyone tries first. */}
          <button
            type="button"
            aria-label="Close the command palette"
            onClick={onClose}
            className="absolute inset-0 bg-k-bg/75 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={still ? false : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={still ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
            transition={SPRING}
            /*
              A near-solid surface, not the marketing glass. `k-glass` sits at 66% over a
              blurred scrim, and stacking the two left the list barely legible — a decorative
              panel can afford to be see-through, and a dialog someone is *reading* cannot.
              The blur stays, because the depth is worth keeping; only the opacity changes.
            */
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-k-border-strong bg-k-surface-raised/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 border-b border-k-border/60 px-4 py-3">
              <span aria-hidden className="font-mono text-sm text-k-text-faint">
                ⌘
              </span>
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setAt(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setAt(moveBy(highlighted, 1, flat.length));
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setAt(moveBy(highlighted, -1, flat.length));
                  } else if (event.key === 'Enter') {
                    event.preventDefault();
                    run(flat[highlighted]?.action);
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    onClose();
                  }
                }}
                placeholder="Search pages, examples, expressions…"
                aria-label="Search pages, examples and expressions"
                role="combobox"
                aria-expanded
                aria-controls="palette-list"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-k-text outline-none placeholder:text-k-text-faint"
              />
              <kbd className="rounded border border-k-border px-1.5 py-0.5 font-mono text-[10px] text-k-text-faint">
                esc
              </kbd>
            </div>

            <div
              id="palette-list"
              ref={listRef}
              role="listbox"
              aria-label="Results"
              className="max-h-[52vh] overflow-y-auto p-2"
            >
              {flat.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-k-text-faint">
                  Nothing matches <span className="font-mono text-k-text-muted">{query}</span>.
                  Try a page name, an example, or a regular expression.
                </p>
              )}

              {sections.map((section) => (
                <div key={section.group} className="mb-1">
                  <p className="px-3 py-1.5 font-mono text-[10px] tracking-wider text-k-text-faint uppercase">
                    {section.group}
                  </p>
                  {section.matches.map((match) => {
                    const index = flat.indexOf(match);
                    const on = index === highlighted;
                    return (
                      <button
                        key={match.action.id}
                        type="button"
                        role="option"
                        aria-selected={on}
                        data-highlighted={on}
                        // Pointer and keyboard drive one highlight, so moving the mouse does
                        // not leave two rows looking selected at once.
                        onPointerMove={() => {
                          setAt(index);
                        }}
                        onClick={() => {
                          run(match.action);
                        }}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-(--duration-k-hover) ${
                          on ? 'bg-k-primary/12 text-k-text' : 'text-k-text-muted'
                        }`}
                      >
                        <span className="truncate">{match.action.label}</span>
                        {match.action.soon && <Pill tone="soon">{match.action.soon}</Pill>}
                        {match.action.hint && (
                          <span className="ml-auto shrink-0 font-mono text-[10px] text-k-text-faint">
                            {match.action.hint}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 border-t border-k-border/60 px-4 py-2 font-mono text-[10px] text-k-text-faint">
              <span>↑↓ move</span>
              <span>↵ open</span>
              <span className="ml-auto">{flat.length} results</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
