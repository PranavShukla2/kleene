/**
 * The CLI and the browser agree on what a problem link looks like.
 *
 * There are two implementations of this format and there have to be: the web app encodes with
 * `CompressionStream` and base64url in TypeScript, and `kleene problem` writes base64url in
 * Rust with no compressor at all. A lecturer generates links from a shell script and a student
 * opens them in a browser, so the two never meet at runtime — which is exactly why they can
 * drift without anyone noticing until a link fails to open in front of a class.
 *
 * The payload below was printed by the real CLI. If the Rust encoder changes and this one does
 * not, this test fails; if the reader changes, it fails too. That is the whole point of pasting
 * a literal rather than generating one here.
 */

import { describe, expect, it } from 'vitest';

import { decodeValue } from '@/store/share';

/** Emitted by: kleene problem --prompt "An even number of a's." --target "(b + ab*a)*" --budget 2 */
const FROM_THE_CLI =
  'ueyJ2ZXJzaW9uIjoxLCJwcm9tcHQiOiJBbiBldmVuIG51bWJlciBvZiBhJ3MuIiwidGFyZ2V0IjoiKGIgKyBhYiphKSoiLCJidWRnZXQiOjJ9';

describe('a problem link written by the CLI', () => {
  it('opens in the browser, with every field intact', async () => {
    const spec = await decodeValue<{
      version: number;
      prompt: string;
      target: string;
      budget?: number;
    }>(FROM_THE_CLI);

    expect(spec?.version).toBe(1);
    expect(spec?.prompt).toBe("An even number of a's.");
    expect(spec?.target).toBe('(b + ab*a)*');
    expect(spec?.budget).toBe(2);
  });

  it('uses the uncompressed marker, which is why the CLI needs no compressor', async () => {
    expect(FROM_THE_CLI.startsWith('u')).toBe(true);
    await expect(decodeValue(FROM_THE_CLI)).resolves.toBeDefined();
  });
});
