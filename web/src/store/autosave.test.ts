import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTOSAVE_DELAY_MS, Autosaver, wouldLoseWork } from '@/store/autosave';
import { emptyDocument, type EditorDocument } from '@/store/document';
import { AUTOSAVE_KEY, memoryStore, type DocumentStore } from '@/store/persistence';

function documentTitled(title: string): EditorDocument {
  return { ...emptyDocument(), meta: { title } };
}

/** A store that records calls, and can be made to fail or to hang. */
function spyStore(): DocumentStore & {
  writes: EditorDocument[];
  failNext: () => void;
  hold: () => (value?: unknown) => void;
} {
  const inner = memoryStore();
  const writes: EditorDocument[] = [];
  let fail = false;
  let release: ((value?: unknown) => void) | undefined;

  return {
    writes,
    failNext: () => {
      fail = true;
    },
    hold: () => {
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      held = gate;
      return release!;
    },
    get: (key) => inner.get(key),
    put: async (key, document) => {
      if (held) {
        const gate = held;
        held = undefined;
        await gate;
      }
      if (fail) {
        fail = false;
        throw new Error('storage full');
      }
      writes.push(document);
      await inner.put(key, document);
    },
    remove: (key) => inner.remove(key),
  };
}

let held: Promise<unknown> | undefined;

describe('Autosaver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    held = undefined;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes once editing pauses', async () => {
    const store = spyStore();
    const saver = new Autosaver(store);

    saver.schedule(documentTitled('one'));
    expect(store.writes).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(store.writes).toHaveLength(1);
    expect(store.writes[0]?.meta.title).toBe('one');
  });

  it('collapses a burst of edits into a single write', async () => {
    // A drag emits a command per pointer frame. Writing on each would hammer IndexedDB
    // for no benefit, since only the last one matters.
    const store = spyStore();
    const saver = new Autosaver(store);

    for (let frame = 0; frame < 50; frame += 1) {
      saver.schedule(documentTitled(`frame ${frame}`));
      await vi.advanceTimersByTimeAsync(10);
    }
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);

    expect(store.writes).toHaveLength(1);
    expect(store.writes[0]?.meta.title).toBe('frame 49');
  });

  it('reports work as pending until the write lands', async () => {
    const store = spyStore();
    const saver = new Autosaver(store);

    expect(saver.status.pending).toBe(false);

    saver.schedule(documentTitled('one'));
    expect(saver.status.pending).toBe(true);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(saver.status.pending).toBe(false);
  });

  it('flushes immediately when asked, without waiting for the debounce', async () => {
    // A tab being closed will not wait 400ms, and that is exactly when a save matters.
    const store = spyStore();
    const saver = new Autosaver(store);

    saver.schedule(documentTitled('urgent'));
    await saver.flush();

    expect(store.writes).toHaveLength(1);
    expect(saver.status.pending).toBe(false);
  });

  it('does nothing on flush when there is nothing waiting', async () => {
    const store = spyStore();
    await new Autosaver(store).flush();
    expect(store.writes).toHaveLength(0);
  });

  it('keeps an edit that arrives while a write is in flight', async () => {
    // The race that silently loses work: clearing the queue after a slow write would
    // discard anything typed during it and report the document as saved.
    const store = spyStore();
    const saver = new Autosaver(store);

    const release = store.hold();
    saver.schedule(documentTitled('first'));
    const writing = saver.flush();

    saver.schedule(documentTitled('second'));
    release();
    await writing;

    expect(saver.status.pending).toBe(true);

    await saver.flush();
    expect(store.writes.at(-1)?.meta.title).toBe('second');
  });

  it('reports a failure without throwing, so editing continues', async () => {
    const store = spyStore();
    const saver = new Autosaver(store);

    store.failNext();
    saver.schedule(documentTitled('one'));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);

    expect(saver.status.failed).toBe(true);
    expect(saver.status.pending).toBe(true);
  });

  it('recovers on the next successful write', async () => {
    const store = spyStore();
    const saver = new Autosaver(store);

    store.failNext();
    saver.schedule(documentTitled('one'));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(saver.status.failed).toBe(true);

    saver.schedule(documentTitled('two'));
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(saver.status.failed).toBe(false);
  });

  it('stops its timer when disposed', async () => {
    const store = spyStore();
    const saver = new Autosaver(store);

    saver.schedule(documentTitled('one'));
    saver.dispose();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 4);

    expect(store.writes).toHaveLength(0);
  });
});

describe('wouldLoseWork', () => {
  it('is false once everything is saved', () => {
    // Deliberately not "has the document been edited". A prompt on every close is noise
    // people learn to dismiss, and then it no longer protects the case it exists for.
    expect(wouldLoseWork({ pending: false, failed: false })).toBe(false);
  });

  it('is true while a save is outstanding', () => {
    expect(wouldLoseWork({ pending: true, failed: false })).toBe(true);
  });

  it('is true when the last save failed', () => {
    expect(wouldLoseWork({ pending: false, failed: true })).toBe(true);
  });
});

describe('the store round-trips a document', () => {
  it('returns exactly what was put in', async () => {
    const store = memoryStore();
    const document = documentTitled('kept');

    await store.put(AUTOSAVE_KEY, document);
    expect(await store.get(AUTOSAVE_KEY)).toEqual(document);

    await store.remove(AUTOSAVE_KEY);
    expect(await store.get(AUTOSAVE_KEY)).toBeUndefined();
  });

  it('returns undefined for a key that was never written', async () => {
    expect(await memoryStore().get('nothing here')).toBeUndefined();
  });
});
