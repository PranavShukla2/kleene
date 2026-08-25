/**
 * The LaTeX for the machine on this page, immediately.
 *
 * For `/tools/dfa-to-latex`, which is a different shape from the other tool pages: the four
 * before it are conversions, and this one is an *export*. Someone arriving here has a diagram
 * and a document to put it in, and the thing they want to see is the source — not a tour of a
 * feature that lives behind a panel in an editor they have not opened.
 *
 * So the page shows the source for its worked example, with a copy button, and the editor is
 * the next step rather than the first one.
 *
 * The layout comes from `rowLayout` rather than the canvas, because there is no canvas here.
 * That is the same fallback the CLI uses for a machine nobody has arranged, and it means the
 * TikZ on this page is exactly what `kleene export … --format tikz` would print.
 */

import { useMemo, useState } from 'react';

import { rowLayout } from '@/canvas/geometry';
import type { Automaton } from '@/model/automaton';
import type { Engine } from '@/wasm/loader';

export function TikzPreview({
  engine,
  automaton,
}: {
  engine: Engine | undefined;
  automaton: Automaton | undefined;
}) {
  const [copied, setCopied] = useState(false);

  const tex = useMemo(() => {
    if (!engine || !automaton) return undefined;
    const layout = rowLayout(automaton.states.map((state) => state.id));
    return engine.toTikz(automaton, layout);
  }, [engine, automaton]);

  if (!tex) return null;

  return (
    <div className="rounded-2xl border border-k-border bg-k-surface p-5">
      <div className="flex items-center gap-3">
        <h3 className="font-mono text-[10px] tracking-[0.08em] text-k-text-faint uppercase">
          The LaTeX for the machine above
        </h3>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(tex).then(() => {
              setCopied(true);
              setTimeout(() => {
                setCopied(false);
              }, 1600);
            });
          }}
          className="ml-auto rounded-full border border-k-border px-3 py-1 font-mono text-xs text-k-text-muted hover:border-k-primary/50 hover:text-k-text"
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>

      <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-k-canvas p-3 font-mono text-[11px] leading-relaxed text-k-text-muted">
        {tex}
      </pre>

      <p className="mt-3 text-xs leading-relaxed text-k-text-faint">
        Source, not a picture — it typesets at your document&rsquo;s own size and font. The two
        packages it needs are named in the comment at the top, because the commonest way this
        fails is a correct picture that will not compile in the document it was pasted into.
      </p>
    </div>
  );
}
