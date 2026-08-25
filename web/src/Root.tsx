/**
 * Which page the app is showing.
 *
 * The editor is deliberately unlike the others: it brings its own command bar, because a
 * workbench and a document need different furniture. Everything else shares `SiteHeader`, so
 * moving between them feels like moving around one site rather than between three.
 *
 * The theme lives here rather than in any page, because it belongs to the *window*: cycling it
 * on the overview and then opening the editor must not reset it.
 *
 * The engine is loaded here too, and only for the pages that need it. The overview must paint
 * without wasm (Phase 5 E4), so it never asks — but the gallery wants to draw the real machines
 * on its cards, so it does.
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';

import { Editor } from '@/App';
import { Convert } from '@/convert/Convert';
import { Gallery } from '@/overview/Gallery';
import { About } from '@/site/About';
import { Changelog } from '@/site/Changelog';
import { Docs } from '@/site/Docs';
import { Landing } from '@/site/Landing';
import { Learn } from '@/site/Learn';
import { Loading } from '@/site/Loading';
import { Tool } from '@/site/Tool';
import { toolAt } from '@/site/tools';
import { Missing } from '@/site/Missing';
import { Pricing } from '@/site/Pricing';
import { Roadmap } from '@/overview/Roadmap';
import { CommandPalette } from '@/site/CommandPalette';
import { Footer } from '@/site/Footer';
import { Download } from '@/site/Download';
import { Jflap } from '@/site/Jflap';
import { Nav } from '@/site/Nav';
import { usePaletteShortcut } from '@/site/usePaletteShortcut';
import { useUpdatePrompt, type UpdateState } from '@/store/updates';
import { handOff } from '@/store/handoff';
import { toolSlug, useRoute, type Location as LocationOf, type Route } from '@/router';
import { useTheme } from '@/theme';
import { loadEngine, type Engine } from '@/wasm/loader';

export function Root() {
  const { route, location, go, goPath } = useRoute();
  const { choice, cycle } = useTheme();
  const still = useReducedMotion();
  const [palette, setPalette] = useState(false);
  const update = useUpdatePrompt();

  const openPalette = useCallback(() => {
    setPalette(true);
  }, []);
  // Not in the editor. ⌘K there would compete with a canvas that already owns most of the
  // keyboard, and the editor has its own shortcut sheet behind `?`.
  usePaletteShortcut(openPalette, route !== 'editor');

  /*
    Shown above everything, on every route including the editor.

    The editor is where it matters most — that is where the unsaved work is — and it is also
    the one page that does not share this shell, so the prompt is rendered outside the branch
    rather than inside both halves of it.
  */
  const prompt = update.ready ? <UpdateBanner update={update} /> : null;

  if (route === 'editor') {
    return (
      <>
        {prompt}
        <Editor
          onHome={() => {
            go('overview');
          }}
        />
      </>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-k-bg text-k-text">
      {prompt}
      <Nav
        current={route}
        onNavigate={go}
        themeLabel={choice}
        onCycleTheme={cycle}
        onOpenPalette={openPalette}
      />

      {/*
        A crossfade with six pixels of travel, keyed on the route.
        `mode="wait"` so the outgoing page is gone before the incoming one arrives — two pages
        dissolving through each other at these opacities produces a moment of unreadable text,
        and 140ms out is short enough that nobody experiences it as a delay.

        This is what makes nine routes read as one product rather than as nine documents. It
        is also the only place on the site where motion is *purely* transitional, which is why
        it stays this quiet.
      */}
      <div className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            // Keyed on the whole location, not the route. Two tool pages are one route, and
            // keying on the route meant moving between them neither animated nor remounted —
            // the second page's content simply never arrived.
            key={location.pathname + location.search}
            initial={still ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={still ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: still ? 0 : 0.14, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Page route={route} location={location} go={go} goPath={goPath} />
          </motion.div>
        </AnimatePresence>
      </div>

      <Footer onNavigate={go} onOpenPath={goPath} />

      <CommandPalette
        open={palette}
        onClose={() => {
          setPalette(false);
        }}
        onNavigate={go}
        onOpenExample={(key) => {
          go('editor', `?example=${encodeURIComponent(key)}`);
        }}
        onConvert={(source) => {
          go('convert', `?q=${encodeURIComponent(source)}`);
        }}
        onOpenTool={goPath}
        onOpenConcept={(id) => {
          goPath(`/learn#${id}`);
        }}
        onCycleTheme={cycle}
        themeLabel={choice}
      />
    </div>
  );
}

/** The routes that cannot render anything real until WebAssembly has arrived. */
const NEEDS_ENGINE = new Set<Route>(['convert', 'examples', 'tool']);

/** What each of them is waiting for, in words the visitor can do something with. */
const WAITING_FOR: Partial<Record<Route, string>> & { convert: string } = {
  convert:
    'Thompson’s construction, subset construction and minimization all run here, in your browser. Nothing you type is sent anywhere.',
  examples:
    'Every example is drawn by the same engine that checks it, so the cards show the real machines rather than pictures of them.',
  tool: 'The conversion runs in your browser, on the same engine the rest of the site uses. Nothing you type is sent anywhere.',
};

function Page({
  route,
  location,
  go,
  goPath,
}: {
  route: Route;
  /** Passed rather than read from `window`, so a URL change is a prop change React can see. */
  location: LocationOf;
  go: (to: Route, search?: string) => void;
  goPath: (path: string) => void;
}) {
  /**
   * Which pages need the engine.
   *
   * A list rather than a condition per call site, because the two places that consume it —
   * the loading state and the page itself — have to agree, and they did not: a tool page
   * rendered the loading state forever because this condition had not been told about the
   * route while the guard below had.
   *
   * The landing page and the roadmap are still absent, which is what keeps their first paint
   * free of a wasm wait. The landing page's hero loads it *itself*, after painting.
   */
  const engine = useEngine(NEEDS_ENGINE.has(route));
  const openExample = (key: string) => {
    go('editor', `?example=${encodeURIComponent(key)}`);
  };

  // The two pages that cannot render anything real without the engine say so, rather than
  // flashing an empty frame and then filling it.
  if (NEEDS_ENGINE.has(route) && !engine) {
    return <Loading what={WAITING_FOR[route] ?? WAITING_FOR.convert} />;
  }

  if (route === 'tool') {
    const tool = toolAt(toolSlug(location.pathname));
    // An unknown slug is a wrong URL, not a reason to show a different tool. `Missing` says so
    // and offers everything else, which is what someone who mistyped one actually needs.
    if (!tool) return <Missing onNavigate={go} />;
    return (
      <Tool
        tool={tool}
        engine={engine}
        onNavigate={go}
        onOpenTool={goPath}
        onOpenInEditor={(automaton) => {
          handOff(automaton);
          go('editor');
        }}
      />
    );
  }

  switch (route) {
    case 'convert':
      return (
        <Convert
          engine={engine}
          onOpenInEditor={(automaton) => {
            handOff(automaton);
            go('editor');
          }}
        />
      );
    case 'examples':
      return <Gallery engine={engine} onOpen={openExample} />;
    case 'roadmap':
      return <Roadmap />;
    case 'pricing':
      return <Pricing onNavigate={go} />;
    case 'docs':
      return <Docs onNavigate={go} />;
    case 'changelog':
      return <Changelog onNavigate={go} />;
    case 'about':
      return <About onNavigate={go} />;
    case 'jflap':
      return <Jflap onNavigate={go} onOpenPath={goPath} />;
    case 'download':
      return <Download onNavigate={go} />;
    case 'learn':
      return (
        <Learn
          onNavigate={go}
          onOpenExample={openExample}
          onConvert={(expression) => {
            go('convert', `?q=${encodeURIComponent(expression)}`);
          }}
        />
      );
    case 'missing':
      return <Missing onNavigate={go} />;
    default:
      return <Landing onNavigate={go} onOpenExample={openExample} />;
  }
}

/**
 * Load the engine, but only when a page actually needs it.
 *
 * `wanted` rather than an unconditional load: the overview's whole performance claim is that it
 * paints before a 400KB module arrives, and a hook that fetched regardless would quietly undo
 * that the moment it was added to the shared shell.
 */
function useEngine(wanted: boolean): Engine | undefined {
  const [engine, setEngine] = useState<Engine | undefined>(undefined);

  useEffect(() => {
    if (!wanted) return;
    let live = true;
    void loadEngine().then(
      (loaded) => {
        if (live) setEngine(loaded);
      },
      () => {
        // A gallery without diagrams is still a gallery. The cards carry their language and
        // what they teach, which is most of what the page is for.
      },
    );
    return () => {
      live = false;
    };
  }, [wanted]);

  return engine;
}

/**
 * "A new version is ready."
 *
 * A strip rather than a dialog, because nothing is wrong and nothing is urgent — the app the
 * reader is using still works. It sits at the very top, above the nav, because it is about the
 * application rather than about the page.
 *
 * "Later" is a real answer and is offered first in tab order for a reason: reloading discards
 * anything unsaved, and the person best placed to know whether that matters is the one holding
 * the mouse.
 */
function UpdateBanner({ update }: { update: UpdateState }) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-k-primary/40 bg-k-primary/10 px-4 py-2 text-sm"
    >
      <span className="flex-1 text-k-text">
        A new version of Kleene is ready. Reloading discards anything you have not saved.
      </span>
      <button
        type="button"
        onClick={update.dismiss}
        className="rounded-full border border-k-border px-3 py-1 text-xs text-k-text-muted transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text"
      >
        Later
      </button>
      <button
        type="button"
        onClick={update.apply}
        className="rounded-full bg-k-primary px-3 py-1 text-xs font-medium text-white"
      >
        Reload
      </button>
    </div>
  );
}
