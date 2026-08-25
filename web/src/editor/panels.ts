/**
 * The editor's panels, declared once.
 *
 * Named `panels.ts`, not `dock.ts`, and that is not a preference. `Dock.tsx` and `dock.ts` in
 * one directory differ only in case, which macOS resolves and CI does not — and TypeScript
 * reports the collision as an unrelated "already included file name" error while silently
 * dropping one of them from the program. This project has hit it three times before
 * (`Examples`, `Roadmap`, `Docs`); the rule is that a data file never shares a name with its
 * component.
 *
 * The editor used to show seven panels at the same time, stacked in one 288px column that was
 * always on screen. Everything in it was worth having and none of it was worth having *at
 * once*: the canvas — the thing the page is for — got whatever width was left, and a
 * transition table with six symbols was rendered in a column narrower than the table.
 *
 * So: one panel at a time, opened from a rail, with the canvas keeping the rest.
 *
 * ## Where a panel opens is a property of its shape
 *
 * A transition table is *wide*. So is a tape with a string being read across it. Rendering
 * either in a side column means wrapping, which for a table means it stops looking like a
 * table. Both of those open along the bottom, across the full width of the canvas.
 *
 * A property list, a 5-tuple and a set of export buttons are *tall and narrow*, and reading
 * one alongside the diagram it describes is the point. Those open at the side.
 *
 * Declaring this per panel rather than deciding it per render is what stops the two kinds
 * drifting into one compromise size that suits neither.
 */

/** Every panel the editor can show. */
export type PanelId = 'selection' | 'table' | 'test' | 'define' | 'export';

/** Which edge a panel comes from. */
export type Edge = 'side' | 'bottom';

export interface PanelSpec {
  id: PanelId;
  /** The rail's label, and the panel's accessible name. */
  label: string;
  /** A word or two on what it is for, shown on hover and to screen readers. */
  hint: string;
  edge: Edge;
  /** The rail's glyph. Text, not an icon font — see the note in `Dock.tsx`. */
  glyph: string;
}

/**
 * The rail's order, top to bottom.
 *
 * Roughly the order a machine is worked on: see what is selected, read it as a table, run a
 * string through it, check the formal definition, then get it out. Not alphabetical, and not
 * grouped by which edge they open from — the rail is a list of things to do, and someone
 * looking for the transition table is not thinking about which edge it uses.
 */
export const PANELS: readonly PanelSpec[] = [
  {
    id: 'selection',
    label: 'Selection',
    hint: 'What is selected, and what to do with it',
    edge: 'side',
    glyph: '◎',
  },
  {
    id: 'table',
    label: 'Table',
    hint: 'The transition table, editable',
    edge: 'bottom',
    glyph: 'δ',
  },
  {
    id: 'test',
    label: 'Run',
    hint: 'Run a string and watch it being read',
    edge: 'bottom',
    glyph: '▶',
  },
  {
    id: 'define',
    label: 'Define',
    hint: 'The formal 5-tuple and the alphabet',
    edge: 'side',
    glyph: 'M',
  },
  {
    id: 'export',
    label: 'Export',
    hint: 'LaTeX, pictures, and a share link',
    edge: 'side',
    glyph: '↗',
  },
];

/** Look one up. */
export function panelSpec(id: PanelId): PanelSpec {
  const found = PANELS.find((panel) => panel.id === id);
  // Unreachable through the type, and cheap insurance against a stored preference naming a
  // panel that has since been renamed.
  if (!found) throw new Error(`unknown panel: ${id}`);
  return found;
}

/** Whether a string names a panel — for validating what came out of storage. */
export function isPanelId(value: unknown): value is PanelId {
  return typeof value === 'string' && PANELS.some((panel) => panel.id === value);
}
