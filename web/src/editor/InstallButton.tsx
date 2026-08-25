/**
 * "Where is the download button."
 *
 * Asked by someone who read that this works offline, went looking for a way to keep it, and
 * found nothing to click. The honest answer has two halves and both have to be on screen:
 * there is no separate desktop application to download, and the thing that replaces it — an
 * installed window with no browser furniture, working offline — is real and one press away.
 *
 * Chrome and Edge hand us a prompt we can raise ourselves, so there the button installs.
 * Safari and Firefox never do; installing there is a menu item a page cannot reach, so the
 * button explains where that menu is instead of vanishing and leaving the question standing.
 * Vanishing is what the browser's own unlabelled address-bar icon already does.
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';

import { useInstallPrompt } from '@/store/install';

export function InstallButton() {
  const { installed, canPrompt, install } = useInstallPrompt();
  const [showing, setShowing] = useState(false);
  const still = useReducedMotion();

  // Nothing to offer someone who is already reading this in an installed window.
  if (installed) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (canPrompt) void install();
          else setShowing(true);
        }}
        title="Keep Kleene on this machine and use it offline"
        className="rounded-full border border-k-border px-3 py-1 text-sm text-k-text-muted transition-colors duration-(--duration-k-hover) hover:border-k-primary/50 hover:text-k-text"
      >
        Install
      </button>

      {/*
        Rendered into `body`, not where it sits in the tree.

        This button lives in the command bar, and the command bar has `backdrop-blur`. A
        `backdrop-filter` makes an element a containing block for `position: fixed`
        descendants — so `inset-0` resolved against a 44px header, and the dialog appeared
        clipped to the top of the screen with its heading cut in half. Nothing about the CSS
        looked wrong; the ancestor three levels up was the cause.
      */}
      {createPortal(
        <AnimatePresence>
          {showing && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-8"
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={still ? undefined : { opacity: 0 }}
              transition={{ duration: 0.14 }}
            >
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setShowing(false);
                }}
                className="absolute inset-0 bg-k-bg/75 backdrop-blur-sm"
              />

              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Installing Kleene"
                initial={still ? false : { opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={still ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
                /* Bounded and scrollable. Three browsers' worth of instructions is taller
                   than a laptop's spare vertical space, and a dialog whose heading is off the
                   top of the screen cannot be read at all. */
                className="relative max-h-full w-full max-w-md overflow-y-auto rounded-2xl border border-k-border-strong bg-k-surface-raised p-6 shadow-2xl"
              >
                <h2 className="text-lg font-semibold tracking-tight">Installing Kleene</h2>
                <p className="mt-2 text-sm leading-relaxed text-k-text-muted">
                  There is no separate application to download — this <em>is</em> the app. Your
                  browser can keep it: it opens in its own window, without browser furniture,
                  and works with the network off.
                </p>

                <dl className="mt-5 space-y-3 text-sm">
                  <div>
                    <dt className="font-medium">Safari</dt>
                    <dd className="text-k-text-muted">
                      File → Add to Dock. On iPhone or iPad, Share → Add to Home Screen.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium">Chrome, Edge, Arc</dt>
                    <dd className="text-k-text-muted">
                      The install icon at the right of the address bar, or the ⋮ menu → Cast,
                      save and share → Install.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium">Firefox</dt>
                    <dd className="text-k-text-muted">
                      Desktop Firefox does not install web apps. Everything still works in the
                      tab, offline included, once you have opened it once.
                    </dd>
                  </div>
                </dl>

                <p className="mt-5 text-xs leading-relaxed text-k-text-faint">
                  A native desktop build is planned and not written yet. When it exists it will
                  run the same engine as this — the difference is the window, not the machine.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setShowing(false);
                  }}
                  className="mt-5 w-full rounded-full bg-k-primary px-4 py-2 text-sm font-medium text-white"
                >
                  Got it
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
