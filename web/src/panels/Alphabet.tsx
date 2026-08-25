/**
 * The alphabet panel: Σ, and how to change it.
 *
 * Small, and one decision in it is load-bearing. Removing a symbol that transitions still read
 * would silently delete those transitions — the machine changes shape and the only visible
 * evidence is arrows that are no longer there. So removal names what it will take with it, and
 * asks.
 */

import { useState } from 'react';

import type { Automaton, Sym } from '@/model/automaton';

interface Props {
  automaton: Automaton;
  onAdd: (symbol: Sym) => void;
  onRemove: (symbol: Sym) => void;
}

export function Alphabet({ automaton, onAdd, onRemove }: Props) {
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState<Sym | undefined>(undefined);

  const symbol = draft.trim();
  const duplicate = symbol.length > 0 && automaton.alphabet.includes(symbol);

  const commit = () => {
    if (symbol.length === 0 || duplicate) return;
    onAdd(symbol);
    setDraft('');
  };

  return (
    <Panel title="Alphabet">
      {automaton.alphabet.length === 0 ? (
        <p className="text-sm text-k-text-faint">
          Empty. Symbols are added automatically as you label transitions.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {automaton.alphabet.map((letter) => (
            <li key={letter}>
              <SymbolChip
                letter={letter}
                uses={countUses(automaton, letter)}
                confirming={confirming === letter}
                onRequestRemove={() => {
                  // One click asks, the second removes. A confirmation step for something
                  // this small is usually noise — but this one can delete transitions the
                  // user never mentioned, and that is worth a second click.
                  const uses = countUses(automaton, letter);
                  if (uses === 0) onRemove(letter);
                  else setConfirming(letter);
                }}
                onConfirm={() => {
                  onRemove(letter);
                  setConfirming(undefined);
                }}
                onCancel={() => {
                  setConfirming(undefined);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex gap-1.5">
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            // Stopped here so the canvas shortcuts never see a symbol being typed.
            event.stopPropagation();
            if (event.key === 'Enter') commit();
          }}
          placeholder="add a symbol"
          aria-label="Add a symbol to the alphabet"
          className={`min-w-0 flex-1 rounded-md border bg-k-surface-raised px-2 py-1 font-mono text-sm text-k-text outline-none placeholder:text-k-text-faint ${
            duplicate ? 'border-k-error' : 'border-k-border focus:border-k-primary'
          }`}
        />
        <button
          type="button"
          onClick={commit}
          disabled={symbol.length === 0 || duplicate}
          className="rounded-md border border-k-border px-2.5 py-1 text-sm text-k-text-muted transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {duplicate && <p className="mt-1 font-mono text-[11px] text-k-error">already in Σ</p>}
    </Panel>
  );
}

function SymbolChip({
  letter,
  uses,
  confirming,
  onRequestRemove,
  onConfirm,
  onCancel,
}: {
  letter: string;
  uses: number;
  confirming: boolean;
  onRequestRemove: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (confirming) {
    return (
      <span className="flex items-center gap-1.5 rounded-md border border-k-error bg-k-error/5 px-2 py-1 text-xs">
        <span className="text-k-error">
          delete <span className="font-mono">{letter}</span> and {uses}{' '}
          {uses === 1 ? 'transition' : 'transitions'}?
        </span>
        <button
          type="button"
          onClick={onConfirm}
          className="font-medium text-k-error underline"
        >
          yes
        </button>
        <button type="button" onClick={onCancel} className="text-k-text-faint underline">
          no
        </button>
      </span>
    );
  }

  return (
    <span className="group flex items-center gap-1 rounded-md border border-k-border bg-k-surface-raised py-1 pr-1 pl-2 font-mono text-sm">
      {letter}
      {/*
        The use count is what makes removal safe to reason about: it is the number of
        transitions that would go with the symbol. Titled because a bare number beside a
        letter is otherwise a small mystery.
      */}
      <span
        title={`read by ${String(uses)} ${uses === 1 ? 'transition' : 'transitions'}`}
        className="text-[10px] text-k-text-faint"
      >
        {uses}
      </span>
      <button
        type="button"
        onClick={onRequestRemove}
        aria-label={`Remove ${letter} from the alphabet`}
        className="rounded px-1 text-k-text-faint transition-colors duration-(--duration-k-hover) hover:bg-k-error/10 hover:text-k-error"
      >
        ×
      </button>
    </span>
  );
}

/** How many transitions read this symbol. */
function countUses(automaton: Automaton, symbol: Sym): number {
  return automaton.transitions.filter((transition) => transition.on === symbol).length;
}

/** A titled block in the sidebar. Shared shape so the panels line up without repeating it. */
/**
 * One panel in the side column.
 *
 * The finish matches the site — 14px radius, a raised surface, a hairline rule under the
 * heading — while the *density* does not. Padding stays at 12px and the heading at 11px,
 * because a workbench earns its screen by fitting more on it, and a panel column set to
 * marketing spacing would show three panels where this shows five.
 *
 * The rule under the heading is doing real work rather than decorating: five stacked panels
 * with only a gap between them read as one long list, and the eye has to count borders to
 * find where a section starts.
 */
export function Panel({
  title,
  children,
}: {
  /**
   * Omitted when the dock's own header already names this panel.
   *
   * A panel that is the only thing in a drawer titled "Table" does not need to say
   * "TRANSITION TABLE" underneath it. The heading still earns its place where two panels
   * share a drawer — the 5-tuple beside the alphabet, export beside share — because there the
   * rule is what separates them.
   */
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-k-border bg-k-surface-raised/70 p-3 shadow-[0_1px_2px_0_var(--color-k-glass-shadow)]">
      {title !== undefined && (
        <h2 className="mb-2 border-b border-k-border/70 pb-1.5 font-mono text-[10px] font-medium tracking-[0.08em] text-k-text-faint uppercase">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
