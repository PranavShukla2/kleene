/**
 * Putting a machine in a link (Phase 4 Track F, roadmap §2.6).
 *
 * The whole document, compressed, in the URL fragment. That is the distribution mechanism for
 * this project: a lecturer pastes a link into slides, a student pastes one into a message, and
 * neither needs an account or a server to have kept anything.
 *
 * ## Why the fragment and never a query parameter (task F2)
 *
 * **A fragment is never sent to the server.** Not by the browser, not in a `Referer` header,
 * not into an access log. So there is no privacy story to write, nothing to retain, and
 * nothing to promise about deletion — the machine simply never arrives anywhere it could be
 * kept. A query parameter would put a student's coursework in somebody's log file.
 *
 * ## The encoding, and why it announces itself
 *
 * `document → JSON → deflate-raw → base64url`, behind a one-character marker saying which
 * path produced it. The marker exists because `CompressionStream` is not everywhere (task F6),
 * so some links are compressed and some are not — and a decoder that had to *guess* would
 * eventually guess wrong on a payload that happens to look like a deflate stream.
 *
 * base64url rather than base64: `+` and `/` are legal in a fragment but arrive percent-encoded
 * from half the tools that touch a URL, and `=` padding is stripped for the same reason. The
 * link has to survive being pasted into a chat client, an email, and a PDF.
 */

import type { Document } from '@/model/automaton';

/** The fragment key. Named so it does not collide with the converter's step deep links. */
export const SHARE_KEY = 'kln';

/**
 * The fragment key a problem travels under.
 *
 * A separate key rather than a flag inside one payload, so that opening a link is a decision
 * made before anything is decompressed: `#kln=` is a machine to edit and `#p=` is a problem to
 * solve, and those open different pages. One key carrying both would mean decoding an unknown
 * blob to find out which page the visitor asked for.
 */
export const PROBLEM_KEY = 'p';

/** Marks a compressed payload. */
const DEFLATED = 'z';

/** Marks an uncompressed one, for browsers without `CompressionStream`. */
const PLAIN = 'u';

/**
 * The point past which a link stops being a link.
 *
 * Browsers accept far more, but a URL this long stops surviving the things people do to it:
 * mail clients wrap it, chat apps truncate the visible part, and pasting it into a document
 * splits it across lines. Roadmap §2.6 puts the fallback here, and above it the answer is a
 * `.kln` file rather than a link nobody can click.
 */
export const LINK_LIMIT = 8000;

/**
 * Encode any JSON value into a fragment payload.
 *
 * The teaching layer's plan predicted that carrying a problem in a link would reuse this
 * "unchanged, and if it needs changing the codec was written too narrowly". That was half
 * right, and the half is worth recording: every byte of the compression, the base64url and
 * the marker scheme was reusable exactly as written. What was too narrow was the *type* —
 * the functions said `Document` when nothing in them cared.
 */
export async function encodeValue(value: unknown): Promise<string> {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);

  const deflated = await deflate(bytes);
  return deflated ? DEFLATED + base64url(deflated) : PLAIN + base64url(bytes);
}

/** Decode a fragment payload into a value, or `undefined` if it is not one. */
export async function decodeValue<T>(payload: string): Promise<T | undefined> {
  const marker = payload.slice(0, 1);
  const body = payload.slice(1);
  if (body === '') return undefined;

  let bytes: Uint8Array;
  try {
    bytes = unbase64url(body);
  } catch {
    return undefined;
  }

  if (marker === DEFLATED) {
    const raw = await inflate(bytes);
    if (!raw) return undefined;
    bytes = raw;
  } else if (marker !== PLAIN) {
    // An unknown marker is a link from a future format, not corruption. Refusing is the only
    // honest answer: guessing would produce a machine nobody drew.
    return undefined;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return undefined;
  }
}

/** Encode a document. The shape the editor's Share button uses. */
export const encode = (document: Document): Promise<string> => encodeValue(document);

/** Decode a document. */
export const decode = (payload: string): Promise<Document | undefined> =>
  decodeValue<Document>(payload);

/** The share payload in a URL fragment, if there is one. */
export function payloadIn(hash: string): string | undefined {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get(SHARE_KEY) ?? undefined;
}

/** A full shareable URL for a payload. */
export function linkFor(payload: string, origin = window.location.origin): string {
  return `${origin}/editor#${SHARE_KEY}=${payload}`;
}

/**
 * Which problem of the set a link is, when it is one.
 *
 * A separate fragment key rather than a field on `ProblemSpec`. The spec is what a *problem*
 * is, and is frozen at version 1; a set key is a fact about this site's problem list, and a
 * lecturer's hand-made link has no business carrying one. Keeping it outside also means the
 * same solve view serves both without knowing which it has.
 */
export function problemKeyIn(hash: string): string | undefined {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get('k') ?? undefined;
}

/** The problem payload in a URL fragment, if there is one. */
export function problemIn(hash: string): string | undefined {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get(PROBLEM_KEY) ?? undefined;
}

/** A full URL for a problem someone can be handed. */
export function problemLinkFor(payload: string, origin = window.location.origin): string {
  return `${origin}/solve#${PROBLEM_KEY}=${payload}`;
}

/**
 * Compress, or `undefined` where `CompressionStream` is missing.
 *
 * `deflate-raw` rather than `gzip`: the gzip header and trailer are 18 bytes of framing this
 * payload does not need — nothing is going to sniff its type — and 18 bytes matters against a
 * budget measured in characters.
 */
async function deflate(bytes: Uint8Array): Promise<Uint8Array | undefined> {
  if (typeof CompressionStream === 'undefined') return undefined;
  try {
    return await pump(new CompressionStream('deflate-raw'), bytes);
  } catch {
    return undefined;
  }
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array | undefined> {
  if (typeof DecompressionStream === 'undefined') return undefined;
  try {
    return await pump(new DecompressionStream('deflate-raw'), bytes);
  } catch {
    // A truncated link — the commonest failure, because a mail client wrapped it.
    return undefined;
  }
}

/** Push bytes through a transform stream and collect the result. */
async function pump(
  transform: CompressionStream | DecompressionStream,
  bytes: Uint8Array,
): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform);
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

/** base64, with the two characters a URL objects to swapped and the padding dropped. */
function base64url(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unbase64url(text: string): Uint8Array {
  // The padding is restored before decoding: `atob` rejects a length that is not a multiple
  // of four, and the encoder deliberately stripped it.
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
