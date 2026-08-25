/**
 * Getting Kleene onto a machine.
 *
 * Three answers to one question, because "download" means different things to different
 * people and only one of them involves a file:
 *
 * 1. **Nothing.** The site is the app. This is genuinely the right answer for most people and
 *    saying so first costs nothing.
 * 2. **Install it from the browser** — same files, its own window, works offline.
 * 3. **A native build**, for someone who wants an application in their dock.
 *
 * ## Why the numbers are here
 *
 * A download size is worth stating where someone is deciding whether to download, and these are
 * measured from a published release rather than quoted — see Phase 5 B4. They are also the
 * comparison that makes the JFLAP point without needing to make it: a JRE is around 200 MB.
 *
 * Per platform, not one number for all three. The macOS app is 4.6 MB installed, and printing
 * that everywhere would have been wrong for Linux by a factor of twenty.
 *
 * ## Why the Gatekeeper warning is on the page and not in a FAQ
 *
 * The builds are unsigned. A certificate costs money annually and that decision is deferred,
 * which is a legitimate choice for v1 — but only if it is a choice rather than a surprise. A
 * user who downloads an app, is told by their operating system that it may be malware, and
 * finds no acknowledgement of that on the page they came from, has learned something true
 * about how carefully the project treats them.
 */

import { Pill } from '@/site/Badge';
import { Lift, Reveal, RevealGroup, RevealItem } from '@/site/motion';
import { Band, BandHeading, Masthead } from '@/site/page';
import { InstallButton } from '@/editor/InstallButton';
import type { Route } from '@/router';

const RELEASES = 'https://github.com/PranavShukla2/kleene/releases/latest';

interface Build {
  platform: string;
  detail: string;
  /** What the file is called, so it is recognisable in a downloads folder. */
  file: string;
  /** The operating system's reaction to an unsigned application, in plain words. */
  warning?: string;
}

/*
  Sizes are the real ones, taken from a published release rather than from the app bundle's
  size on disk.

  The macOS app measures 4.6 MB installed and it was tempting to print that figure everywhere.
  It is wrong for two of these three: the Linux AppImage is 81 MB, because an AppImage carries
  its own copy of webkit2gtk rather than using the system's. Someone who read "4.6 MB" and
  downloaded an 81 MB file would be right to distrust the next number this project prints.
*/
const BUILDS: readonly Build[] = [
  {
    platform: 'macOS',
    detail: 'Apple silicon. 3.8 MB to download, 4.6 MB installed.',
    file: 'Kleene_0.1.0_aarch64.dmg',
    warning:
      'macOS will say it cannot check the app for malicious software. Right-click the app and choose Open, then Open again — the second dialog has the button the first one hides.',
  },
  {
    platform: 'Windows',
    detail: 'x86-64. 3.1 MB as an installer, or 3.8 MB as an .msi.',
    file: 'Kleene_0.1.0_x64-setup.exe',
    warning:
      'SmartScreen will show a blue "Windows protected your PC" screen. More info → Run anyway.',
  },
  {
    platform: 'Linux',
    // The .deb first, and the size difference stated: an AppImage carries its own webkit2gtk
    // instead of using the system's, which is the entire 78 MB.
    detail: 'x86-64. 3.7 MB as a .deb, or 81 MB as an AppImage that bundles its own webkit.',
    file: 'Kleene_0.1.0_amd64.deb',
    warning:
      'An AppImage needs the executable bit — chmod +x before running it. Prefer the .deb if your distribution takes one; it is twenty times smaller because it uses the webkit already on your machine.',
  },
];

export function Download({ onNavigate }: { onNavigate: (to: Route) => void }) {
  return (
    <main>
      <Masthead
        eyebrow="Download"
        title="You almost certainly do not need to."
        detail="Kleene runs in the browser you are already using, and keeps working with the network off once you have opened it once. There is a native build for people who would rather have an application — but the site is not a demo of it, it is the same program."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Lift>
            <button
              type="button"
              onClick={() => {
                onNavigate('editor');
              }}
              className="k-glow rounded-full bg-k-primary px-5 py-3 font-medium text-white"
            >
              Just open the editor →
            </button>
          </Lift>
        </div>
      </Masthead>

      <Band>
        <BandHeading
          title="Keep it, without downloading anything"
          detail="Your browser can install this: it gets its own window with no address bar, its own icon, and it works offline. Same engine, same files, nothing to update by hand."
        />
        <Reveal>
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-k-border bg-k-surface p-6">
            <p className="max-w-xl text-sm leading-relaxed text-k-text-muted">
              In Chrome and Edge this installs straight away. In Safari and Firefox it shows
              where that browser keeps the option, because a page cannot reach it.
            </p>
            <div className="ml-auto">
              <InstallButton />
            </div>
          </div>
        </Reveal>
      </Band>

      <Band>
        <BandHeading
          title="Or the native build"
          detail="Around 4 MB on macOS and Windows — measured, not estimated. For comparison, running JFLAP means installing a Java runtime, which is around two hundred."
        />

        <RevealGroup className="mt-8 grid gap-4 sm:grid-cols-3">
          {BUILDS.map((build) => (
            <RevealItem
              key={build.platform}
              className="flex flex-col rounded-2xl border border-k-border bg-k-surface p-5"
            >
              <div className="flex items-baseline gap-2">
                <h3 className="font-medium tracking-tight">{build.platform}</h3>
                <Pill tone="soon">unsigned</Pill>
              </div>
              <p className="mt-2 text-sm text-k-text-muted">{build.detail}</p>
              <p className="mt-3 font-mono text-[11px] break-all text-k-text-faint">
                {build.file}
              </p>
              {build.warning && (
                <p className="mt-4 border-t border-k-border pt-3 text-xs leading-relaxed text-k-text-faint">
                  {build.warning}
                </p>
              )}
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Lift>
              <a
                href={RELEASES}
                target="_blank"
                rel="noreferrer noopener"
                className="k-glow inline-block rounded-full bg-k-primary px-5 py-3 font-medium text-white"
              >
                Downloads on GitHub ↗
              </a>
            </Lift>
            <p className="max-w-lg text-sm text-k-text-muted">
              Every build is produced by the release workflow from a tagged commit, so what you
              download is what the repository says it is.
            </p>
          </div>
        </Reveal>
      </Band>

      <Band>
        <Reveal>
          <div className="rounded-3xl border border-k-border p-8 sm:p-12">
            <h2 className="text-2xl font-semibold tracking-tight">
              Why the builds are unsigned
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-k-text-muted">
              Signing certificates cost money every year, and this project has no revenue by
              design. So the builds are unsigned, and both macOS and Windows will warn you about
              that — the instructions above are how to get past it.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-k-text-faint">
              That warning is your operating system saying it cannot verify who made the file,
              which is a fair thing for it to say. If you would rather not click through it, the
              browser version is the same program and needs no such decision.
            </p>
          </div>
        </Reveal>
      </Band>

      <Band>
        <Reveal>
          <div className="rounded-3xl border border-k-border bg-k-surface p-8">
            <h2 className="text-xl font-semibold tracking-tight">How updates work</h2>
            <dl className="mt-5 grid gap-5 sm:grid-cols-3">
              <div>
                <dt className="text-sm font-medium">In a browser tab</dt>
                <dd className="mt-1 text-sm leading-relaxed text-k-text-muted">
                  Automatically. A new version is fetched in the background and the app asks
                  before switching to it, so a reload never lands under a half-drawn machine.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium">Installed from the browser</dt>
                <dd className="mt-1 text-sm leading-relaxed text-k-text-muted">
                  The same way. An installed web app is the same files with a different window,
                  so it updates exactly as the tab does.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium">The native build</dt>
                <dd className="mt-1 text-sm leading-relaxed text-k-text-muted">
                  It checks for a new release on launch and offers to install it. The
                  application carries its own copy of the app, so unlike the two above it has to
                  replace itself rather than re-fetch a page.
                </dd>
              </div>
            </dl>
          </div>
        </Reveal>
      </Band>
    </main>
  );
}
