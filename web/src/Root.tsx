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
import { Missing } from '@/site/Missing';
import { Pricing } from '@/site/Pricing';
import { Roadmap } from '@/overview/Roadmap';
import { CommandPalette } from '@/site/CommandPalette';
import { Footer } from '@/site/Footer';
import { Nav } from '@/site/Nav';
import { usePaletteShortcut } from '@/site/usePaletteShortcut';
import { handOff } from '@/store/handoff';
import { useRoute, type Route } from '@/router';
import { useTheme } from '@/theme';
import { loadEngine, type Engine } from '@/wasm/loader';

export function Root() {
  const { route, go } = useRoute();
  const { choice, cycle } = useTheme();
  const still = useReducedMotion();
  const [palette, setPalette] = useState(false);

  const openPalette = useCallback(() => {
    setPalette(true);
  }, []);
  // Not in the editor. ⌘K there would compete with a canvas that already owns most of the
  // keyboard, and the editor has its own shortcut sheet behind `?`.
  usePaletteShortcut(openPalette, route !== 'editor');

  if (route === 'editor') {
    return (
      <Editor
        onHome={() => {
          go('overview');
        }}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-k-bg text-k-text">
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
            key={route}
            initial={still ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={still ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: still ? 0 : 0.14, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Page route={route} go={go} />
          </motion.div>
        </AnimatePresence>
      </div>

      <Footer onNavigate={go} />

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
        onCycleTheme={cycle}
        themeLabel={choice}
      />
    </div>
  );
}

function Page({ route, go }: { route: Route; go: (to: Route, search?: string) => void }) {
  // Both of these draw real machines, so both need the engine. The overview and the roadmap
  // still do not ask for it, which is what keeps their first paint free of a 400KB wait.
  const engine = useEngine(route === 'examples' || route === 'convert');
  const openExample = (key: string) => {
    go('editor', `?example=${encodeURIComponent(key)}`);
  };

  // The two pages that cannot render anything real without the engine say so, rather than
  // flashing an empty frame and then filling it.
  if ((route === 'convert' || route === 'examples') && !engine) {
    return (
      <Loading
        what={
          route === 'convert'
            ? 'Thompson’s construction, subset construction and minimization all run here, in your browser. Nothing you type is sent anywhere.'
            : 'Every example is drawn by the same engine that checks it, so the cards show the real machines rather than pictures of them.'
        }
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
