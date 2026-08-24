import { describe, expect, it } from 'vitest';

import { droppedFile, filenameFor, isFileDrag, JFF, KLN } from '@/store/files';

/** A `DragEvent`-shaped object, since jsdom has no real one. */
function drag(items: { kind: string }[], files: { name: string }[] = []): DragEvent {
  return { dataTransfer: { items, files } } as unknown as DragEvent;
}

describe('filenameFor', () => {
  it('names the file after the document', () => {
    expect(filenameFor('Strings ending in ab')).toBe(`strings-ending-in-ab${KLN}`);
  });

  it('falls back rather than producing a nameless file', () => {
    // A title of only punctuation slugs to nothing, and `.kln` alone is a hidden file on
    // every Unix machine — saved, and then invisible in the folder it was saved to.
    expect(filenameFor(undefined)).toBe(`automaton${KLN}`);
    expect(filenameFor('')).toBe(`automaton${KLN}`);
    expect(filenameFor('!!! ???')).toBe(`automaton${KLN}`);
  });

  it('does not produce a name a filesystem will refuse', () => {
    const name = filenameFor('a/b: "c" \\ d*e?');
    expect(name).not.toMatch(/[/\\:*?"<>|]/);
  });

  it('keeps names short enough to survive being downloaded', () => {
    expect(filenameFor('x'.repeat(200)).length).toBeLessThanOrEqual(48 + KLN.length);
  });
});

describe('isFileDrag', () => {
  it('accepts a drag carrying a file', () => {
    expect(isFileDrag(drag([{ kind: 'file' }]))).toBe(true);
  });

  it('ignores text being dragged over the canvas', () => {
    // Selecting a label and dragging it should not make the whole editor look like a drop
    // target.
    expect(isFileDrag(drag([{ kind: 'string' }]))).toBe(false);
    expect(isFileDrag(drag([]))).toBe(false);
  });

  it('survives a drag with no dataTransfer at all', () => {
    expect(isFileDrag({} as DragEvent)).toBe(false);
  });
});

describe('droppedFile', () => {
  it('finds the .kln among several files', () => {
    const files = [{ name: 'notes.txt' }, { name: 'machine.kln' }];
    expect(droppedFile(drag([], files))?.name).toBe('machine.kln');
  });

  it('is not fooled by case', () => {
    expect(droppedFile(drag([], [{ name: 'MACHINE.KLN' }]))?.name).toBe('MACHINE.KLN');
  });

  it('accepts a JFLAP file too', () => {
    // The migration path. Someone with three years of coursework in `.jff` will not retype it.
    expect(droppedFile(drag([], [{ name: 'assignment3.jff' }]))?.name).toBe('assignment3.jff');
    expect(droppedFile(drag([], [{ name: `x${JFF.toUpperCase()}` }]))).toBeDefined();
  });

  it('prefers whichever openable file comes first', () => {
    const files = [{ name: 'a.jff' }, { name: 'b.kln' }];
    expect(droppedFile(drag([], files))?.name).toBe('a.jff');
  });

  it('returns nothing when the drop carries no document', () => {
    // Dropping a photo on the canvas must do nothing at all, rather than trying and failing.
    expect(droppedFile(drag([], [{ name: 'photo.png' }]))).toBeUndefined();
    expect(droppedFile(drag([], []))).toBeUndefined();
  });
});
