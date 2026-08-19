/**
 * `/learn` — the subject, not the product.
 *
 * The one page here that is useful to someone who never opens the tool, which is exactly why
 * it earns its place: everything else on this site is an argument for Kleene, and this is an
 * argument for nothing. The product appears only where seeing something beats reading about
 * it, and every one of those links is optional.
 *
 * ## Why the "common mistake" is on every card
 *
 * Definitions of these terms are freely available and almost identical wherever you find
 * them. What a student cannot easily find is the specific wrong belief that makes each
 * definition stop working — and those are remarkably consistent from year to year. `a*` means
 * one or more; ε is the same as ∅; an NFA is more powerful than a DFA. Naming them is the part
 * of this page that could not be got from a textbook index.
 */

import { CHAPTERS, conceptId, type Chapter, type Concept, type Demo } from '@/site/concepts';
import { Lift, Reveal, RevealGroup, RevealItem } from '@/site/motion';
import { Band, Masthead } from '@/site/page';
import type { Route } from '@/router';

export function Learn({
  onNavigate,
  onOpenExample,
  onConvert,
}: {
  onNavigate: (to: Route) => void;
  onOpenExample: (key: string) => void;
  onConvert: (expression: string) => void;
}) {
  return (
    <main>
      <Masthead
        eyebrow="Learn"
        title="The whole vocabulary, and the mistakes that come with it"
        detail="Four chapters, fifteen definitions, and — on every one — the specific wrong belief that makes it stop working. Nothing here needs the tool; everything here links to it when seeing beats reading."
      >
        <nav aria-label="Chapters" className="flex flex-wrap justify-center gap-2">
          {CHAPTERS.map((chapter) => (
            <a
              key={chapter.number}
              href={`#${chapter.number}`}
              className="rounded-full border border-k-border bg-k-surface px-3.5 py-1.5 font-mono text-xs text-k-text-muted transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text"
            >
              {chapter.number} {chapter.title}
            </a>
          ))}
        </nav>
      </Masthead>

      <Band>
        <Reveal>
          {/*
            The three-sentence version, before any of the detail. Someone arriving here is
            usually mid-course and looking for one term — but someone arriving from the front
            page has no frame at all, and three sentences is cheap insurance against losing
            them in chapter one.
          */}
          <div className="mx-auto max-w-3xl rounded-3xl border border-k-border bg-k-surface p-8">
            <h2 className="text-xl font-medium tracking-tight">
              The subject in three sentences
            </h2>
            <p className="mt-3 leading-relaxed text-k-text-muted">
              A <em>language</em> is a set of strings. Some languages can be decided by a
              machine with finitely many states and no memory beyond which state it is in, and
              those are the <em>regular</em> languages. Almost everything in this part of the
              course is a proof that two different-looking ways of describing a regular language
              — a machine and an expression — are the same thing.
            </p>
          </div>
        </Reveal>
      </Band>

      {CHAPTERS.map((chapter) => (
        <ChapterBand
          key={chapter.number}
          chapter={chapter}
          onNavigate={onNavigate}
          onOpenExample={onOpenExample}
          onConvert={onConvert}
        />
      ))}

      <Band>
        <div className="relative overflow-hidden rounded-3xl border border-k-border p-8 text-center sm:p-12">
          <div
            aria-hidden
            className="k-aurora pointer-events-none absolute inset-0 opacity-50"
          />
          <div className="relative">
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Reading about a conversion is the slow way to learn one
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-k-text-muted">
              Type an expression and watch the machine build itself — every round, with the
              reason for each move written beside it.
            </p>
            <Lift className="mt-7 inline-block">
              <button
                type="button"
                onClick={() => {
                  onNavigate('convert');
                }}
                className="k-glow rounded-full bg-k-primary px-6 py-3 font-medium text-white"
              >
                Convert a regular expression →
              </button>
            </Lift>
          </div>
        </div>
      </Band>
    </main>
  );
}

function ChapterBand({
  chapter,
  onNavigate,
  onOpenExample,
  onConvert,
}: {
  chapter: Chapter;
  onNavigate: (to: Route) => void;
  onOpenExample: (key: string) => void;
  onConvert: (expression: string) => void;
}) {
  return (
    <Band>
      {/* `scroll-mt` so the chapter link does not park the heading under the floating nav. */}
      <div id={chapter.number} className="scroll-mt-28">
        <Reveal>
          <div className="flex items-baseline gap-4 border-b border-k-border pb-4">
            <span className="font-mono text-sm text-k-text-faint tabular-nums">
              {chapter.number}
            </span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {chapter.title}
              </h2>
              <p className="mt-2 max-w-2xl text-k-text-muted">{chapter.blurb}</p>
            </div>
          </div>
        </Reveal>

        <RevealGroup className="mt-8 grid gap-4 lg:grid-cols-2">
          {chapter.concepts.map((concept) => (
            <RevealItem key={concept.term}>
              <ConceptCard
                concept={concept}
                onNavigate={onNavigate}
                onOpenExample={onOpenExample}
                onConvert={onConvert}
              />
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </Band>
  );
}

function ConceptCard({
  concept,
  onNavigate,
  onOpenExample,
  onConvert,
}: {
  concept: Concept;
  onNavigate: (to: Route) => void;
  onOpenExample: (key: string) => void;
  onConvert: (expression: string) => void;
}) {
  return (
    <article
      id={conceptId(concept.term)}
      // Below the floating nav when linked to directly, which the palette does.
      className="k-spotlight flex h-full scroll-mt-28 flex-col rounded-2xl border border-k-border bg-k-surface p-6"
    >
      <header className="flex items-baseline gap-3">
        <h3 className="text-lg font-medium tracking-tight">{concept.term}</h3>
        {concept.notation && (
          <code className="font-mono text-sm text-k-secondary">{concept.notation}</code>
        )}
      </header>

      <p className="mt-3 text-sm leading-relaxed text-k-text-muted">{concept.detail}</p>

      {/*
        The mistake, marked as its own thing rather than folded into the paragraph. It is the
        part of the card most worth skimming for, and a reader scanning for "what am I getting
        wrong" should be able to find it without reading the definition again.
      */}
      <div className="mt-4 rounded-xl border border-k-distinguishing/25 bg-k-distinguishing/[0.06] p-4">
        <p className="font-mono text-[10px] tracking-wider text-k-distinguishing uppercase">
          the usual mistake
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-k-text-muted">{concept.mistake}</p>
      </div>

      {concept.demo && (
        <div className="mt-auto pt-4">
          <DemoLink
            demo={concept.demo}
            onNavigate={onNavigate}
            onOpenExample={onOpenExample}
            onConvert={onConvert}
          />
        </div>
      )}
    </article>
  );
}

function DemoLink({
  demo,
  onNavigate,
  onOpenExample,
  onConvert,
}: {
  demo: Demo;
  onNavigate: (to: Route) => void;
  onOpenExample: (key: string) => void;
  onConvert: (expression: string) => void;
}) {
  const act = () => {
    if (demo.kind === 'convert') onConvert(demo.expression);
    else if (demo.kind === 'example') onOpenExample(demo.key);
    else onNavigate(demo.route);
  };

  return (
    <button
      type="button"
      onClick={act}
      className="font-mono text-xs text-k-primary underline decoration-dotted underline-offset-4 transition-opacity duration-(--duration-k-hover) hover:opacity-80"
    >
      {demo.label} →
    </button>
  );
}
