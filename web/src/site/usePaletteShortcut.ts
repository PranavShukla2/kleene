/**
 * The shortcut that opens the command palette.
 *
 * Its own module rather than an export beside the component, for two reasons. The palette does
 * not have to be mounted and listening on every page in order to be openable — the shell owns
 * the shortcut and the palette owns the list. And a file exporting components should export
 * only components, which is what keeps fast refresh working on the files being edited most.
 */

import { useEffect } from 'react';

export function usePaletteShortcut(onOpen: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        // Chrome, Firefox and Safari all bind ⌘K to the address bar. Taking it is the
        // convention every product with a palette follows, and leaving it would mean the
        // shortcut works everywhere except the browsers people use.
        event.preventDefault();
        onOpen();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onOpen, enabled]);
}
