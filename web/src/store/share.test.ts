import { describe, expect, it } from 'vitest';

import { decode, encode, linkFor, LINK_LIMIT, payloadIn, SHARE_KEY } from '@/store/share';
import type { Document } from '@/model/automaton';

/** A document with something of every kind in it, so the round trip has work to do. */
const DOCUMENT = {
  version: 1,
  automaton: {
    alphabet: ['a', 'b'],
    states: [
      { id: 0, label: 'q0' },
      { id: 1, label: 'q1' },
      { id: 2, label: 'q2', accepting: true },
    ],
    start: 0,
    transitions: [
      { from: 0, to: 1, on: 'a' },
      { from: 0, to: 0, on: 'b' },
      { from: 1, to: 2 },
    ],
  },
  layout: { 0: { x: 90, y: 130 }, 1: { x: 186, y: 130 }, 2: { x: 282, y: 130 } },
  meta: { title: 'Strings ending in ab' },
} as unknown as Document;

describe('a document in a link', () => {
  it('survives the round trip unchanged', async () => {
    // Task F5. Everything else here is a detail of *how*; this is the whole promise.
    expect(await decode(await encode(DOCUMENT))).toEqual(DOCUMENT);
  });

  it('survives labels that are not ASCII', async () => {
    // ε and Σ are in every second machine this tool draws, and `btoa` throws on anything
    // outside Latin-1 — which is why the payload is encoded to bytes first.
    const greek = {
      ...DOCUMENT,
      automaton: {
        ...DOCUMENT.automaton,
        states: [{ id: 0, label: 'ε₀ → Σ' }],
        transitions: [],
        start: 0,
      },
      layout: {},
    } as unknown as Document;

    expect(await decode(await encode(greek))).toEqual(greek);
  });

  it('produces a payload safe to put in a URL', async () => {
    // `+`, `/` and `=` all survive a fragment and none of them survive being pasted through
    // a mail client, a chat app and back out again.
    expect(await encode(DOCUMENT)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('always says which path produced it', async () => {
    // Task F6. Whether compression happened depends on the runtime — and it is *not* simply
    // whether `CompressionStream` is defined: it exists under jsdom while the Blob plumbing
    // beneath it does not, so this suite takes the fallback with the API present. The marker
    // is what makes that knowable instead of silent, which is why it is asserted here and the
    // size is asserted conditionally below.
    const payload = await encode(DOCUMENT);
    expect(payload.slice(0, 1)).toMatch(/^[zu]$/);
  });

  it('is worth compressing whenever compression actually happened', async () => {
    const payload = await encode(DOCUMENT);
    const json = JSON.stringify(DOCUMENT).length;

    if (payload.startsWith('z')) {
      expect(payload.length).toBeLessThan(json);
    } else {
      // base64 is four bytes per three: larger than the JSON, and still a working link, which
      // is the entire point of having a fallback rather than refusing to share.
      expect(payload.length).toBeLessThan(json * 1.4);
    }
  });
});

describe('a link that is not one', () => {
  it('refuses an unknown marker rather than guessing', async () => {
    // A payload from a future format. Guessing would produce a machine nobody drew, which is
    // worse than an error — it looks like the link worked.
    expect(await decode('QeyJhIjoxfQ')).toBeUndefined();
  });

  it('refuses a truncated payload', async () => {
    // The commonest real failure: a mail client wrapped the URL.
    const payload = await encode(DOCUMENT);
    expect(await decode(payload.slice(0, payload.length - 8))).toBeUndefined();
  });

  it('refuses an empty one', async () => {
    expect(await decode('')).toBeUndefined();
    expect(await decode('z')).toBeUndefined();
  });

  it('refuses base64 that decodes to something that is not a document', async () => {
    expect(await decode(`u${btoa('not json at all')}`)).toBeUndefined();
  });
});

describe('the fragment', () => {
  it('finds a payload, with or without the hash', () => {
    expect(payloadIn(`#${SHARE_KEY}=abc`)).toBe('abc');
    expect(payloadIn(`${SHARE_KEY}=abc`)).toBe('abc');
  });

  it('ignores the converter’s own deep links', () => {
    // `/convert` puts a step number in the fragment. Two features sharing a fragment must not
    // read each other's values.
    expect(payloadIn('#dfa=5')).toBeUndefined();
    expect(payloadIn('')).toBeUndefined();
  });

  it('builds a link that points at the editor', () => {
    expect(linkFor('abc', 'https://example.test')).toBe(
      `https://example.test/editor#${SHARE_KEY}=abc`,
    );
  });
});

describe('the size limit', () => {
  it('is a length a URL actually survives', () => {
    // Browsers accept far more. The limit is about mail clients wrapping, chat apps
    // truncating, and PDFs splitting a link across lines.
    expect(LINK_LIMIT).toBeGreaterThan(1000);
    expect(LINK_LIMIT).toBeLessThan(32000);
  });

  it('leaves an ordinary machine far inside it', async () => {
    expect((await encode(DOCUMENT)).length).toBeLessThan(LINK_LIMIT / 4);
  });
});
