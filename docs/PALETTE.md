# Kleene — palette and motion tokens

A self-contained reference. Everything needed to reproduce the look is in this file: no
imports, no reference to the rest of the repository, and no rule that depends on knowing what
an automaton is. Paste it into another project, or hand it to another tool, and it will be
enough on its own.

The live definitions are in [`web/src/styles.css`](../web/src/styles.css). **That file is the
source of truth**; if the two disagree, the stylesheet is right and this document is stale.

---

## The one-paragraph version

Violet primary (`#6D5EF8`), cyan secondary (`#0891B2`), slate neutrals, magenta only as the
third stop of a gradient. Light mode on white, dark mode on a blue-black (`#0F1117`) rather
than pure black. Type is Inter for prose and JetBrains Mono for anything that is notation.
Motion is one spring for the marketing surface and one linear-ish ease for anything that
explains a computation, and the two never mix.

---

## Light and dark are different hues, not one hue dimmed

This is the only non-obvious decision in the palette and it is worth stating first, because a
tool that "just darkens the light theme" will get it wrong.

The cyan is the clearest case. `#22D3EE` on white measures **1.81:1** — it fails every contrast
threshold there is. So light mode uses `#0891B2` (**3.68:1**) and dark mode uses `#22D3EE`
(**8.9:1** on `#0F1117`). Same semantic role, two different colours, each chosen for its own
background. The violet does the same thing: `#6D5EF8` in light, `#8B7CFF` in dark.

**Rule:** never derive one theme from the other programmatically. Pick each value against the
background it will actually sit on.

---

## Tokens

Names are `--color-k-*`. The `k-` prefix exists so the palette can be dropped into a project
that already has tokens without colliding with them.

### Brand

| Token | Light | Dark | What it is for |
|---|---|---|---|
| `k-primary` | `#6D5EF8` | `#8B7CFF` | The one accent. Buttons, links, the active state, the first gradient stop. |
| `k-primary-hover` | `#5B4CE6` | `#A394FF` | Hover only. Note the direction flips: darker in light mode, **lighter** in dark. |
| `k-primary-subtle` | `#EEEBFF` | `#241F45` | Tinted fill behind primary text. Not a border. |
| `k-secondary` | `#0891B2` | `#22D3EE` | The second voice. Used for a different *kind* of thing, never for variety. |
| `k-secondary-subtle` | `#E0F7FC` | `#0C3540` | As above. |

### Surfaces

| Token | Light | Dark | What it is for |
|---|---|---|---|
| `k-bg` | `#FFFFFF` | `#0F1117` | The page. |
| `k-surface` | `#F8FAFC` | `#161923` | A card or panel sitting *on* the page. |
| `k-surface-raised` | `#FFFFFF` | `#1E2230` | Something on top of a surface — a menu, an input, a dialog. |
| `k-border` | `#E2E8F0` | `#2A3040` | The default hairline. |
| `k-border-strong` | `#CBD5E1` | `#3A4254` | Hover, focus, and any border that has to be noticed. |
| `k-canvas` | `#FCFCFD` | `#0B0D13` | The drawing surface. Deliberately *not* `k-bg` — a canvas should read as inset. |
| `k-grid-dot` | `#E2E8F0` | `#232838` | The dot grid. Must be visible and must never compete with content. |

Note that dark mode's surfaces get *lighter* as they get closer to the viewer
(`#0F1117` → `#161923` → `#1E2230`) while light mode's stay near white and rely on borders and
shadow instead. Elevation is carried by lightness in the dark and by edges in the light.

### Text

| Token | Light | Dark | What it is for |
|---|---|---|---|
| `k-text` | `#0F172A` | `#E8EAF2` | Body and headings. Never pure black or pure white. |
| `k-text-muted` | `#475569` | `#9BA3B8` | Secondary prose. Still passes AA. |
| `k-text-faint` | `#64748B` | `#6B7488` | Labels, captions, metadata. **Not for anything a user must read to act.** |

### Semantic — colours that mean something

These carry meaning rather than decoration. Changing one changes what the interface is saying.

| Token | Light | Dark | Means |
|---|---|---|---|
| `k-active` | `#6D5EF8` | `#8B7CFF` | The thing currently happening. |
| `k-accepting` | `#0891B2` | `#22D3EE` | A terminal / success / accepting state. |
| `k-new` | `#059669` | `#34D399` | Just created. |
| `k-dead` | `#64748B` | `#6B7488` | Reachable but useless — greyed with intent, not disabled. |
| `k-distinguishing` | `#E11D48` | `#FB7185` | The thing that proves two others differ. |
| `k-origin` | `#F59E0B` | `#FBBF24` | Where something came from. |

### Feedback

| Token | Light | Dark |
|---|---|---|
| `k-success` | `#059669` | `#34D399` |
| `k-warning` | `#B45309` | `#FBBF24` |
| `k-error` | `#DC2626` | `#F87171` |

### Glass

| Token | Light | Dark |
|---|---|---|
| `k-glass` | `rgb(255 255 255 / 0.66)` | `rgb(30 34 48 / 0.62)` |
| `k-glass-edge` | `rgb(255 255 255 / 0.9)` | `rgb(255 255 255 / 0.08)` |
| `k-glass-shadow` | `rgb(15 23 42 / 0.08)` | `rgb(0 0 0 / 0.4)` |

The edge token flips role between themes: in light it is a bright highlight along the top of
the panel, in dark it is a faint white rim. Same CSS, opposite job.

### Aurora — the background gradient

Three stops, hue-separated so the gradient has somewhere to travel. One colour at three
opacities produces a smudge, not a gradient.

| Token | Light | Dark |
|---|---|---|
| `k-aurora-1` | `#6D5EF8` violet | `#8B7CFF` |
| `k-aurora-2` | `#0891B2` cyan | `#22D3EE` |
| `k-aurora-3` | `#D946EF` magenta | `#E879F9` |

Magenta appears **only** here. It has no semantic role and must never be used to mean
anything — it exists to give the gradient a third hue.

---

## Type

```
--font-sans: 'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
```

Both are self-hosted, never CDN-fetched, so the app works offline and inside a native shell.

**The monospace is not decorative.** It carries a rule: anything that is *notation* is
monospace — state labels, symbols, code, the Greek letters `ε` and `Σ`, and any number that
will be compared against another number. Prose is Inter. If you are unsure which a piece of
text is, ask whether a reader would ever need to align it with something above it.

The JetBrains Mono **Greek subset must be loaded explicitly**. `ε` (U+03B5) and `Σ` (U+03A3)
live in the Greek block, and an epsilon falling back to a system font next to monospace labels
is instantly visible and looks broken.

Headings use `tracking-tight`; the hero uses `-0.03em`. Body text is left at default tracking.

---

## Motion

Two vocabularies that never mix.

```
--ease-k:        cubic-bezier(0.2, 0.8, 0.2, 1);     /* explains a computation */
--ease-k-spring: cubic-bezier(0.22, 1.2, 0.36, 1);   /* marketing surface */

--duration-k-hover:  120ms
--duration-k-panel:  180ms
--duration-k-step:   280ms
--duration-k-merge:  420ms
--duration-k-reveal: 620ms
```

`--ease-k` has no overshoot, on purpose. It is used where motion is showing something happen —
a step of an algorithm, a value changing. An overshoot there implies a correction that did not
occur.

`--ease-k-spring` overshoots slightly. It is used on landing pages, where nothing is being
explained and motion is only establishing what arrived first.

**280ms is the important one.** It is tuned so the eye can follow one thing becoming another.
Faster is unreadable; slower is tedious when repeated.

The React spring equivalent, for `motion` / Framer Motion:

```js
const SPRING = { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 };
```

### Reduced motion

Degrade to **plain, immediately visible content** — never to a faster animation. An element
that slides 24px in 10ms is a flicker, not an accommodation. Reduced motion must not mean
reduced information: if a highlight communicates something, it stays; only its arrival goes.

---

## Rules that come with the palette

Take these along with the hex codes. They are what make it read as designed rather than
merely coloured in.

1. **Chrome recedes.** The content is the product. Borders, backgrounds and labels stay quiet
   enough that the eye lands on the content first.
2. **Colour is never the only channel.** Every state carries a second signal — a shape, a
   glyph, a weight, a position. Assume greyscale printing and assume colour blindness, both
   every time.
3. **Motion explains causality, or it does not happen.** Nothing moves for delight in a
   working area. Decoration lives where there is nothing to decorate *over*.
4. **Glass never goes over content that must be read precisely.** It belongs on navigation and
   on marketing panels. A translucent panel over a diagram makes the diagram harder to read,
   and the diagram is the product.
5. **One accent.** `k-primary` is the only colour that means "this". A second accent used for
   emphasis makes both mean nothing.

---

## Copy-paste

Drop this in and the tokens exist. Written for Tailwind v4's `@theme`, but the custom
properties work standalone in any project — delete the `@theme` wrapper and use a plain
`:root` if you are not on Tailwind.

```css
@theme {
  /* Brand */
  --color-k-primary: #6d5ef8;
  --color-k-primary-hover: #5b4ce6;
  --color-k-primary-subtle: #eeebff;
  --color-k-secondary: #0891b2;
  --color-k-secondary-subtle: #e0f7fc;

  /* Surfaces */
  --color-k-bg: #ffffff;
  --color-k-surface: #f8fafc;
  --color-k-surface-raised: #ffffff;
  --color-k-border: #e2e8f0;
  --color-k-border-strong: #cbd5e1;
  --color-k-canvas: #fcfcfd;
  --color-k-grid-dot: #e2e8f0;

  /* Text */
  --color-k-text: #0f172a;
  --color-k-text-muted: #475569;
  --color-k-text-faint: #64748b;

  /* Semantic */
  --color-k-active: #6d5ef8;
  --color-k-accepting: #0891b2;
  --color-k-new: #059669;
  --color-k-dead: #64748b;
  --color-k-distinguishing: #e11d48;
  --color-k-origin: #f59e0b;

  /* Feedback */
  --color-k-success: #059669;
  --color-k-warning: #b45309;
  --color-k-error: #dc2626;

  /* Glass */
  --color-k-glass: rgb(255 255 255 / 0.66);
  --color-k-glass-edge: rgb(255 255 255 / 0.9);
  --color-k-glass-shadow: rgb(15 23 42 / 0.08);

  /* Aurora */
  --color-k-aurora-1: #6d5ef8;
  --color-k-aurora-2: #0891b2;
  --color-k-aurora-3: #d946ef;

  /* Type */
  --font-sans: 'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  /* Motion */
  --ease-k: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-k-spring: cubic-bezier(0.22, 1.2, 0.36, 1);
  --duration-k-hover: 120ms;
  --duration-k-panel: 180ms;
  --duration-k-step: 280ms;
  --duration-k-merge: 420ms;
  --duration-k-reveal: 620ms;
}

/*
 * Dark mode is defined twice on purpose: once for the system preference, once for an
 * explicit toggle, so a manual choice wins in both directions. A token defined only inside a
 * media query has no value when the toggle overrides it.
 */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --color-k-primary: #8b7cff;
    --color-k-primary-hover: #a394ff;
    --color-k-primary-subtle: #241f45;
    --color-k-secondary: #22d3ee;
    --color-k-secondary-subtle: #0c3540;

    --color-k-bg: #0f1117;
    --color-k-surface: #161923;
    --color-k-surface-raised: #1e2230;
    --color-k-border: #2a3040;
    --color-k-border-strong: #3a4254;
    --color-k-canvas: #0b0d13;
    --color-k-grid-dot: #232838;

    --color-k-text: #e8eaf2;
    --color-k-text-muted: #9ba3b8;
    --color-k-text-faint: #6b7488;

    --color-k-active: #8b7cff;
    --color-k-accepting: #22d3ee;
    --color-k-new: #34d399;
    --color-k-dead: #6b7488;
    --color-k-distinguishing: #fb7185;
    --color-k-origin: #fbbf24;

    --color-k-success: #34d399;
    --color-k-warning: #fbbf24;
    --color-k-error: #f87171;

    --color-k-glass: rgb(30 34 48 / 0.62);
    --color-k-glass-edge: rgb(255 255 255 / 0.08);
    --color-k-glass-shadow: rgb(0 0 0 / 0.4);

    --color-k-aurora-1: #8b7cff;
    --color-k-aurora-2: #22d3ee;
    --color-k-aurora-3: #e879f9;
  }
}

/* Repeat the same block under [data-theme='dark'] so an explicit toggle wins. */
```

### The three effect classes

```css
.k-glass {
  background: var(--color-k-glass);
  backdrop-filter: blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
  border: 1px solid var(--color-k-glass-edge);
  box-shadow:
    0 1px 0 0 var(--color-k-glass-edge) inset,
    0 8px 32px -8px var(--color-k-glass-shadow);
}

.k-aurora {
  background:
    radial-gradient(42rem 28rem at 18% 8%,
      color-mix(in oklab, var(--color-k-aurora-1) 34%, transparent), transparent 70%),
    radial-gradient(38rem 26rem at 82% 0%,
      color-mix(in oklab, var(--color-k-aurora-2) 28%, transparent), transparent 70%),
    radial-gradient(34rem 30rem at 60% 46%,
      color-mix(in oklab, var(--color-k-aurora-3) 20%, transparent), transparent 72%);
  filter: blur(12px);
}

.k-gradient-text {
  background: linear-gradient(100deg,
    var(--color-k-aurora-1), var(--color-k-aurora-3) 42%, var(--color-k-aurora-2));
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

/* background-clip: text needs a transparent fill, so the text vanishes if the gradient does
   not paint. Forced-colours mode does exactly that. */
@media (forced-colors: active) {
  .k-gradient-text {
    color: CanvasText;
    background: none;
  }
}
```

`.k-aurora` should always be `aria-hidden` and `pointer-events-none`, and should sit in an
`overflow-hidden` parent — the washes are larger than their container by design.
