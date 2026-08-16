/**
 * Keeping work across a refresh, a crash, or a closed tab.
 *
 * There is no backend by design (roadmap §1.4), so this is the *only* safety net a user
 * gets. That raises the bar on it rather than lowering it: losing an afternoon's diagram to
 * a stray Cmd-W is the kind of thing people do not forgive a tool for, and there is no
 * server-side copy to apologise with.
 *
 * ## Why a keyed store rather than a single slot
 *
 * One slot would be enough for autosave today. A keyed store costs the same to write and is
 * what the v1.1 problem set records progress in (roadmap §9.2) — building the general shape
 * now is free, and retrofitting it later is not.
 *
 * ## Why the interface
 *
 * `DocumentStore` exists so the autosave policy can be tested without IndexedDB. The
 * interesting behaviour is *when* to save and *whether* work is at risk; that it eventually
 * reaches a browser database is I/O, and testing it through a mock database would be testing
 * the mock.
 */

import type { EditorDocument } from '@/store/document';

/** Somewhere documents can be kept. */
export interface DocumentStore {
  get(key: string): Promise<EditorDocument | undefined>;
  put(key: string, document: EditorDocument): Promise<void>;
  remove(key: string): Promise<void>;
}

/** The key the editor autosaves under. */
export const AUTOSAVE_KEY = 'autosave';

const DATABASE = 'kleene';
const STORE = 'documents';
const VERSION = 1;

/** Wrap an IndexedDB request as a promise. */
function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => {
      resolve(operation.result);
    };
    operation.onerror = () => {
      reject(operation.error ?? new Error('IndexedDB request failed'));
    };
  });
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE, VERSION);

    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains(STORE)) {
        opening.result.createObjectStore(STORE);
      }
    };
    opening.onsuccess = () => {
      resolve(opening.result);
    };
    opening.onerror = () => {
      reject(opening.error ?? new Error('Could not open IndexedDB'));
    };
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await open();
  try {
    return await request(action(database.transaction(STORE, mode).objectStore(STORE)));
  } finally {
    database.close();
  }
}

/** The real store, backed by IndexedDB. */
export function indexedDbStore(): DocumentStore {
  return {
    get: (key) =>
      transact('readonly', (store) => store.get(key) as IDBRequest<EditorDocument | undefined>),
    put: async (key, document) => {
      // Structured-cloned rather than serialized to JSON: the document is already plain
      // data, and JSON would quietly turn `undefined` fields into missing ones on the way
      // out and back, which is a difference the format cares about.
      await transact('readwrite', (store) => store.put(document, key));
    },
    remove: async (key) => {
      await transact('readwrite', (store) => store.delete(key));
    },
  };
}

/** An in-memory store, for tests and for browsers where IndexedDB is unavailable. */
export function memoryStore(): DocumentStore {
  const held = new Map<string, EditorDocument>();
  return {
    get: (key) => Promise.resolve(held.get(key)),
    put: (key, document) => {
      held.set(key, document);
      return Promise.resolve();
    },
    remove: (key) => {
      held.delete(key);
      return Promise.resolve();
    },
  };
}

/**
 * The store to use, falling back to memory when IndexedDB is unavailable.
 *
 * Private browsing modes block it outright. Losing autosave there is bad; refusing to run
 * the editor at all would be worse, so persistence degrades rather than failing.
 */
export function defaultStore(): DocumentStore {
  try {
    return typeof indexedDB === 'undefined' ? memoryStore() : indexedDbStore();
  } catch {
    return memoryStore();
  }
}
