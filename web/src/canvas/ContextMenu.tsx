/**
 * The right-click menu.
 *
 * Deliberately a small, dumb component: it takes a list of items and a position and draws
 * them. What the items *are* depends on what was clicked, and that decision lives with the
 * canvas, which is the only thing that knows.
 *
 * A context menu is a discovery surface as much as a shortcut. Every item that has a keyboard
 * equivalent shows it, so using the menu teaches the key that would have avoided it.
 */

import { useEffect, useRef } from 'react';

/** One line in the menu. A separator is `undefined`, which reads better than a sentinel. */
export type MenuItem =
  | {
      label: string;
      /** The chord to show on the right, already formatted. */
      keys?: string;
      onSelect: () => void;
      /** Shown but not selectable — an action that does not apply right now. */
      disabled?: boolean;
      /** Rendered in the error colour. For destructive items only. */
      destructive?: boolean;
    }
  | undefined;

interface Props {
  /** Where to open, in coordinates relative to the containing element. */
  at: { x: number; y: number };
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ at, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Escape closes, in the capture phase, so the menu wins over `deselect` — while a menu is
    // open the menu owns the key, regardless of listener registration order.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return;
      event.stopPropagation();
      event.preventDefault();
      onClose();
    };

    // Any press outside closes it. On `pointerdown` rather than `click`, so the menu is gone
    // before whatever was clicked reacts — otherwise a click behind the menu both closes it
    // and starts a marquee.
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    // Scrolling or zooming under an open menu would leave it pointing at nothing.
    window.addEventListener('wheel', onClose, { passive: true });

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('wheel', onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      // Positioned by its top-left corner at the pointer, then pulled back inside the canvas
      // by translating rather than clamping — a menu that opens half off the edge is a menu
      // whose last item cannot be reached.
      className="absolute z-20 min-w-52 rounded-lg border border-k-border bg-k-surface-raised py-1 shadow-lg"
      style={{
        left: at.x,
        top: at.y,
        transform: 'translate(0, 0)',
        maxWidth: 'calc(100% - 8px)',
      }}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      {items.map((item, index) =>
        item === undefined ? (
          // A separator has no identity of its own, so its position is the only key available.
          // Safe here because the item list for a given target is built fresh and in a fixed
          // order — it is never reordered under React.
          <hr key={`separator-${String(index)}`} className="my-1 border-k-border" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
            className={`flex w-full items-baseline justify-between gap-6 px-3 py-1.5 text-left text-sm transition-colors duration-(--duration-k-hover) disabled:opacity-35 ${
              item.destructive
                ? 'text-k-error hover:bg-k-error/10'
                : 'text-k-text hover:bg-k-primary/10'
            } disabled:hover:bg-transparent`}
          >
            <span>{item.label}</span>
            {item.keys && (
              <kbd className="font-mono text-xs text-k-text-faint">{item.keys}</kbd>
            )}
          </button>
        ),
      )}
    </div>
  );
}
