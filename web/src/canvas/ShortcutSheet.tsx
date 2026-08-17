/**
 * The `?` shortcut sheet.
 *
 * Rendered entirely from `SHORTCUTS`, so it cannot describe a key that does not work and
 * cannot omit one that does. That is the whole point of the table existing; the alternative is
 * a hand-written list that is accurate on the day it ships.
 */

import { useEffect, useRef } from 'react';

import { GROUPS, formatChord, isMac, shortcutsIn, type Shortcut } from '@/canvas/shortcuts';

export function ShortcutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const mac = isMac();

  // Escape closes, and is handled here rather than through the shortcut table: `deselect` is
  // also bound to Escape, and while a dialog is open the dialog owns the key. Listening in
  // the capture phase is what makes that true regardless of which listener was added first.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return;
      event.stopPropagation();
      event.preventDefault();
      onClose();
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-k-text/20 p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        tabIndex={-1}
        // Clicks inside must not reach the backdrop, or the sheet closes as soon as anyone
        // tries to select the text in it.
        onClick={(event) => {
          event.stopPropagation();
        }}
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl border border-k-border bg-k-surface-raised p-6 shadow-xl outline-none"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 font-mono text-xs text-k-text-faint transition-colors duration-(--duration-k-hover) hover:text-k-text"
          >
            Esc
          </button>
        </div>

        <div className="mt-5 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {GROUPS.map((group) => {
            const rows = shortcutsIn(group);
            if (rows.length === 0) return null;
            return (
              <section key={group}>
                <h3 className="text-[11px] font-semibold tracking-[0.06em] text-k-text-faint uppercase">
                  {group}
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {rows.map((shortcut) => (
                    <Row key={shortcut.id} shortcut={shortcut} mac={mac} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="mt-6 border-t border-k-border pt-4 text-sm text-k-text-faint">
          Double-click the canvas to add a state, or a state to toggle whether it accepts. Drag
          from a state&rsquo;s edge to draw a transition. Hold space, or drag with the middle
          button, to pan.
        </p>
      </div>
    </div>
  );
}

function Row({ shortcut, mac }: { shortcut: Shortcut; mac: boolean }) {
  return (
    <li className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-k-text-muted">{shortcut.label}</span>
      <kbd className="rounded border border-k-border bg-k-surface px-1.5 py-0.5 font-mono text-xs whitespace-nowrap text-k-text">
        {formatChord(shortcut.chord, mac)}
      </kbd>
    </li>
  );
}
