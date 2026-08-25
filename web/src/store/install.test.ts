/**
 * The install offer.
 *
 * Mostly about *not* offering: an app that invites you to install it when it already is, or
 * gives you a button that silently does nothing the second time, is worse than one that says
 * nothing at all.
 *
 * Tested through the reducer and the detector rather than by rendering, which is this
 * codebase's pattern — the same reason `openPanelFromStorage` exists next to `usePreferences`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { reduceOffer, runningInstalled, type Offer } from '@/store/install';

/** Only the two members the reducer moves around. */
const fakePrompt = () =>
  ({}) as Parameters<typeof reduceOffer>[1] extends { prompt: infer P } ? P : never;

const fresh: Offer = { installed: false, prompt: undefined };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the install offer', () => {
  it('offers nothing until the browser says an install is possible', () => {
    // Safari and Firefox never fire `beforeinstallprompt`, so this is their permanent state.
    // The button has to have something to say here rather than simply not existing.
    expect(fresh.prompt).toBeUndefined();
  });

  it('holds the prompt the browser hands over', () => {
    const prompt = fakePrompt();
    expect(reduceOffer(fresh, { kind: 'offered', prompt }).prompt).toBe(prompt);
  });

  it('spends the prompt once it has been raised', () => {
    // A saved prompt cannot be raised twice. Keeping it would leave a button that does
    // nothing on the second press, which reads as the app being broken.
    const offered = reduceOffer(fresh, { kind: 'offered', prompt: fakePrompt() });
    expect(reduceOffer(offered, { kind: 'spent' }).prompt).toBeUndefined();
  });

  it('stops offering once an install completes', () => {
    const offered = reduceOffer(fresh, { kind: 'offered', prompt: fakePrompt() });
    expect(reduceOffer(offered, { kind: 'installed' })).toEqual({
      installed: true,
      prompt: undefined,
    });
  });

  it('drops a prompt it was still holding when the browser installs it another way', () => {
    // `appinstalled` also fires for an install started from the browser's own menu, so the
    // offer has to clear even though our button was never pressed.
    const offered = reduceOffer(fresh, { kind: 'offered', prompt: fakePrompt() });
    expect(reduceOffer(offered, { kind: 'installed' }).prompt).toBeUndefined();
  });

  it('never un-installs', () => {
    const installed: Offer = { installed: true, prompt: undefined };
    expect(reduceOffer(installed, { kind: 'offered', prompt: fakePrompt() }).installed).toBe(
      true,
    );
  });
});

describe('detecting an app that is already installed', () => {
  const matchMedia = (matches: boolean) =>
    vi.stubGlobal(
      'matchMedia',
      vi.fn((media: string) => ({ matches, media })),
    );

  it('reads the display mode', () => {
    matchMedia(true);
    expect(runningInstalled()).toBe(true);
  });

  it('is false in an ordinary tab', () => {
    matchMedia(false);
    expect(runningInstalled()).toBe(false);
  });

  it('also believes iOS, which reports it a different way', () => {
    // The two signals disagree by platform: `display-mode` covers Chrome, Edge and Android,
    // and `navigator.standalone` is the only thing iOS Safari offers. Checking one is the
    // kind of bug that is right on the machine it was written on.
    matchMedia(false);
    vi.stubGlobal('navigator', { ...navigator, standalone: true });
    expect(runningInstalled()).toBe(true);
  });
});
