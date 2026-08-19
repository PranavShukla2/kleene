/**
 * The footer, sized like a site rather than like a page.
 *
 * A one-line footer is right for an app and wrong for a front door. Someone who has read to
 * the bottom is deciding whether this is a real project, and the honest evidence for that is
 * a map of everything it contains — including the parts that are not built, marked as such.
 *
 * Every column here leads somewhere real. A footer link that goes nowhere is the cheapest way
 * to look unfinished, so unbuilt destinations are rendered as text with a badge rather than as
 * links that disappoint (L5, again).
 */

import { Pill } from '@/site/Badge';
import type { Route } from '@/router';

interface Item {
  label: string;
  /** Where it goes. Omitted for something that does not exist yet. */
  route?: Route;
  /** An external destination, for the two that are. */
  href?: string;
  soon?: string;
}

const COLUMNS: readonly { heading: string; items: readonly Item[] }[] = [
  {
    heading: 'Product',
    items: [
      { label: 'Editor', route: 'editor' },
      { label: 'Convert', route: 'convert' },
      { label: 'Examples', route: 'examples' },
      { label: 'Pricing', route: 'pricing' },
    ],
  },
  {
    heading: 'Learn',
    items: [
      { label: 'Concepts', route: 'learn' },
      { label: 'Docs', route: 'docs' },
      { label: 'Roadmap', route: 'roadmap' },
      { label: 'Changelog', route: 'changelog' },
      { label: 'Course kit', soon: 'phase 5' },
    ],
  },
  {
    heading: 'Build on it',
    items: [
      { label: 'CLI', soon: 'phase 4' },
      { label: 'Desktop app', soon: 'phase 5' },
      { label: 'File format', route: 'docs' },
      { label: 'Embed a diagram', soon: 'phase 5' },
    ],
  },
  {
    heading: 'Project',
    items: [
      { label: 'About', route: 'about' },
      { label: 'Source', href: 'https://github.com/PranavShukla2/kleene' },
      { label: 'Report an issue', href: 'https://github.com/PranavShukla2/kleene/issues' },
      { label: 'Licence', route: 'about' },
    ],
  },
];

export function Footer({ onNavigate }: { onNavigate: (to: Route) => void }) {
  return (
    <footer className="mt-8 border-t border-k-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <button
              type="button"
              onClick={() => {
                onNavigate('overview');
              }}
              className="k-gradient-text font-mono text-lg font-semibold tracking-tight"
            >
              kleene
            </button>
            <p className="mt-3 max-w-xs text-sm text-k-text-muted">
              An automata theory workbench that shows its working. Built in Rust, compiled to
              WebAssembly, and run entirely in your browser.
            </p>
            <p className="mt-4 font-mono text-xs text-k-text-faint">
              Free, and free of accounts. There is no server to sign into.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3 className="font-mono text-[11px] tracking-wider text-k-text-faint uppercase">
                {column.heading}
              </h3>
              <ul className="mt-3 space-y-2">
                {column.items.map((item) => (
                  <li key={item.label}>
                    <Link item={item} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-k-border pt-6 font-mono text-xs text-k-text-faint">
          <span>© {new Date().getFullYear()} Kleene</span>
          <span>Rust · WebAssembly · React</span>
          <span className="sm:ml-auto">
            The engine that draws these diagrams is the same one that checks them.
          </span>
        </div>
      </div>
    </footer>
  );
}

function Link({ item, onNavigate }: { item: Item; onNavigate: (to: Route) => void }) {
  const style =
    'text-sm text-k-text-muted transition-colors duration-(--duration-k-hover) hover:text-k-text';

  if (item.href) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer noopener" className={style}>
        {item.label} ↗
      </a>
    );
  }

  if (item.route) {
    return (
      <button
        type="button"
        onClick={() => {
          onNavigate(item.route as Route);
        }}
        className={style}
      >
        {item.label}
      </button>
    );
  }

  // Not a link. A footer link that goes nowhere is the cheapest way to look unfinished.
  //
  // Stacked rather than inline: a footer column is narrow, and a label with a badge beside it
  // wraps into two ragged lines at every width worth supporting.
  return (
    <span className="block text-sm text-k-text-faint">
      {item.label}
      {/* Wrapped rather than given `block` directly: `Pill` sets `inline-flex`, and two
          display utilities in one class list are decided by stylesheet order, not by which
          was written last. */}
      <span className="mt-1 block">
        <Pill tone="soon">soon · {item.soon}</Pill>
      </span>
    </span>
  );
}
