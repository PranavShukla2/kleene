/**
 * The site's one spring.
 *
 * Its own module rather than a constant beside the components, so that a file exporting
 * components exports only components — which is what keeps fast refresh working on the pages
 * being edited most.
 *
 * Tuned for a marketing surface, and deliberately not shared with the canvas: this overshoots
 * slightly, and on a diagram an overshoot implies a correction the algorithm did not make
 * (design-system §1.3).
 */
export const SPRING = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 } as const;

/** How far a revealing element travels. Small: the point is the timing, not the distance. */
export const TRAVEL = 24;
