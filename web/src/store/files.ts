/**
 * `.kln` files: saving one, opening one, and dropping one on the canvas (Phase 4 Track D).
 *
 * Everything here is *around* the format rather than in it. The format lives in Rust and is
 * frozen (decision D8); this is the browser's half — a file picker, a download, and a drop
 * target — none of which belongs in a crate that also compiles to WebAssembly.
 *
 * ## What a failed open has to do
 *
 * Say what went wrong, in a sentence, and **leave the open document alone**. Someone who drags
 * the wrong file onto their work has made a small mistake; losing an hour of drawing to it
 * would be the application's mistake, and a much larger one.
 */

import type { Document } from '@/model/automaton';
import { desktopOpen, desktopSave, isDesktop } from '@/store/desktop';
import type { Engine } from '@/wasm/loader';

/** Kleene's own format. */
export const KLN = '.kln';

/** JFLAP's, which this reads but never writes (Phase 4 Track E). */
export const JFF = '.jff';

/** What the file picker offers, and what a drop will accept. */
export const OPENABLE = [KLN, JFF] as const;

/** What opening a file produced. Never a thrown error — a bad file is an ordinary outcome. */
export type Opened =
  | {
      ok: true;
      document: Document;
      /**
       * What an import had to drop, when it dropped anything.
       *
       * Only ever set for `.jff`: Kleene's own format round-trips exactly, and a note there
       * would mean a bug rather than a difference between two tools' models.
       */
      notes?: string[];
    }
  /** A sentence to show the reader, already written for them by the engine. */
  | { ok: false; message: string };

/**
 * Read a file as a document.
 *
 * The engine does the version check and the validation, so this is only the plumbing: read
 * text, hand it over, turn a thrown error into a value the caller can render.
 */
export async function openFile(engine: Engine, file: File): Promise<Opened> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, message: `${file.name} could not be read.` };
  }

  /*
    Chosen by extension rather than by sniffing the contents. Both formats announce themselves
    clearly enough to guess from, and guessing would mean a `.kln` with a stray `<` producing a
    JFLAP parse error — a message about the wrong tool entirely.
  */
  const jflap = file.name.toLowerCase().endsWith(JFF);

  try {
    if (jflap) {
      const imported = engine.fromJff(text);
      return {
        ok: true,
        document: {
          version: 1,
          automaton: imported.automaton,
          // JFLAP's axes run the same way a screen's do, so the arrangement carries across
          // untouched. Re-laying it out would throw away exactly the part someone spent their
          // time on — which is the whole reason for importing rather than redrawing.
          layout: Object.fromEntries(
            Object.entries(imported.layout).map(([id, at]) => [Number(id), at]),
          ),
        },
        notes: imported.notes,
      };
    }

    return { ok: true, document: engine.fromKln(text) };
  } catch (error) {
    // The engine's messages are written to be shown — "This file contains a pushdown
    // automaton, which Kleene does not support yet" — so they are passed through rather than
    // replaced with a generic one.
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : `${file.name} is not a file Kleene can open.`,
    };
  }
}

/**
 * Ask for a file. Resolves to nothing if the picker is dismissed.
 *
 * The desktop build gets the operating system's dialog; a browser gets a hidden file input,
 * which is the right answer there and the only one available.
 */
export async function pickFile(): Promise<File | undefined> {
  if (isDesktop()) return desktopOpen();

  return new Promise((resolve) => {
    const input = window.document.createElement('input');
    input.type = 'file';
    input.accept = OPENABLE.join(',');

    input.addEventListener('change', () => {
      resolve(input.files?.[0]);
    });
    // `cancel` fires when the picker is dismissed. Without it the promise never settles, and
    // a caller that disabled a button while waiting would leave it disabled forever.
    input.addEventListener('cancel', () => {
      resolve(undefined);
    });

    input.click();
  });
}

/**
 * Save a document, named after its title.
 *
 * In the desktop build this goes through the system's save dialog. The browser path — an `<a
 * download>` click — is the correct one in a browser and unreliable in a webview, where a
 * download can be intercepted by the shell and land somewhere the user never sees, or be
 * dropped in silence. "Save appears to do nothing" is the failure that produces.
 */
export function saveFile(engine: Engine, document: Document, title: string | undefined): void {
  const text = engine.toKln(document);

  if (isDesktop()) {
    void desktopSave(text, filenameFor(title));
    return;
  }

  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = window.document.createElement('a');
  link.href = url;
  link.download = filenameFor(title);
  link.click();

  requestAnimationFrame(() => {
    URL.revokeObjectURL(url);
  });
}

/** A filename from a title, or a sensible default. */
export function filenameFor(title: string | undefined): string {
  const slug = (title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

  return `${slug === '' ? 'automaton' : slug}${KLN}`;
}

/**
 * Whether a drag is carrying something worth dropping.
 *
 * During a drag, browsers withhold file *names* for privacy — only types are visible, and a
 * `.kln` has no registered MIME type so it arrives as `""` or `application/json`. So this
 * cannot check the extension, and answers the weaker question it can: is this a file at all.
 * The extension is checked on drop, where the name is finally readable.
 */
export function isFileDrag(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.items ?? []).some((item) => item.kind === 'file');
}

/** The first openable file in a drop, if there is one. */
export function droppedFile(event: DragEvent): File | undefined {
  return Array.from(event.dataTransfer?.files ?? []).find((file) =>
    OPENABLE.some((extension) => file.name.toLowerCase().endsWith(extension)),
  );
}
