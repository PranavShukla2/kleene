import { describe, expect, it } from 'vitest';

import {
  IDENTITY,
  SNAP,
  ZOOM_FIT_MIN,
  ZOOM_MAX,
  ZOOM_MIN,
  boundsOf,
  fitTo,
  panBy,
  snapPoint,
  toScreen,
  toWorld,
  wheelZoomFactor,
  zoomAt,
  zoomTo,
  type Viewport,
} from '@/canvas/viewport';

const viewports: Viewport[] = [
  IDENTITY,
  { x: 0, y: 0, scale: 2 },
  { x: -140, y: 75, scale: 0.5 },
  { x: 33.5, y: -12.25, scale: 1.75 },
];

describe('screen and world coordinates', () => {
  it('are exact inverses', () => {
    // Hit-testing and rendering both go through these. If they disagreed by a pixel,
    // clicking a state would sometimes miss it, and the cause would be invisible.
    for (const viewport of viewports) {
      for (const point of [
        { x: 0, y: 0 },
        { x: 100, y: -40 },
        { x: -7.5, y: 913 },
      ]) {
        const back = toWorld(viewport, toScreen(viewport, point));
        expect(back.x).toBeCloseTo(point.x, 9);
        expect(back.y).toBeCloseTo(point.y, 9);
      }
    }
  });

  it('is the identity when unpanned and unzoomed', () => {
    expect(toScreen(IDENTITY, { x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
  });

  it('scales about the origin, then translates', () => {
    const viewport = { x: 100, y: 50, scale: 2 };
    expect(toScreen(viewport, { x: 10, y: 10 })).toEqual({ x: 120, y: 70 });
  });
});

describe('panning', () => {
  it('moves the diagram by the screen delta', () => {
    const moved = panBy({ x: 10, y: 10, scale: 2 }, 5, -5);
    expect(moved).toEqual({ x: 15, y: 5, scale: 2 });
  });

  it('does not change the zoom', () => {
    expect(panBy({ x: 0, y: 0, scale: 3 }, 100, 100).scale).toBe(3);
  });
});

describe('zooming', () => {
  it('keeps the point under the cursor exactly where it is', () => {
    // The whole reason zoom is cursor-anchored. Centre-anchored zoom makes the thing you
    // are pointing at slide away as you scroll toward it.
    for (const viewport of viewports) {
      for (const cursor of [
        { x: 0, y: 0 },
        { x: 640, y: 360 },
        { x: 1200, y: 50 },
      ]) {
        const before = toWorld(viewport, cursor);
        const after = toWorld(zoomAt(viewport, cursor, 1.3), cursor);

        expect(after.x).toBeCloseTo(before.x, 9);
        expect(after.y).toBeCloseTo(before.y, 9);
      }
    }
  });

  it('holds the anchor across a long gesture', () => {
    // Rounding drift would show up as the diagram creeping while the user scrolls.
    const cursor = { x: 500, y: 300 };
    let viewport: Viewport = IDENTITY;
    const target = toWorld(viewport, cursor);

    for (let i = 0; i < 60; i += 1) viewport = zoomAt(viewport, cursor, 1.05);

    const after = toWorld(viewport, cursor);
    expect(after.x).toBeCloseTo(target.x, 6);
    expect(after.y).toBeCloseTo(target.y, 6);
  });

  it('clamps to the zoom range', () => {
    const inMax = zoomAt(IDENTITY, { x: 0, y: 0 }, 1000);
    const inMin = zoomAt(IDENTITY, { x: 0, y: 0 }, 0.0001);

    expect(inMax.scale).toBe(ZOOM_MAX);
    expect(inMin.scale).toBe(ZOOM_MIN);
  });

  it('still anchors correctly when the zoom clamps', () => {
    // A clamp that forgets to re-anchor makes the diagram jump at the limit.
    const cursor = { x: 300, y: 200 };
    const before = toWorld(IDENTITY, cursor);
    const after = toWorld(zoomAt(IDENTITY, cursor, 1000), cursor);

    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it('sets an absolute zoom while holding the anchor', () => {
    const cursor = { x: 400, y: 400 };
    const viewport = zoomTo({ x: 12, y: 34, scale: 0.5 }, cursor, 2);

    expect(viewport.scale).toBe(2);
    expect(toWorld(viewport, cursor).x).toBeCloseTo(
      toWorld({ x: 12, y: 34, scale: 0.5 }, cursor).x,
      9,
    );
  });
});

describe('wheel zoom', () => {
  it('zooms in on a negative delta and out on a positive one', () => {
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100)).toBeLessThan(1);
    expect(wheelZoomFactor(0)).toBe(1);
  });

  it('is exponential, so a notch feels the same at any zoom', () => {
    // A linear step would crawl when zoomed out and lurch when zoomed in.
    const once = wheelZoomFactor(-50);
    expect(wheelZoomFactor(-100)).toBeCloseTo(once * once, 9);
  });
});

describe('fit to content', () => {
  const size = { width: 800, height: 600 };

  it('centres the content', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const viewport = fitTo(bounds, size);
    const centre = toScreen(viewport, { x: 50, y: 50 });

    expect(centre.x).toBeCloseTo(400, 6);
    expect(centre.y).toBeCloseTo(300, 6);
  });

  it('never zooms past 1', () => {
    // Scaling a three-state machine to fill a wide screen would make it look like a
    // different diagram every time a state is added.
    expect(fitTo({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, size).scale).toBe(1);
  });

  it('zooms out far enough to show everything, however large', () => {
    // A fit that does not fit is a bug, so this is allowed below the interactive zoom
    // floor — see ZOOM_FIT_MIN. 4000x3000 needs 0.168, well under ZOOM_MIN of 0.25.
    for (const bounds of [
      { minX: 0, minY: 0, maxX: 400, maxY: 300 },
      { minX: 0, minY: 0, maxX: 4000, maxY: 3000 },
      { minX: -2000, minY: -1500, maxX: 2000, maxY: 1500 },
    ]) {
      const viewport = fitTo(bounds, size);
      const topLeft = toScreen(viewport, { x: bounds.minX, y: bounds.minY });
      const bottomRight = toScreen(viewport, { x: bounds.maxX, y: bounds.maxY });

      expect(topLeft.x).toBeGreaterThanOrEqual(0);
      expect(topLeft.y).toBeGreaterThanOrEqual(0);
      expect(bottomRight.x).toBeLessThanOrEqual(size.width);
      expect(bottomRight.y).toBeLessThanOrEqual(size.height);
    }
  });

  it('may go below the interactive zoom floor, but not below the fit floor', () => {
    const enormous = { minX: 0, minY: 0, maxX: 1_000_000, maxY: 1_000_000 };
    const viewport = fitTo(enormous, size);

    expect(viewport.scale).toBeLessThan(ZOOM_MIN);
    expect(viewport.scale).toBe(ZOOM_FIT_MIN);
  });

  it('falls back to identity with nothing to fit', () => {
    expect(fitTo(undefined, size)).toEqual(IDENTITY);
    expect(fitTo({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, { width: 0, height: 0 })).toEqual(
      IDENTITY,
    );
  });
});

describe('bounds', () => {
  it('includes the state radius, so circles are not clipped', () => {
    const bounds = boundsOf([{ x: 0, y: 0 }]);
    expect(bounds?.minX).toBeLessThan(0);
    expect(bounds?.maxX).toBeGreaterThan(0);
  });

  it('is undefined for no points', () => {
    expect(boundsOf([])).toBeUndefined();
  });
});

describe('snapping', () => {
  it('rounds to the nearest grid step', () => {
    expect(snapPoint({ x: 3, y: 5 })).toEqual({ x: 0, y: 8 });
    expect(snapPoint({ x: 9, y: -9 })).toEqual({ x: 8, y: -8 });
  });

  it('breaks ties symmetrically about the origin', () => {
    // Math.round would send +12 to +16 and -12 to -8, which is invisible until someone
    // aligns two states either side of the origin and finds they do not line up.
    expect(snapPoint({ x: 12, y: -12 })).toEqual({ x: 16, y: -16 });
  });

  it('leaves points already on the grid alone', () => {
    expect(snapPoint({ x: SNAP * 3, y: SNAP * -2 })).toEqual({ x: 24, y: -16 });
  });

  it('is idempotent', () => {
    const once = snapPoint({ x: 37.4, y: -91.2 });
    expect(snapPoint(once)).toEqual(once);
  });
});
