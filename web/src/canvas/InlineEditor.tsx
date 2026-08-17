/**
 * The little input that appears over a state or an edge label.
 *
 * An HTML `<input>` positioned over the canvas rather than an SVG `foreignObject`. Nested HTML
 * inside SVG has patchy focus and selection behaviour across browsers, and this is the input
 * people will use most in the whole editor — it has to behave exactly like an input, including
 * text selection, the caret, and IME composition for anyone typing a non-Latin label.
 */

import { useEffect, useRef, useState } from 'react';

import type { Point } from '@/canvas/geometry';

interface Props {
  /** Where to sit, in *screen* coordinates relative to the canvas. */
  at: Point;
  /** Starting text, selected on open so typing replaces it. */
  value: string;
  placeholder?: string;
  /**
   * Shown under the input, recomputed as the text changes.
   *
   * A function rather than a string because the useful hint depends on what is being typed
   * right now — "adds c to the alphabet" is only worth saying while `c` is on screen.
   */
  hint?: (text: string) => string | undefined;
  /**
   * Why the current text cannot be committed, if it cannot.
   *
   * Enter does nothing while this is set, and the field says why. Refusing to close would trap
   * someone who cannot think of a free name, so Escape still cancels and clicking away still
   * commits — which, for a refused edit, means the old value survives untouched.
   */
  error?: (text: string) => string | undefined;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function InlineEditor({
  at,
  value,
  placeholder,
  hint,
  error,
  onCommit,
  onCancel,
}: Props) {
  const [text, setText] = useState(value);
  const problem = error?.(text);
  const message = problem ?? hint?.(text);
  const inputRef = useRef<HTMLInputElement>(null);

  // Composing is true while an IME is mid-word. Enter then means "accept this candidate", not
  // "commit the edit", and treating them the same truncates the word someone is typing.
  const composing = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // Selected rather than placed at the end, so typing replaces and one keystroke still
    // appends — the behaviour of every rename field people already know.
    input.select();
  }, []);

  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: at.x, top: at.y }}
      // The canvas listens for pointerdown to start selections and marquees. Without this,
      // clicking into the input to place the caret would deselect and close it.
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
      }}
    >
      <input
        ref={inputRef}
        value={text}
        placeholder={placeholder}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        onKeyDown={(event) => {
          // Stopped before it reaches the window, so the shortcut table never sees keys aimed
          // at this input. `isTypingTarget` already guards that, and this makes it true even
          // for a shortcut that legitimately fires while typing.
          event.stopPropagation();

          if (event.key === 'Enter' && !composing.current) {
            event.preventDefault();
            if (!problem) onCommit(text);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
        // Clicking away commits rather than discards. Losing what you typed because you
        // clicked the wrong pixel is the worse failure of the two, and Escape is right there
        // for anyone who meant to abandon it.
        onBlur={() => {
          onCommit(text);
        }}
        size={Math.max(4, text.length + 1)}
        className={`rounded-md border bg-k-surface-raised px-2 py-1 text-center font-mono text-[13px] text-k-text shadow-sm outline-none ${
          problem ? 'border-k-error' : 'border-k-primary'
        }`}
      />
      {message && (
        <p
          className={`pointer-events-none absolute top-full left-1/2 mt-1 -translate-x-1/2 rounded bg-k-surface-raised px-1.5 py-0.5 text-center font-mono text-[11px] whitespace-nowrap shadow-sm ${
            problem ? 'text-k-error' : 'text-k-text-faint'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
