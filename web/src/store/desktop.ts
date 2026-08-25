/**
 * The parts of saving and opening that only exist in the desktop build.
 *
 * ## Why every import here is dynamic
 *
 * Tauri's client packages are useless in a browser, and most people run this in one. Importing
 * them at the top of a module would put them in the main chunk, so every student on a slow
 * connection would download the code for a native file dialog they can never open.
 *
 * `await import(...)` inside a branch that only a desktop build takes means Vite emits them as
 * a separate chunk that a browser never requests. The cost to the web app is a few bytes of
 * feature detection.
 *
 * They are `devDependencies` for the same reason: nothing in a browser build needs them at
 * runtime, and marking them as ordinary dependencies would suggest otherwise to anyone reading
 * the manifest.
 *
 * ## Why the browser paths are not simply replaced
 *
 * `<a download>` and `<input type="file">` work in every browser and are the right answer
 * there. In a webview they are at best unpredictable — a download handled by the shell can
 * land somewhere the user never sees, or be dropped in silence, which is how "Save" in a
 * desktop app comes to do nothing at all. So the native dialogs are an *addition* for the one
 * host that needs them, not a replacement for the path that already works.
 */

/** The extensions the dialogs offer, matching `fileAssociations` in `tauri.conf.json`. */
const FILTERS = [{ name: 'Automaton', extensions: ['kln', 'jff'] }];

/**
 * Whether the page is running inside the desktop shell.
 *
 * `__TAURI_INTERNALS__` is what Tauri v2 injects, and checking for it is synchronous — which
 * matters, because the answer decides which of two code paths a click takes and a click cannot
 * wait for a round trip.
 */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Ask for a file through the operating system's own dialog. */
export async function desktopOpen(): Promise<File | undefined> {
  const [{ open }, { readTextFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);

  const path = await open({ multiple: false, directory: false, filters: FILTERS });
  if (typeof path !== 'string') return undefined;

  // Handed back as a `File` so every caller downstream — the importer, the drop handler, the
  // error messages — stays identical on both hosts. One shape of input, one set of paths
  // through the app.
  const text = await readTextFile(path);
  const name = path.split(/[/\\]/).pop() ?? 'untitled.kln';
  return new File([text], name, { type: 'application/json' });
}

/**
 * Save through the operating system's own dialog.
 *
 * Returns whether anything was written, so the caller can tell "cancelled" from "saved" —
 * a distinction the browser's download path cannot make and this one can.
 */
export async function desktopSave(text: string, suggested: string): Promise<boolean> {
  const [{ save }, { writeTextFile }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ]);

  const path = await save({ defaultPath: suggested, filters: FILTERS });
  if (typeof path !== 'string') return false;

  await writeTextFile(path, text);
  return true;
}
