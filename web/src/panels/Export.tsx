/**
 * The export panel (Phase 4 Track B).
 *
 * TikZ first, because roadmap §2.7 is right that it is the highest-value output here — it is
 * the only one that goes straight into the document a student is actually writing.
 *
 * ## Why the source is shown rather than downloaded
 *
 * A file lands in Downloads and then has to be found, opened and copied out of. The snippet is
 * going into a `.tex` that is already open, so the useful gesture is *copy*, and the useful
 * thing to look at is the text itself. Which also makes it checkable: someone who does not
 * trust the export can read it before pasting it.
 *
 * ## Live, per task B3
 *
 * It regenerates as the machine changes, because the promise is that what is on screen is what
 * comes out. A stale snippet quietly breaks that promise in the one way nobody checks — the
 * text still *looks* right.
 */

import { useMemo, useState } from 'react';

import { Panel } from '@/panels/Alphabet';
import type { Automaton, Point, StateId } from '@/model/automaton';
import type { Engine } from '@/wasm/loader';

/** How long the copy button stays acknowledged. Long enough to read, short enough to forget. */
const COPIED_MS = 1600;

export function ExportPanel({
  engine,
  automaton,
  layout,
}: {
  engine: Engine | undefined;
  automaton: Automaton;
  layout: Record<StateId, Point>;
}) {
  const [copied, setCopied] = useState(false);

  const source = useMemo(() => {
    if (!engine || automaton.states.length === 0) return undefined;
    try {
      return engine.toTikz(automaton, layout);
    } catch {
      // An export that throws must not take the editor with it. The panel says nothing rather
      // than showing half a snippet, because half a snippet is worse than none — it looks
      // pasteable.
      return undefined;
    }
  }, [engine, automaton, layout]);

  if (!source) {
    return (
      <Panel title="Export">
        <p className="text-sm text-k-text-faint">
          Draw a machine and its LaTeX appears here, positioned exactly as you have arranged it.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Export">
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-k-primary/40 bg-k-primary/10 px-2 py-0.5 font-mono text-[10px] text-k-primary">
          TikZ
        </span>
        <span className="font-mono text-[10px] text-k-text-faint">
          {source.split('\n').length} lines
        </span>

        <button
          type="button"
          onClick={() => {
            // `writeText` rejects when the document is not focused, which happens if the
            // click lands during a focus change. Failing silently would leave the button
            // saying "copied" over an empty clipboard, so the acknowledgement is only shown
            // once the write has actually resolved.
            void navigator.clipboard.writeText(source).then(
              () => {
                setCopied(true);
                setTimeout(() => {
                  setCopied(false);
                }, COPIED_MS);
              },
              () => {
                setCopied(false);
              },
            );
          }}
          className={`ml-auto rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors duration-(--duration-k-hover) ${
            copied
              ? 'border-k-success/40 bg-k-success/10 text-k-success'
              : 'border-k-border text-k-text-muted hover:border-k-border-strong hover:text-k-text'
          }`}
        >
          {copied ? 'copied ✓' : 'copy'}
        </button>
      </div>

      {/*
        `readOnly` rather than a `<pre>`: selecting part of a snippet to check one line is a
        thing people do, and a textarea gives select-all, keyboard scrolling and find-in-page
        for free. Spellcheck off, because LaTeX is not prose and a red underline under every
        command reads as an error.
      */}
      <textarea
        readOnly
        spellCheck={false}
        value={source}
        aria-label="TikZ source"
        className="mt-2 h-48 w-full resize-y rounded-lg border border-k-border bg-k-canvas p-2 font-mono text-[11px] leading-relaxed text-k-text-muted"
      />

      {/* Task B4. The commonest failure is a correct picture that will not compile in the
          document it was pasted into, and it is a missing line in the preamble every time. */}
      <p className="mt-2 text-[11px] leading-relaxed text-k-text-faint">
        Needs <code className="font-mono text-k-text-muted">\usepackage{'{tikz}'}</code> and{' '}
        <code className="font-mono text-k-text-muted">
          \usetikzlibrary{'{automata,positioning}'}
        </code>{' '}
        in your preamble — both are in the comment at the top.
      </p>
    </Panel>
  );
}
