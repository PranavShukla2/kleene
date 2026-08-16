/**
 * When to save, and when work is genuinely at risk.
 *
 * The scheduling is separated from the storage so it can be tested directly: the interesting
 * question is *when* a save happens and *whether* anything would be lost right now, and
 * neither is easier to reason about through a mock database.
 */

import type { EditorDocument } from '@/store/document';
import type { DocumentStore } from '@/store/persistence';
import { AUTOSAVE_KEY } from '@/store/persistence';

/**
 * How long editing has to pause before a save is written.
 *
 * Long enough that dragging a state does not write on every pointer frame; short enough that
 * the window in which work is unsaved stays under a second. It matches the undo coalescing
 * window, which is not a coincidence — both are asking "has the user stopped doing the thing
 * they were doing?"
 */
export const AUTOSAVE_DELAY_MS = 400;

/** What an autosaver is doing right now. */
export interface AutosaveStatus {
  /** A save is scheduled or in flight, so the newest edits are not yet stored. */
  pending: boolean;
  /** The last save failed. Work is at risk and the user should be told. */
  failed: boolean;
}

/**
 * Debounced writes to a store, with enough status for a `beforeunload` guard.
 *
 * Not a React hook, so it can be driven directly in a test with a fake clock.
 */
export class Autosaver {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private queued: EditorDocument | undefined;
  private writing = false;
  private failed = false;
  private listeners = new Set<() => void>();

  constructor(
    private readonly store: DocumentStore,
    private readonly delay = AUTOSAVE_DELAY_MS,
    private readonly key = AUTOSAVE_KEY,
  ) {}

  /** Record a change. The write happens once editing pauses. */
  schedule(document: EditorDocument): void {
    this.queued = document;
    this.announce();

    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, this.delay);
  }

  /**
   * Write immediately, if anything is waiting.
   *
   * Called on page hide as well as by the timer — a tab being closed will not wait 400ms
   * for a debounce, and that is exactly the moment a save matters most.
   */
  async flush(): Promise<void> {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    const document = this.queued;
    if (document === undefined || this.writing) return;

    this.writing = true;
    try {
      await this.store.put(this.key, document);
      // Only clear the queue if nothing arrived while the write was in flight; otherwise
      // the newer document would be dropped and reported as saved.
      if (this.queued === document) this.queued = undefined;
      this.failed = false;
    } catch {
      // Deliberately swallowed. A failed autosave must not break editing — it is reported
      // through `status`, which is what the unload guard reads.
      this.failed = true;
    } finally {
      this.writing = false;
      this.announce();
    }
  }

  /** Whether anything is unsaved, and whether the last attempt failed. */
  get status(): AutosaveStatus {
    return { pending: this.queued !== undefined || this.writing, failed: this.failed };
  }

  /** Subscribe to status changes. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Stop any pending timer. */
  dispose(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.listeners.clear();
  }

  private announce(): void {
    for (const listener of this.listeners) listener();
  }
}

/**
 * Whether leaving the page right now would lose work.
 *
 * Deliberately **not** "has the document been edited". Autosave means an edited document is
 * usually already safe, and a browser prompt on every close would be noise that people learn
 * to dismiss — at which point it no longer protects the one case it exists for.
 *
 * The guard fires only while a save is genuinely outstanding: still debouncing, still
 * writing, or failed.
 */
export function wouldLoseWork(status: AutosaveStatus): boolean {
  return status.pending || status.failed;
}
