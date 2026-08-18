/**
 * Every keyboard shortcut, declared once.
 *
 * This table is both the binding and the documentation. The handler dispatches from it and the
 * `?` sheet (D9) renders from it, which means a shortcut cannot exist without appearing in the
 * help, and the help cannot describe a shortcut that does not work. Shortcut sheets drift out
 * of date in almost every application that has one, and the reason is always that they are a
 * second list maintained by hand.
 *
 * ## Matching letters by key and everything else by code
 *
 * Letters are matched on `event.key`, so a shortcut follows the user's layout: `Mod+Z` is
 * wherever their keyboard says Z is, not wherever a US keyboard would put it.
 *
 * Everything else is matched on `event.code`, because `key` is what the keypress *produces*
 * and modifiers change that. `Shift+1` reports `key: '!'` on a US layout and something else
 * again elsewhere, so a table written against `key` would silently fail to bind exactly the
 * shortcuts that use shift. `code` reports `Digit1` regardless.
 *
 * The split is deliberate and worth keeping. Unifying on `key` breaks shifted shortcuts;
 * unifying on `code` makes letter shortcuts land on physical positions, so `Mod+Z` on AZERTY
 * would be under the key marked W.
 */

/** What a shortcut does. The editor maps these to actions. */
export type ShortcutId =
  | 'undo'
  | 'redo'
  | 'delete'
  | 'edit'
  | 'setStart'
  | 'focusNext'
  | 'focusPrev'
  | 'selectAll'
  | 'deselect'
  | 'fit'
  | 'resetZoom'
  | 'zoomIn'
  | 'zoomOut'
  | 'togglePanel'
  | 'nudgeUp'
  | 'nudgeDown'
  | 'nudgeLeft'
  | 'nudgeRight'
  | 'nudgeUpFar'
  | 'nudgeDownFar'
  | 'nudgeLeftFar'
  | 'nudgeRightFar'
  | 'help';

/** Headings in the shortcut sheet, in the order they are shown. */
export const GROUPS = ['Editing', 'Selection', 'View', 'Help'] as const;
export type Group = (typeof GROUPS)[number];

/** A key combination, written as `Mod+Shift+KeyZ` or `ArrowUp`. */
export interface Shortcut {
  id: ShortcutId;
  /** The canonical chord, and the one the help sheet shows. */
  chord: string;
  /** Chords that also fire it but are not advertised. */
  aliases?: string[];
  /** Imperative, as it reads in the help sheet: "Undo", "Fit to content". */
  label: string;
  group: Group;
  /**
   * Groups this row with the ones sharing the id, in the sheet only.
   *
   * Four arrow keys are one shortcut with four directions, and listing them separately turns
   * the sheet into a wall of near-identical rows — which is how a reference stops being read.
   * Binding is unaffected: each direction is still its own shortcut with its own handler.
   */
  family?: string;
  /**
   * What the sheet shows instead of the chord, for the first member of a family.
   *
   * The alternative is joining four formatted chords, which is accurate and unreadable.
   */
  display?: string;
  /**
   * Where this shortcut listens.
   *
   * `canvas` means it only fires while the canvas itself has focus, and it is for keys the
   * page as a whole must keep. `Tab` is the case: taking it globally would break moving
   * between the page's own controls, which is how anyone navigating by keyboard reaches the
   * canvas in the first place. Inside a focused canvas it means something else entirely, and
   * that is exactly the bargain a focusable widget makes.
   */
  scope?: 'canvas';
  /**
   * Whether it fires while a text field has focus.
   *
   * Almost nothing should. Someone renaming a state expects `Backspace` to delete a
   * character, not the state they are naming — which is the kind of bug that destroys work
   * and gets reported as "it randomly deleted things".
   */
  whileTyping?: boolean;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { id: 'undo', chord: 'Mod+KeyZ', label: 'Undo', group: 'Editing' },
  {
    id: 'redo',
    chord: 'Mod+Shift+KeyZ',
    // Ctrl+Y is the Windows convention and costs one line to accept.
    aliases: ['Mod+KeyY'],
    label: 'Redo',
    group: 'Editing',
  },
  {
    id: 'delete',
    chord: 'Backspace',
    aliases: ['Delete'],
    label: 'Delete selection',
    group: 'Editing',
  },
  { id: 'edit', chord: 'Enter', label: 'Rename selected state', group: 'Editing' },
  // A bare letter, which is safe because every shortcut stands down inside a text field.
  { id: 'setStart', chord: 'KeyS', label: 'Make selected the start state', group: 'Editing' },
  {
    id: 'nudgeUp',
    chord: 'ArrowUp',
    label: 'Nudge selection',
    group: 'Editing',
    family: 'nudge',
    display: '\u2190\u2191\u2193\u2192',
  },
  {
    id: 'nudgeDown',
    chord: 'ArrowDown',
    label: 'Nudge down',
    group: 'Editing',
    family: 'nudge',
  },
  {
    id: 'nudgeLeft',
    chord: 'ArrowLeft',
    label: 'Nudge left',
    group: 'Editing',
    family: 'nudge',
  },
  {
    id: 'nudgeRight',
    chord: 'ArrowRight',
    label: 'Nudge right',
    group: 'Editing',
    family: 'nudge',
  },
  {
    id: 'nudgeUpFar',
    chord: 'Shift+ArrowUp',
    label: 'Nudge by a grid square',
    group: 'Editing',
    family: 'nudge-far',
    display: '\u21e7\u2190\u2191\u2193\u2192',
  },
  {
    id: 'nudgeDownFar',
    chord: 'Shift+ArrowDown',
    label: 'Nudge further down',
    group: 'Editing',
    family: 'nudge-far',
  },
  {
    id: 'nudgeLeftFar',
    chord: 'Shift+ArrowLeft',
    label: 'Nudge further left',
    group: 'Editing',
    family: 'nudge-far',
  },
  {
    id: 'nudgeRightFar',
    chord: 'Shift+ArrowRight',
    label: 'Nudge further right',
    group: 'Editing',
    family: 'nudge-far',
  },

  {
    id: 'focusNext',
    chord: 'Tab',
    label: 'Next state',
    group: 'Selection',
    scope: 'canvas',
    family: 'cycle',
    display: '\u21e5 / \u21e7\u21e5',
  },
  {
    id: 'focusPrev',
    chord: 'Shift+Tab',
    label: 'Previous state',
    group: 'Selection',
    scope: 'canvas',
    family: 'cycle',
  },
  { id: 'selectAll', chord: 'Mod+KeyA', label: 'Select all states', group: 'Selection' },
  { id: 'deselect', chord: 'Escape', label: 'Deselect', group: 'Selection' },

  { id: 'fit', chord: 'Shift+Digit1', label: 'Fit to content', group: 'View' },
  { id: 'resetZoom', chord: 'Shift+Digit0', label: 'Zoom to 100%', group: 'View' },
  { id: 'zoomIn', chord: 'Mod+Equal', label: 'Zoom in', group: 'View' },
  { id: 'zoomOut', chord: 'Mod+Minus', label: 'Zoom out', group: 'View' },
  {
    id: 'togglePanel',
    chord: 'Mod+Backslash',
    label: 'Show or hide the panels',
    group: 'View',
  },

  { id: 'help', chord: 'Shift+Slash', label: 'Keyboard shortcuts', group: 'Help' },
];

/** The chords that are not shown in the sheet but are still bound. */
const chordsOf = (shortcut: Shortcut): string[] => [
  shortcut.chord,
  ...(shortcut.aliases ?? []),
];

interface Chord {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  /** `KeyZ` for a letter, or a `code` such as `ArrowUp`. */
  key: string;
}

function parseChord(chord: string): Chord {
  const parts = chord.split('+');
  return {
    mod: parts.includes('Mod'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
    key: parts[parts.length - 1] ?? '',
  };
}

/** Whether a key event is this chord. */
export function matchesChord(chord: string, event: KeyboardEvent, mac = isMac()): boolean {
  const want = parseChord(chord);

  // Mod is Cmd on a Mac and Ctrl everywhere else, and crucially the *other* one must be
  // absent — otherwise Ctrl+Cmd+Z on a Mac would fire undo, and a chord bound to Ctrl
  // elsewhere would fire on a Mac's Cmd.
  const mod = mac ? event.metaKey : event.ctrlKey;
  const otherMod = mac ? event.ctrlKey : event.metaKey;
  if (want.mod !== mod || otherMod) return false;
  if (want.shift !== event.shiftKey) return false;
  if (want.alt !== event.altKey) return false;

  // See the module note: letters follow the layout, everything else follows the physical key.
  if (want.key.startsWith('Key')) {
    return event.key.toLowerCase() === want.key.slice(3).toLowerCase();
  }
  return event.code === want.key;
}

/**
 * Which shortcut, if any, a key event fires within a scope.
 *
 * The scope must match exactly rather than a global listener accepting everything. A
 * canvas-scoped chord reaching the window listener has, by definition, not been claimed by a
 * focused canvas, and handling it there would defeat the point of scoping it.
 */
export function shortcutFor(
  event: KeyboardEvent,
  mac = isMac(),
  scope?: 'canvas',
): Shortcut | undefined {
  return SHORTCUTS.find(
    (shortcut) =>
      shortcut.scope === scope &&
      chordsOf(shortcut).some((chord) => matchesChord(chord, event, mac)),
  );
}

/**
 * Whether a key event came from somewhere text is being typed.
 *
 * Almost every shortcut must stand down here. Someone renaming a state expects `Backspace` to
 * delete a character, not the state they are naming — a bug that destroys work and gets
 * reported as "it randomly deleted things", because from the outside that is what it looks
 * like.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  );
}

/** Whether this platform uses Cmd rather than Ctrl. */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/** Symbols for the keys that have one, so the sheet reads like the keyboard looks. */
const GLYPHS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backspace: '⌫',
  Delete: 'Del',
  Escape: 'Esc',
  Equal: '+',
  Minus: '−',
  Slash: '/',
  Backslash: '\\',
};

/**
 * A chord as it should be shown to the user.
 *
 * Mac convention is symbols with no separator (`⌘⇧Z`); everywhere else it is words joined by
 * `+` (`Ctrl+Shift+Z`). Following each platform's own convention matters more here than
 * consistency between them, because the point of the sheet is to be recognised at a glance.
 */
export function formatChord(chord: string, mac = isMac()): string {
  const { mod, shift, alt, key } = parseChord(chord);
  const name = key.startsWith('Key')
    ? key.slice(3)
    : key.startsWith('Digit')
      ? key.slice(5)
      : (GLYPHS[key] ?? key);

  const parts = [
    ...(mod ? [mac ? '⌘' : 'Ctrl'] : []),
    ...(shift ? [mac ? '⇧' : 'Shift'] : []),
    ...(alt ? [mac ? '⌥' : 'Alt'] : []),
    name,
  ];
  return mac ? parts.join('') : parts.join('+');
}

/** The shortcuts in one group. */
export function shortcutsIn(group: Group): Shortcut[] {
  return SHORTCUTS.filter((shortcut) => shortcut.group === group);
}

/** One line in the shortcut sheet. */
export interface SheetRow {
  id: ShortcutId;
  label: string;
  /** Ready to print — either a formatted chord or a family's own notation. */
  keys: string;
}

/**
 * A group as the sheet should show it, with families collapsed to one row each.
 *
 * Only the first member of a family survives, carrying the family's label and notation. The
 * other three still bind; they simply do not each earn a line in a reference someone is
 * scanning.
 */
export function sheetRowsIn(group: Group, mac = isMac()): SheetRow[] {
  const seen = new Set<string>();

  return shortcutsIn(group).flatMap((shortcut) => {
    if (shortcut.family !== undefined) {
      if (seen.has(shortcut.family)) return [];
      seen.add(shortcut.family);
    }
    return [
      {
        id: shortcut.id,
        label: shortcut.label,
        keys: shortcut.display ?? formatChord(shortcut.chord, mac),
      },
    ];
  });
}
