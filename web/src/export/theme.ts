/**
 * What an export looks like, as opposed to what the screen looks like (task C4).
 *
 * The rule is that export **defaults to the light palette even for a dark-mode user**, and it
 * is not a preference — it is the difference between a usable export and a wasted one. Exports
 * go into white documents. A dark-mode user who exports what they see pastes a black rectangle
 * into their assignment, and they will not notice until it is printed.
 *
 * Honouring the current theme is still offered, because someone exporting for a dark slide
 * deck wants exactly that. It is just not the default.
 */

/** How the palette is forced while an export is being serialized. */
const THEME_ATTRIBUTE = 'data-theme';

/**
 * Run `read` with the document temporarily forced to a palette.
 *
 * Mutating `<html>` and putting it back looks alarming and is the correct mechanism: every
 * colour in this app comes from custom properties resolved against the root, so the only way
 * to ask "what would this look like in light mode" is to *be* in light mode while asking.
 *
 * Safe because `read` is synchronous. The browser cannot paint between the two mutations —
 * there is no yield point for it to do so — so nothing flashes.
 *
 * The previous value is restored rather than removed: `data-theme` absent means "follow the
 * system", which is a different state from "light", and clearing it would silently switch a
 * user off their explicit choice.
 */
export function inPalette<T>(palette: 'light' | 'dark' | 'current', read: () => T): T {
  if (palette === 'current') return read();

  const root = document.documentElement;
  const previous = root.getAttribute(THEME_ATTRIBUTE);
  root.setAttribute(THEME_ATTRIBUTE, palette);

  try {
    return read();
  } finally {
    if (previous === null) root.removeAttribute(THEME_ATTRIBUTE);
    else root.setAttribute(THEME_ATTRIBUTE, previous);
  }
}

/** The page background for a palette, for exports that are not transparent. */
export function backgroundFor(palette: 'light' | 'dark' | 'current'): string {
  return inPalette(palette, () =>
    window.getComputedStyle(document.documentElement).getPropertyValue('--color-k-bg').trim(),
  );
}
