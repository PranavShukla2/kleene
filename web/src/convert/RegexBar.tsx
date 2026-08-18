/**
 * The regex input — the app's primary input, per task A1.
 *
 * Made the visual focal point rather than one field among several. On the conversion page,
 * everything below it is a *consequence* of what is typed here, and a bar that looked like an
 * ordinary form field would read as one setting among many.
 *
 * ## Why the error is drawn under a transparent input
 *
 * A3 asks for the offending span underlined, not a red border and the word "invalid". An
 * `<input>` cannot style a range of its own text, so the real input sits transparent on top of
 * a mirrored copy that carries the underline. Both use the same font, size and padding, which
 * is what keeps the two in register — and is why those values are written once, here.
 */

import { useEffect, useRef, useState } from 'react';

import type { Compilation } from '@/model/automaton';
import { errorLine, insertAt, PALETTE, underline } from '@/convert/regex';

/** Shared by the real input and its mirror. Any drift between them shows as a misaligned mark. */
const FIELD = 'px-3 py-2.5 font-mono text-base leading-6 tracking-normal';

/** Expressions worth meeting first, per A5. */
const STARTERS: readonly { source: string; why: string }[] = [
  { source: 'a*b', why: 'star binds tighter than concatenation' },
  { source: '(a|b)*abb', why: 'the classic subset-construction blow-up' },
  { source: 'a(b|c)*', why: 'grouping changes what the star applies to' },
  { source: '(ab)*|b*', why: 'union of two starred groups' },
];

export function RegexBar({
  source,
  onChange,
  compilation,
  epsilon,
}: {
  source: string;
  onChange: (next: string) => void;
  /** The latest result, or undefined while the bar is empty. */
  compilation: Compilation | undefined;
  /** The empty-string glyph, from the engine's notation setting (D7). */
  epsilon: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [caret, setCaret] = useState(0);

  const failed = compilation?.kind === 'failed' ? compilation.error : undefined;
  const parts = failed ? underline(source, failed.span) : undefined;

  // Keep the caret where the palette put it. Setting `value` moves the caret to the end, which
  // would make inserting `(` at the start of an expression jump you to the far end of it.
  const pendingCaret = useRef<number | undefined>(undefined);
  useEffect(() => {
    const at = pendingCaret.current;
    if (at === undefined) return;
    pendingCaret.current = undefined;
    inputRef.current?.setSelectionRange(at, at);
  });

  const insert = (text: string) => {
    const next = insertAt(source, caret, text);
    pendingCaret.current = next.caret;
    setCaret(next.caret);
    onChange(next.value);
    inputRef.current?.focus();
  };

  // No `aria-label` on the section below. Naming it the same as the input inside it makes a
  // screen reader announce "Regular expression, region" and then "Regular expression, edit" —
  // two things with one name, which is worse than one thing named once. An unnamed section is
  // not exposed as a landmark at all, which is right: this is a group, not a region.
  return (
    <section>
      <div
        className={`relative rounded-lg border bg-k-surface-raised transition-colors duration-(--duration-k-hover) ${
          failed ? 'border-k-error' : 'border-k-border focus-within:border-k-primary'
        }`}
      >
        {/*
          The mirror. Same text, same metrics, underneath — it exists only to carry the mark
          under the offending characters, so it is hidden from assistive technology and from
          the pointer.
        */}
        <div aria-hidden className={`pointer-events-none absolute inset-0 ${FIELD}`}>
          {parts ? (
            <span className="whitespace-pre text-transparent">
              {parts.before}
              <span
                className={`underline decoration-k-error decoration-wavy decoration-2 underline-offset-4 ${
                  // A zero-width span cannot show a mark, and "expected something after `(`"
                  // legitimately points past the last character. A caret-width block stands in.
                  parts.offending === '' ? 'border-l-2 border-k-error' : ''
                }`}
              >
                {parts.offending}
              </span>
              {parts.after}
            </span>
          ) : null}
        </div>

        <input
          ref={inputRef}
          value={source}
          onChange={(event) => {
            onChange(event.target.value);
            setCaret(event.target.selectionStart ?? event.target.value.length);
          }}
          onKeyUp={(event) => {
            setCaret(event.currentTarget.selectionStart ?? 0);
          }}
          onClick={(event) => {
            setCaret(event.currentTarget.selectionStart ?? 0);
          }}
          onKeyDown={(event) => {
            // The canvas below binds single letters; a regex is made of them.
            event.stopPropagation();
          }}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-label="Regular expression"
          aria-invalid={failed !== undefined}
          placeholder="type a regular expression"
          className={`relative w-full bg-transparent text-k-text outline-none placeholder:text-k-text-faint ${FIELD}`}
        />
      </div>

      {/*
        The message sits directly under the input, aligned with the mark it explains. On the
        palette row — pushed right, as it first was — a long sentence ends up as far from the
        underlined character as the layout allows, which is the opposite of what A3 asks for.
      */}
      {failed && (
        <p role="status" className="mt-2 text-sm text-k-error">
          {errorLine(failed)}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {PALETTE.map((key) => (
          <PaletteKey
            key={key.insert}
            label={key.label}
            hint={key.hint}
            onInsert={() => {
              insert(key.insert);
            }}
          />
        ))}
        {/*
          ε comes from the engine's notation setting rather than the palette's markup (D7), so
          a λ-configured session inserts λ — inserting the wrong glyph would insert a character
          the parser then rejects.
        */}
        <PaletteKey
          label={epsilon}
          hint="the empty string"
          onInsert={() => {
            insert(epsilon);
          }}
        />

        <Canonical compilation={compilation} />
      </div>

      {source.trim() === '' && (
        <Starters
          onPick={(next) => {
            onChange(next);
          }}
        />
      )}
    </section>
  );
}

/**
 * The expression as the parser understood it.
 *
 * The point of the core returning it at all: someone who expected `ab|c` to mean `a(b|c)` finds
 * out here rather than by puzzling over a diagram. Short enough to share the palette row, and
 * right-aligned so it does not compete with the keys for the eye.
 */
function Canonical({ compilation }: { compilation: Compilation | undefined }) {
  if (compilation?.kind !== 'parsed') return null;

  return (
    <p className="ml-auto font-mono text-xs text-k-text-faint">
      read as <span className="text-k-text-muted">{compilation.canonical}</span>
    </p>
  );
}

function PaletteKey({
  label,
  hint,
  onInsert,
}: {
  label: string;
  hint: string;
  onInsert: () => void;
}) {
  return (
    <button
      type="button"
      title={hint}
      aria-label={`Insert ${label} — ${hint}`}
      onClick={onInsert}
      className="rounded-md border border-k-border px-2.5 py-1 font-mono text-sm text-k-text-muted transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text"
    >
      {label}
    </button>
  );
}

/**
 * The empty state, which A5 calls the most-viewed screen in the app.
 *
 * So it teaches rather than sitting blank. Each starter carries *why it is worth typing* — a
 * list of four expressions with no explanation is a list of four expressions.
 */
function Starters({ onPick }: { onPick: (source: string) => void }) {
  return (
    <div className="mt-4">
      <p className="text-sm text-k-text-faint">Or start from one of these:</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {STARTERS.map((starter) => (
          <li key={starter.source}>
            <button
              type="button"
              onClick={() => {
                onPick(starter.source);
              }}
              className="rounded-md border border-k-border bg-k-surface px-3 py-1.5 text-left transition-colors duration-(--duration-k-hover) hover:border-k-primary/50"
            >
              <span className="font-mono text-sm text-k-text">{starter.source}</span>
              <span className="ml-2 text-xs text-k-text-faint">{starter.why}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
