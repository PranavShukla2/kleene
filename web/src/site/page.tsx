/**
 * The furniture the content pages share.
 *
 * Pricing, docs, changelog and about are all the same shape: an aurora-lit masthead, then
 * sections. Sharing it is not only less code — it is what stops four pages that were written
 * on four different days from having four different ideas about how big a heading is.
 */

import { Reveal } from '@/site/motion';

/** The top of a content page: eyebrow, title, one paragraph, and light behind it. */
export function Masthead({
  eyebrow,
  title,
  detail,
  children,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  /** Anything that belongs beside the paragraph — a badge row, a call to action. */
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="k-aurora pointer-events-none absolute inset-x-0 -top-32 h-[28rem] opacity-70"
      />
      <div aria-hidden className="k-grid-fade pointer-events-none absolute inset-0" />

      <div className="relative mx-auto w-full max-w-4xl px-6 pt-20 pb-12 text-center lg:pt-28">
        <Reveal>
          <span className="font-mono text-xs tracking-wider text-k-primary uppercase">
            {eyebrow}
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-k-text-muted">
            {detail}
          </p>
          {children && <div className="mt-8">{children}</div>}
        </Reveal>
      </div>
    </section>
  );
}

/** A band of content on a page that already has a masthead. */
export function Band({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto w-full max-w-6xl px-6 py-12 sm:py-16 ${className}`}>
      {children}
    </section>
  );
}

/** A section heading inside a band. */
export function BandHeading({ title, detail }: { title: string; detail?: string }) {
  return (
    <Reveal>
      <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h2>
      {detail && <p className="mt-3 max-w-2xl leading-relaxed text-k-text-muted">{detail}</p>}
    </Reveal>
  );
}
