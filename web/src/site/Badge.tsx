/**
 * The badge that tells you whether a thing works yet.
 *
 * One component, used everywhere a feature is named, because the moment two places invent
 * their own way of saying "not yet" is the moment a visitor stops trusting either of them.
 *
 * It always carries both halves — the words and the phase — for the reason in `status.ts`:
 * "Coming soon" promises everything and dates nothing, and a bare phase number means nothing
 * to someone who has not read the roadmap.
 */

import { statusBadge, type Status } from '@/overview/status';

export function StatusBadge({
  status,
  className = '',
}: {
  status: Status;
  className?: string;
}) {
  const live = status.kind === 'ready';

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-wide whitespace-nowrap ${
        live
          ? 'border-k-success/30 bg-k-success/10 text-k-success'
          : 'border-k-border-strong bg-k-surface text-k-text-faint'
      } ${className}`}
    >
      {/*
        A dot as well as a colour. Design-system §1.2 — colour is never the only channel, and
        this badge is the single most repeated status signal on the site.
      */}
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          live ? 'bg-k-success' : 'border border-k-border-strong bg-transparent'
        }`}
      />
      {statusBadge(status)}
    </span>
  );
}

/**
 * A pill for something that is not a feature — a page section, a nav item, a card.
 *
 * Takes its own words rather than a `Status`, for the places where the thing being marked has
 * no phase because it is not on the roadmap at all.
 */
export function Pill({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'brand' | 'soon';
  className?: string;
}) {
  const tones = {
    neutral: 'border-k-border bg-k-surface text-k-text-muted',
    brand: 'border-k-primary/30 bg-k-primary/10 text-k-primary',
    soon: 'border-k-border-strong bg-k-surface text-k-text-faint',
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-wide whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
