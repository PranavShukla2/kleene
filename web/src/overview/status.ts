/**
 * What actually works, and when the rest arrives.
 *
 * The overview names features Kleene does not have yet, which is fine — a plan is a reasonable
 * thing to publish. What is not fine is naming them the same way as the ones that work.
 *
 * So there is no "coming soon" here. A vague badge scattered across a page is a worse lie than
 * an empty page: it promises everything and dates nothing, and a visitor cannot tell which
 * half they can use today. Every unbuilt feature carries **the phase it lands in**, which is a
 * claim specific enough to be wrong — and therefore worth something.
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
