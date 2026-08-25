/**
 * Dragging a new state onto the canvas.
 *
 * Double-clicking empty canvas already creates a state, and will keep doing so — it is faster
 * once you know it. But it is not *visible*: an empty canvas offers no evidence that
 * double-clicking it does anything, which is why the first-run tour has to spend a card
 * saying so. A thing you can pick up and drop is evidence.
 *
 * The two coexist on purpose. Discoverable and fast are different requirements and they are
 * usually met by different gestures; making the discoverable one the only one would slow down
 * everybody who has already learned the fast one.
 *
 * ## Why a custom MIME type
 *
 * The editor already accepts dropped `.kln` and `.jff` files, and the two drags must not be
 * confused: dropping a file replaces the whole document, and dropping a chip adds one state.
 * A drag carrying this type is ours; a drag carrying files is not. `isFileDrag` answers the
 * other half of the same question, and neither can accidentally be true of the other, because
 * a `DataTransfer` item is either a string or a file.
 */

/**
 * The drag's type tag.
 *
 * A vendor-prefixed `application/x-*` name rather than `text/plain`, so a chip dragged into a
 * text editor does not paste a stray word, and text dragged from anywhere else is not mistaken
 * for a state.
 */
export const STATE_DRAG = 'application/x-kleene-state';

/** Whether a drag is carrying one of our chips. */
export function isStateDrag(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes(STATE_DRAG);
}
