/**
 * Installing the app (Phase 5 A4).
 *
 * The question this exists to answer is "where is the download button", asked by someone who
 * has read that the app works offline and then found nothing to click. Telling them to look in
 * their browser's address bar is a correct answer and a bad one: the control is small, unlabelled
 * in most browsers, and absent in others.
 *
 * ## Why this cannot be only `beforeinstallprompt`
 *
 * Chrome and Edge fire that event when they consider a site installable, and it can be saved
 * and replayed from a button of our own. Safari and Firefox never fire it at all — installing
 * is a menu item the page cannot reach. So a button that appears *only* when the event fired
 * leaves the majority of Safari users exactly where they started, which is the complaint.
 *
 * The hook therefore reports three states rather than two, and the button uses all of them: we
 * can install you, we cannot but here is where your browser keeps it, or you already did.
 */

import { useEffect, useState } from 'react';

/**
 * The event Chrome fires, which TypeScript's DOM library does not describe.
 *
 * Not in `lib.dom` because it is not in any standard — it is a Chromium extension that Firefox
 * and WebKit have both declined to implement. Typed here rather than cast at the use site so
 * the shape being relied on is written down once, next to the note about who supports it.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** What the offer can be doing at any moment. */
export interface Offer {
  /** Already running as an installed app, so there is nothing to offer. */
  installed: boolean;
  /** The saved prompt, when the browser has given us one. */
  prompt: BeforeInstallPromptEvent | undefined;
}

/** Something that changes the offer. */
export type OfferEvent =
  /** The browser says an install is possible, and handed over a prompt. */
  | { kind: 'offered'; prompt: BeforeInstallPromptEvent }
  /** An install finished — by our button, or from the browser's own menu. */
  | { kind: 'installed' }
  /** The prompt has been raised and answered. */
  | { kind: 'spent' };

/**
 * The offer's whole state machine, as a function.
 *
 * A reducer rather than three `setState` calls scattered through effects, because the rules
 * are about *combinations* — a spent prompt must not be re-raisable, an install arriving from
 * the browser's own menu must clear a prompt we were still holding — and combinations are what
 * gets missed when the logic is spread across the callbacks that happen to receive it.
 */
export function reduceOffer(state: Offer, event: OfferEvent): Offer {
  switch (event.kind) {
    case 'offered':
      return { ...state, prompt: event.prompt };
    // Both of these drop the prompt. A saved prompt cannot be raised twice, so keeping one
    // would leave a button that silently does nothing on the second press.
    case 'installed':
      return { installed: true, prompt: undefined };
    case 'spent':
      return { ...state, prompt: undefined };
  }
}

export interface InstallState {
  /** Already running as an installed app, so there is nothing to offer. */
  installed: boolean;
  /** The browser handed us a prompt we can raise from our own button. */
  canPrompt: boolean;
  /** Raise it. Resolves once the user has answered, either way. */
  install: () => Promise<void>;
}

/**
 * Whether this document is running in an installed window rather than a browser tab.
 *
 * Exported so it can be tested without rendering: the two signals disagree by platform, which
 * is exactly the sort of thing that is right on the machine it was written on and wrong on the
 * one that mattered.
 */
export function runningInstalled(): boolean {
  // Two checks because they disagree by platform: `display-mode` covers Chrome, Edge and
  // installed PWAs on Android, and `navigator.standalone` is the only signal iOS Safari gives.
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const ios = (navigator as { standalone?: boolean }).standalone === true;
  return standalone || ios;
}

export function useInstallPrompt(): InstallState {
  const [offer, setOffer] = useState<Offer>(() => ({
    installed: runningInstalled(),
    prompt: undefined,
  }));

  useEffect(() => {
    const onPrompt = (event: Event) => {
      // Without this the browser shows its own bar wherever it likes, and then our button and
      // its bar are two controls for one action, disagreeing about where it lives.
      event.preventDefault();
      setOffer((current) =>
        reduceOffer(current, { kind: 'offered', prompt: event as BeforeInstallPromptEvent }),
      );
    };

    const onInstalled = () => {
      setOffer((current) => reduceOffer(current, { kind: 'installed' }));
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return {
    installed: offer.installed,
    canPrompt: offer.prompt !== undefined,
    install: async () => {
      const { prompt } = offer;
      if (!prompt) return;
      await prompt.prompt();
      await prompt.userChoice;
      setOffer((current) => reduceOffer(current, { kind: 'spent' }));
    },
  };
}
