/**
 * Runs the shortcut table against real key events.
 *
 * Deliberately trivial: match, guard, dispatch. Everything about *which* keys mean what lives
 * in `shortcuts.ts`, so this file has no opinions to go stale.
 */

import { useEffect, useRef } from 'react';

import { isTypingTarget, shortcutFor, type ShortcutId } from '@/canvas/shortcuts';

export type ShortcutHandlers = Partial<Record<ShortcutId, () => void>>;

/**
 * Bind the shortcut table.
 *
 * Handlers are read through a ref, so passing a fresh object every render — which every caller
 * will do — does not detach and reattach the listener on each keystroke.
 */
export function useShortcuts(handlers: ShortcutHandlers, enabled = true): void {
  const handlersRef = useRef(handlers);

  // After commit rather than during render: a render that gets discarded must not leave the
  // ref holding handlers that closed over state nobody ever saw.
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = shortcutFor(event);
      if (!shortcut) return;

      // A shortcut that has no handler is not handled — it must fall through to the browser
      // rather than being swallowed. Otherwise binding a chord in the table quietly disables
      // the browser's own behaviour before anything is wired up to replace it.
      const handler = handlersRef.current[shortcut.id];
      if (!handler) return;

      if (isTypingTarget(event.target) && !shortcut.whileTyping) return;

      // Only prevented once something has actually claimed the key. Cmd+A that reaches here
      // selects the states rather than the page, and Cmd+Z does not walk the browser's own
      // undo stack through a text field it can no longer see.
      event.preventDefault();
      handler();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled]);
}
