/**
 * What actually works, and when the rest arrives.
 *
 * The site names features Kleene does not have yet, which is fine — a plan is a reasonable
 * thing to publish. What is not fine is naming them the same way as the ones that work.
 *
 * A badge therefore reads **"Coming soon"** *and* the phase it lands in. Two words plus a
 * number, because they answer different readers: someone skimming for thirty seconds needs the
 * words, and someone deciding whether to depend on this needs the number. "Coming soon" alone
 * promises everything and dates nothing; a bare phase number is precise and meaningless to
 * anyone who has not read the roadmap.
 *
 * The corollary, written into Phase 5 Track E: a marker still standing at v1 is a bug, not a
 * roadmap.
 */

/** Whether a feature is usable now, and if not, when. */
export type Status =
  /** Working today. */
  | { kind: 'ready' }
  /** Not yet. `phase` is the milestone it lands in; `detail` says what specifically. */
  | { kind: 'planned'; phase: number; detail?: string };

export const READY: Status = { kind: 'ready' };

/** Shorthand for a feature scheduled in a later phase. */
export function planned(phase: number, detail?: string): Status {
  return detail === undefined ? { kind: 'planned', phase } : { kind: 'planned', phase, detail };
}

/** How a status reads on the page. */
export function statusLabel(status: Status): string {
  return status.kind === 'ready' ? 'available' : `phase ${String(status.phase)}`;
}

/** The two words a skimming reader needs, ahead of the number that makes them checkable. */
export function statusHeadline(status: Status): string {
  return status.kind === 'ready' ? 'Live' : 'Coming soon';
}

/** Both halves, for a badge that has room. */
export function statusBadge(status: Status): string {
  return status.kind === 'ready' ? 'Live' : `Coming soon · phase ${String(status.phase)}`;
}
