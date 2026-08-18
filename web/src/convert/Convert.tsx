/**
 * `/convert` — type a regular expression, watch it become a machine.
 *
 * Phase 3's home. Track A is the bar and the ε-NFA it produces; Tracks B through F fill the
 * page out with the DFA, the minimal DFA and the step-through that connects them. The panes
 * that do not exist yet say which phase they land in, exactly as the overview does — this page
 * being unfinished is not a reason to be vague about *how* unfinished.
 */

import { useMemo, useState } from 'react';

import { AutomatonView } from '@/canvas/AutomatonView';
import { rowLayout } from '@/canvas/geometry';
import { RegexBar } from '@/convert/RegexBar';
import { useCompiler } from '@/convert/useCompiler';
import type { Automaton } from '@/model/automaton';
import type { Engine } from '@/wasm/loader';

/** The empty-string glyph. From the engine once D7 makes notation a setting; ε until then. */
const EPSILON = 'ε';

export function Convert({ engine }: { engine: Engine | undefined }) {
  const [source, setSource] = useState('');
  const compilation = useCompiler(engine, source);

  const built: Automaton | undefined =
    compilation?.kind === 'parsed' ? compilation.automaton : undefined;

  // Thompson's construction emits states in a chain, so a row reads it correctly and costs
  // nothing. Track G's elkjs layout replaces this once there are four panes competing for
  // width and a row stops fitting.
  const layout = useMemo(
    () => (built ? rowLayout(built.states.map((state) => state.id)) : {}),
    [built],
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Convert</h1>
      <p className="mt-3 max-w-prose text-k-text-muted">
        Type a regular expression and watch it become a machine. The ε-NFA below is built by
        Thompson&rsquo;s construction, the same one your course draws by hand.
      </p>

      <div className="mt-8">
        <RegexBar
          source={source}
          onChange={setSource}
          compilation={compilation}
          epsilon={EPSILON}
        />
      </div>

      <Pane
        title="ε-NFA"
        subtitle="Thompson’s construction"
        count={built ? `${String(built.states.length)} states` : undefined}
      >
        {built ? (
          <AutomatonView
            automaton={built}
            layout={layout}
            title={`ε-NFA built from ${source}`}
            className="h-72 w-full"
          />
        ) : (
          <Placeholder>
            {compilation?.kind === 'failed'
              ? 'Fix the expression above and this fills in.'
              : 'The machine appears here as you type.'}
          </Placeholder>
        )}
      </Pane>

      {/*
        The rest of Phase 3, named rather than hidden. A page that simply stopped after one
        pane would read as finished-and-thin; one that says what is coming reads as in
        progress, which is the truth.
      */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ComingPane title="DFA" detail="Subset construction, one round at a time." task="B1" />
        <ComingPane
          title="Minimal DFA"
          detail="Partition refinement, with the string that split each block."
          task="E1"
        />
      </div>

      <p className="mt-6 text-sm text-k-text-faint">
        The step-through — every round, with the reasoning attached — is the rest of phase 3.
        The engine already produces those traces; this page is the view for them.
      </p>
    </main>
  );
}

function Pane({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  count: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-[10px] border border-k-border bg-k-surface">
      <header className="flex items-baseline justify-between gap-3 border-b border-k-border px-4 py-2.5">
        <h2 className="font-medium">
          {title}
          <span className="ml-2 text-sm font-normal text-k-text-faint">{subtitle}</span>
        </h2>
        {count && <span className="font-mono text-xs text-k-text-faint">{count}</span>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-72 items-center justify-center text-sm text-k-text-faint">
      {children}
    </div>
  );
}

function ComingPane({ title, detail, task }: { title: string; detail: string; task: string }) {
  return (
    <section className="rounded-[10px] border border-dashed border-k-border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium text-k-text-muted">{title}</h2>
        <span className="shrink-0 rounded-full border border-k-border px-2 py-0.5 font-mono text-[10px] text-k-text-faint">
          phase 3 · {task}
        </span>
      </div>
      <p className="mt-2 text-sm text-k-text-muted">{detail}</p>
    </section>
  );
}
