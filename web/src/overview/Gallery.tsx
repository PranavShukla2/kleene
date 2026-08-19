/**
 * The example gallery, at a URL worth sharing.
 *
 * Named `Gallery` rather than `Examples` because the data file beside it is `examples.ts`, and
 * two files differing only by case in one directory is a portability bug macOS hides: the
 * filesystem here is case-insensitive, CI's is not, so the two would resolve differently on the
 * machine that matters. Phase 5 C5 calls this a gallery anyway.
 *
 * L2 and L3, and the shape Phase 5 Track C fills in. Two machines today; the page says so
 * rather than padding the grid out, because a gallery that pretends to be bigger than it is
 * gets found out on the second click.
 *
 * Filtering is by **topic, not tier** (Phase 5 C7). Someone arrives here stuck on ε-transitions
 * or wondering why their DFA grew a trap state — they are looking for the thing they are stuck
 * on, not for a difficulty. Tiers tell you whether you *can* read an example; topics tell you
 * whether you *want* to.
 */

import { useState } from 'react';

import { AutomatonView } from '@/canvas/AutomatonView';
import { rowLayout } from '@/canvas/geometry';
import type { Automaton } from '@/model/automaton';
import {
  availableTopics,
  EXAMPLES,
  filterByTopic,
  type Example,
  type Topic,
} from '@/overview/examples';
import { Reveal } from '@/site/motion';
import { Band, Masthead } from '@/site/page';
import type { Engine } from '@/wasm/loader';

export function Gallery({
  engine,
  onOpen,
}: {
  /** Present once the engine has loaded, so cards can show the real machine. */
  engine: Engine | undefined;
  onOpen: (key: string) => void;
}) {
  const [topic, setTopic] = useState<Topic | undefined>(undefined);
  const shown = filterByTopic(topic);

  return (
    <main>
      <Masthead
        eyebrow="Examples"
        title="Machines worth reading before you draw your own"
        detail="Each opens in the editor, ready to change — and changing one never affects anyone else’s, because nothing here is stored on a server."
      />

      <Band>
        <div className="flex flex-wrap items-center gap-2">
          <TopicChip
            label="everything"
            active={topic === undefined}
            onClick={() => {
              setTopic(undefined);
            }}
          />
          {availableTopics().map((option) => (
            <TopicChip
              key={option}
              label={option}
              active={topic === option}
              onClick={() => {
                setTopic(option);
              }}
            />
          ))}
          <span className="ml-auto font-mono text-xs text-k-text-faint">
            {shown.length} of {EXAMPLES.length} · more in phase 5
          </span>
        </div>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {shown.map((example, index) => (
            <Reveal as="li" key={example.key} delay={Math.min(index, 5) * 0.05}>
              <ExampleCard example={example} engine={engine} onOpen={onOpen} />
            </Reveal>
          ))}
        </ul>

        {shown.length === 0 && (
          <p className="mt-10 text-k-text-muted">
            Nothing tagged <span className="font-mono">{topic}</span> yet — Phase 5 adds about
            twenty more.
          </p>
        )}
      </Band>
    </main>
  );
}

function TopicChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors duration-(--duration-k-hover) ${
        active
          ? 'border-k-primary bg-k-primary/10 text-k-primary'
          : 'border-k-border text-k-text-muted hover:border-k-border-strong hover:text-k-text'
      }`}
    >
      {label}
    </button>
  );
}

function ExampleCard({
  example,
  engine,
  onOpen,
}: {
  example: Example;
  engine: Engine | undefined;
  onOpen: (key: string) => void;
}) {
  // Drawn only once the engine is here. A card that reserved space for a diagram and then
  // showed none would make the page jump as wasm arrives; without the engine it simply reads
  // as a description, which is still useful.
  const machine: Automaton | undefined = engine ? tryExample(engine, example.key) : undefined;

  return (
    <button
      type="button"
      onClick={() => {
        onOpen(example.key);
      }}
      className="k-card flex h-full w-full flex-col rounded-2xl border border-k-border bg-k-surface p-4 text-left hover:border-k-primary/50"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium text-k-text">{example.title}</h2>
        <span className="shrink-0 rounded-full border border-k-border px-2 py-0.5 font-mono text-[10px] text-k-text-faint">
          {example.tier}
        </span>
      </div>

      <p className="mt-2 font-mono text-xs text-k-text-muted">{example.language}</p>

      {machine && (
        <AutomatonView
          automaton={machine}
          layout={rowLayout(machine.states.map((state) => state.id))}
          title={`${example.title}: ${example.language}`}
          className="mt-4 h-32 w-full"
        />
      )}

      <p className="mt-4 text-sm text-k-text-muted">{example.teaches}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {example.topics.map((topic) => (
          <span key={topic} className="font-mono text-[10px] text-k-text-faint">
            #{topic}
          </span>
        ))}
      </div>
    </button>
  );
}

/** An example key that no longer exists must not take the page down with it. */
function tryExample(engine: Engine, key: string): Automaton | undefined {
  try {
    return engine.example(key);
  } catch {
    return undefined;
  }
}
