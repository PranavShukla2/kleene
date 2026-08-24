/**
 * The export panel (Phase 4 Track B).
 *
 * TikZ first, because roadmap §2.7 is right that it is the highest-value output here — it is
 * the only one that goes straight into the document a student is actually writing.
 *
 * ## Why the source is shown rather than downloaded
 *
 * A file lands in Downloads and then has to be found, opened and copied out of. The snippet is
 * going into a `.tex` that is already open, so the useful gesture is *copy*, and the useful
 * thing to look at is the text itself. Which also makes it checkable: someone who does not
 * trust the export can read it before pasting it.
 *
 * ## Live, per task B3
 *
 * It regenerates as the machine changes, because the promise is that what is on screen is what
 * comes out. A stale snippet quietly breaks that promise in the one way nobody checks — the
 * text still *looks* right.
 */

import { useMemo, useRef, useState } from 'react';

import { AutomatonView } from '@/canvas/AutomatonView';

import { embeddableFont } from '@/export/font';
import { download, filenameFor, toPng, toSvg } from '@/export/svg';
import { backgroundFor, inPalette } from '@/export/theme';
import { Panel } from '@/panels/Alphabet';
import type { Automaton, Point, StateId } from '@/model/automaton';
import type { Engine } from '@/wasm/loader';

/** How long the copy button stays acknowledged. Long enough to read, short enough to forget. */
const COPIED_MS = 1600;

/** PNG scales offered (task C3). 2× is the default because 1× looks soft on every laptop. */
const SCALES = [1, 2, 3] as const;

/** What the panel can produce. TikZ first, because it is the one output nothing else makes. */
type Format = 'tikz' | 'svg' | 'png' | 'dot';

export function ExportPanel({
  engine,
  automaton,
  layout,
}: {
  engine: Engine | undefined;
  automaton: Automaton;
  layout: Record<StateId, Point>;
}) {
  const [format, setFormat] = useState<Format>('tikz');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  /**
   * Light unless asked otherwise (task C4).
   *
   * Not a preference — exports go into white documents, and a dark-mode user who exports what
   * they see pastes a black rectangle into their assignment and does not notice until it is
   * printed.
   */
  const [dark, setDark] = useState(false);
  const [transparent, setTransparent] = useState(false);
  const [scale, setScale] = useState<number>(2);

  const dot = useMemo(() => {
    if (!engine || automaton.states.length === 0) return undefined;
    try {
      return engine.toDot(automaton);
    } catch {
      return undefined;
    }
  }, [engine, automaton]);

  const tikz = useMemo(() => {
    if (!engine || automaton.states.length === 0) return undefined;
    try {
      return engine.toTikz(automaton, layout);
    } catch {
      // An export that throws must not take the editor with it. The panel says nothing rather
      // than showing half a snippet, because half a snippet looks pasteable.
      return undefined;
    }
  }, [engine, automaton, layout]);

  const empty = automaton.states.length === 0;

  /**
   * A clean render of the machine, off-screen, and the thing that is actually exported.
   *
   * Scraping the editor's live canvas was the first version and it exported the *session*
   * along with the machine: the pan and zoom, and a purple ring on whichever state the input
   * tester happened to be sitting on. Stripping those from a serialized clone meant guessing
   * which attributes were chrome.
   *
   * Rendering a second copy with no selection and no active states removes the guessing.
   * `AutomatonView` also fits its own viewBox to the layout, so the crop comes free — and
   * nothing here can be affected by where the user has scrolled to.
   */
  const clean = useRef<HTMLDivElement>(null);
  const diagram = (): SVGSVGElement | null =>
    clean.current?.querySelector<SVGSVGElement>('svg') ?? null;

  const palette = dark ? 'current' : 'light';

  const acknowledge = () => {
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, COPIED_MS);
  };

  /** Serialize the diagram, forced to the export palette, with the font embedded. */
  const buildSvg = async (): Promise<string | undefined> => {
    const svg = diagram();
    if (!svg) return undefined;

    const font = await embeddableFont();
    // The palette is forced *around the read*, because every colour resolves against the
    // document root — the only way to ask what this looks like in light mode is to be in
    // light mode while asking.
    return inPalette(palette, () =>
      toSvg(svg, {
        font,
        background: transparent ? undefined : backgroundFor(palette),
      }),
    );
  };

  const run = (work: () => Promise<void>) => {
    setBusy(true);
    void work()
      .then(acknowledge, () => {
        // A failed export is not worth a dialog; the button simply does not acknowledge.
      })
      .finally(() => {
        setBusy(false);
      });
  };

  if (empty) {
    return (
      <Panel title="Export">
        <p className="text-sm text-k-text-faint">
          Draw a machine and it can leave here as LaTeX, SVG or PNG — positioned exactly as you
          have arranged it.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Export">
      {/*
        Off-screen rather than `display: none`: a hidden element has no layout, so `getBBox`
        and `getComputedStyle` return nothing and the export comes out empty.
      */}
      <div
        ref={clean}
        aria-hidden
        className="pointer-events-none fixed -left-[9999px] top-0 h-[600px] w-[900px]"
      >
        <AutomatonView
          automaton={automaton}
          layout={layout}
          title="Export"
          // No grid: it is furniture, and an assignment does not want graph paper behind the
          // diagram.
          grid={false}
          className="h-full w-full"
        />
      </div>

      <div className="flex gap-1">
        {(
          [
            ['tikz', 'LaTeX'],
            ['svg', 'SVG'],
            ['png', 'PNG'],
            ['dot', 'DOT'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={format === id}
            onClick={() => {
              setFormat(id);
            }}
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors duration-(--duration-k-hover) ${
              format === id
                ? 'border-k-primary bg-k-primary/10 text-k-primary'
                : 'border-k-border text-k-text-muted hover:border-k-border-strong hover:text-k-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {format === 'tikz' || format === 'dot' ? (
        <Source
          format={format}
          source={format === 'tikz' ? tikz : dot}
          copied={copied}
          onCopied={acknowledge}
        />
      ) : (
        <Image
          format={format}
          busy={busy}
          copied={copied}
          dark={dark}
          onDark={setDark}
          transparent={transparent}
          onTransparent={setTransparent}
          scale={scale}
          onScale={setScale}
          onDownload={() => {
            run(async () => {
              const svg = await buildSvg();
              if (!svg) throw new Error('no diagram');

              if (format === 'svg') {
                download(svg, filenameFor('automaton', 'svg'), 'image/svg+xml');
                return;
              }
              const png = await toPng(svg, {
                scale,
                background: transparent ? undefined : backgroundFor(palette),
              });
              download(png, filenameFor('automaton', 'png'), 'image/png');
            });
          }}
          onCopyImage={() => {
            run(async () => {
              const svg = await buildSvg();
              if (!svg) throw new Error('no diagram');
              const png = await toPng(svg, {
                scale,
                background: transparent ? undefined : backgroundFor(palette),
              });
              // PNG rather than SVG, because that is the only image type every clipboard
              // consumer accepts — pasting an SVG into Word or Google Docs does nothing.
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
            });
          }}
        />
      )}
    </Panel>
  );
}

/** What each text format is called, what it saves as, and the sentence under it. */
const SOURCES = {
  tikz: {
    unit: 'lines of LaTeX',
    extension: 'tex',
    mime: 'text/x-tex',
    note: 'latex',
  },
  dot: {
    unit: 'lines of DOT',
    extension: 'dot',
    mime: 'text/vnd.graphviz',
    note: 'dot',
  },
} as const;

/**
 * A text format: LaTeX or DOT.
 *
 * Shown rather than only downloaded, because both are going into something that is already
 * open — a `.tex`, or a shell pipeline. The useful gesture is copy. Downloadable as well,
 * because a file is what people expect an "export" to produce, and both of these being
 * *source* rather than an image surprises everyone once.
 */
function Source({
  format,
  source,
  copied,
  onCopied,
}: {
  format: 'tikz' | 'dot';
  source: string | undefined;
  copied: boolean;
  onCopied: () => void;
}) {
  const spec = SOURCES[format];
  if (!source) {
    return (
      <p className="mt-2 text-sm text-k-text-faint">This machine cannot be exported yet.</p>
    );
  }

  return (
    <>
      <div className="mt-2 flex items-center gap-2">
        <span className="font-mono text-[10px] text-k-text-faint">
          {source.split('\n').length} {spec.unit}
        </span>

        <button
          type="button"
          onClick={() => {
            // `writeText` rejects when the document is not focused. Acknowledging before the
            // write resolved would leave the button saying "copied" over an empty clipboard.
            void navigator.clipboard.writeText(source).then(onCopied, () => undefined);
          }}
          className={`ml-auto rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors duration-(--duration-k-hover) ${
            copied
              ? 'border-k-success/40 bg-k-success/10 text-k-success'
              : 'border-k-border text-k-text-muted hover:border-k-border-strong hover:text-k-text'
          }`}
        >
          {copied ? 'copied ✓' : 'copy'}
        </button>

        <button
          type="button"
          onClick={() => {
            download(source, filenameFor('automaton', spec.extension), spec.mime);
          }}
          className="rounded-full border border-k-border px-2.5 py-0.5 font-mono text-[11px] text-k-text-muted transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text"
        >
          .{spec.extension}
        </button>
      </div>

      {/*
        `readOnly` rather than a `<pre>`: checking one line of a snippet is a thing people do,
        and a textarea gives select-all, keyboard scrolling and find-in-page for free.
        Spellcheck off, because LaTeX is not prose and a red underline under every command
        reads as an error.
      */}
      <textarea
        readOnly
        spellCheck={false}
        value={source}
        aria-label={format === 'tikz' ? 'TikZ source' : 'DOT source'}
        className="mt-2 h-40 w-full resize-y rounded-lg border border-k-border bg-k-canvas p-2 font-mono text-[11px] leading-relaxed text-k-text-muted"
      />

      <p className="mt-2 text-[11px] leading-relaxed text-k-text-faint">
        LaTeX source, not an image — paste it into your document. Needs{' '}
        <code className="font-mono text-k-text-muted">\usepackage{'{tikz}'}</code> and{' '}
        <code className="font-mono text-k-text-muted">
          \usetikzlibrary{'{automata,positioning}'}
        </code>
        , both named in the comment at the top. For a picture instead, use SVG or PNG.
      </p>
    </>
  );
}

/** SVG and PNG share every control but the scale, so they share a component. */
function Image({
  format,
  busy,
  copied,
  dark,
  onDark,
  transparent,
  onTransparent,
  scale,
  onScale,
  onDownload,
  onCopyImage,
}: {
  format: 'svg' | 'png';
  busy: boolean;
  copied: boolean;
  dark: boolean;
  onDark: (next: boolean) => void;
  transparent: boolean;
  onTransparent: (next: boolean) => void;
  scale: number;
  onScale: (next: number) => void;
  onDownload: () => void;
  onCopyImage: () => void;
}) {
  return (
    <>
      <div className="mt-3 space-y-2">
        <Toggle
          on={!dark}
          onChange={(light) => {
            onDark(!light);
          }}
          label="light palette"
          hint="Exports go into white documents. Turn this off to keep the dark theme."
        />
        <Toggle
          on={transparent}
          onChange={onTransparent}
          label="transparent background"
          hint="No background rectangle, so the diagram sits on whatever is behind it."
        />

        {format === 'png' && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-k-text-faint">scale</span>
            {SCALES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={scale === option}
                onClick={() => {
                  onScale(option);
                }}
                className={`rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors duration-(--duration-k-hover) ${
                  scale === option
                    ? 'border-k-primary bg-k-primary/10 text-k-primary'
                    : 'border-k-border text-k-text-muted hover:border-k-border-strong'
                }`}
              >
                {option}×
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onDownload}
          className="rounded-full bg-k-primary px-3 py-1 text-xs font-medium text-white transition-opacity duration-(--duration-k-hover) disabled:opacity-50"
        >
          {busy ? 'working…' : `Download .${format}`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCopyImage}
          className={`rounded-full border px-3 py-1 text-xs transition-colors duration-(--duration-k-hover) disabled:opacity-50 ${
            copied
              ? 'border-k-success/40 bg-k-success/10 text-k-success'
              : 'border-k-border text-k-text-muted hover:border-k-border-strong hover:text-k-text'
          }`}
        >
          {copied ? 'copied ✓' : 'Copy image'}
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-k-text-faint">
        {format === 'svg'
          ? 'Vector, with the font embedded so it looks the same anywhere it is opened.'
          : 'A picture, ready to paste. Copying always copies a PNG — no clipboard accepts SVG.'}
      </p>
    </>
  );
}

function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2" title={hint}>
      <input
        type="checkbox"
        checked={on}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="mt-0.5 accent-[var(--color-k-primary)]"
      />
      <span className="text-[11px] leading-snug text-k-text-muted">{label}</span>
    </label>
  );
}
