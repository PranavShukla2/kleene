/**
 * The bar every page except the editor wears.
 *
 * The editor has its own command bar, because a workbench and a document need different
 * furniture — but everything else shares this, so moving between pages feels like moving
 * around one site rather than between three of them.
 *
 * **The wordmark always goes home**, from every page including the editor. That is L5: a page
 * you can reach and not leave is the specific failure that makes a site feel broken rather
 * than unfinished, and it costs one link to avoid.
 */

import type { Route } from '@/router';

const NAV: readonly { route: Route; label: string }[] = [
  { route: 'overview', label: 'Overview' },
  { route: 'convert', label: 'Convert' },
  { route: 'examples', label: 'Examples' },
  { route: 'roadmap', label: 'Roadmap' },
];

export function SiteHeader({
  current,
  onNavigate,
  themeLabel,
  onCycleTheme,
}: {
  current: Route;
  onNavigate: (to: Route) => void;
  themeLabel: string;
  onCycleTheme: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-k-border bg-k-bg/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-6 py-3">
        <button
          type="button"
          onClick={() => {
            onNavigate('overview');
          }}
          className="flex items-baseline gap-2.5"
        >
          <span className="font-mono text-lg font-medium tracking-tight text-k-primary">
            kleene
          </span>
          <span className="hidden text-sm text-k-text-faint sm:inline">automata workbench</span>
        </button>

        <nav className="flex items-center gap-1" aria-label="Sections">
          {NAV.map((item) => (
            <button
              key={item.route}
              type="button"
              onClick={() => {
                onNavigate(item.route);
              }}
              // The current page is marked with weight and colour, not colour alone —
              // design-system §1.2.
              aria-current={current === item.route ? 'page' : undefined}
              className={`rounded-md px-2.5 py-1 text-sm transition-colors duration-(--duration-k-hover) ${
                current === item.route
                  ? 'font-medium text-k-text'
                  : 'text-k-text-muted hover:text-k-text'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onCycleTheme}
            className="rounded-md border border-k-border px-3 py-1.5 text-sm text-k-text-muted transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text"
          >
            {themeLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onNavigate('editor');
            }}
            className="rounded-md bg-k-primary px-3 py-1.5 text-sm font-medium text-white transition-colors duration-(--duration-k-hover) hover:bg-k-primary-hover"
          >
            Open the editor
          </button>
        </div>
      </div>
    </header>
  );
}

/** The footer the content pages share. */
export function SiteFooter() {
  return (
    <footer className="border-t border-k-border">
      <div className="mx-auto w-full max-w-5xl px-6 py-6 text-sm text-k-text-faint">
        Built in Rust, compiled to WebAssembly. The engine that draws these diagrams is the same
        one that checks them.
      </div>
    </footer>
  );
}
