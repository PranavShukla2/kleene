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

import { useEffect, useState } from 'react';

import { Editor } from '@/App';
import { Gallery } from '@/overview/Gallery';
import { Overview } from '@/overview/Overview';
import { Roadmap } from '@/overview/Roadmap';
import { SiteFooter, SiteHeader } from '@/overview/SiteHeader';
import { useRoute, type Route } from '@/router';
import { useTheme } from '@/theme';
import { loadEngine, type Engine } from '@/wasm/loader';

export function Root() {
  const { route, go } = useRoute();
  const { choice, cycle } = useTheme();

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
      <SiteHeader current={route} onNavigate={go} themeLabel={choice} onCycleTheme={cycle} />

      <div className="flex-1">
        <Page route={route} go={go} />
      </div>

      <SiteFooter />
    </div>
  );
}

function Page({ route, go }: { route: Route; go: (to: Route, search?: string) => void }) {
  const engine = useEngine(route === 'examples');
  const openExample = (key: string) => {
    go('editor', `?example=${encodeURIComponent(key)}`);
  };

  switch (route) {
    case 'examples':
      return <Gallery engine={engine} onOpen={openExample} />;
    case 'roadmap':
      return <Roadmap />;
    default:
      return (
        <Overview
          onOpenEditor={() => {
            go('editor');
          }}
          onOpenExample={openExample}
          onBrowseExamples={() => {
            go('examples');
          }}
        />
      );
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
