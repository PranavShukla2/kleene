/**
 * A latch on the classroom while it is being built.
 *
 * ## This is not security, and must never be mistaken for it
 *
 * The check runs in the visitor's own browser, so anybody who opens the developer tools can
 * walk straight past it. Every client-side gate has that property and no amount of care here
 * changes it — the code doing the checking is code the visitor already has.
 *
 * What it *is*: a way to keep unfinished work out of the way of someone who was handed the
 * link and is having a look around. That is the actual requirement — a professor following a
 * link should meet a "coming soon" tag rather than a half-built classroom — and for that a
 * latch is exactly right and a login would be absurd.
 *
 * **Nothing behind this gate may ever be something it would matter to leak.** The moment the
 * classroom holds a real person's data it is behind Google sign-in and a server that checks a
 * session, not behind this.
 *
 * ## Why a hash rather than the digits
 *
 * `if (pin === '9696')` puts the answer in the bundle, where searching for "9696" finds it in
 * seconds. A SHA-256 comparison means the bundle holds a hash instead. That is obfuscation, not
 * protection: it raises the effort from "search the file" to "read twenty lines", and it is
 * worth the twenty lines only because it costs nothing.
 */

const UNLOCKED_KEY = 'kleene.classroom.unlocked';

/** SHA-256 of the development PIN. See the note above: this is a latch, not a lock. */
const PIN_HASH = 'e18fe13db69f094da76d1ba802042e793327b339b9d8626db18ec4120f2edaf3';

/** Whether this browser has been let in before. */
export function unlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCKED_KEY) === 'yes';
  } catch {
    // Blocked storage. Locked is the safe answer, and re-entering four digits is a small cost
    // next to showing unfinished work to the wrong person.
    return false;
  }
}

/**
 * Try a PIN. Resolves to whether it was right.
 *
 * Asynchronous because `crypto.subtle` is — and using the platform's digest rather than a
 * hand-rolled one keeps this to a comparison of two strings.
 */
export async function tryPin(pin: string): Promise<boolean> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin.trim()));
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  if (hex !== PIN_HASH) return false;

  try {
    localStorage.setItem(UNLOCKED_KEY, 'yes');
  } catch {
    // Unlocked for this sitting even if it cannot be remembered.
  }
  return true;
}

/** Lock it again — for checking what a visitor sees. */
export function lock(): void {
  try {
    localStorage.removeItem(UNLOCKED_KEY);
  } catch {
    // Nothing to do; the flag was never written.
  }
}
