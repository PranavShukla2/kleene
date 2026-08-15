# Kleene — Design System

The visual contract the UI is held to. Written in Phase 0, *before* the editor exists, so
Phase 2 conforms to a spec instead of inventing one under time pressure.

Supersedes the roadmap's `#0D9488` teal.

---

## 1. Principles

1. **The diagram is the product.** Chrome recedes; the automaton does not. Every panel,
   toolbar, and label is designed to take attention away from itself.
2. **Color is never the only channel.** Every semantic state is also carried by stroke
   weight, dash pattern, or ring count. This is not only an accessibility rule — Kleene's
   output gets exported to TikZ and printed in greyscale on assignment PDFs, where hue is
   simply gone. See §6.
3. **Motion explains causality, or it doesn't happen.** An animation that shows *which
   states merged* earns its frame budget. A fade-in on page load does not.
4. **Density over decoration.** This is a workbench. A student comparing four panes needs
   information per pixel, not whitespace per pixel.
5. **It must look correct at 100% zoom on a 1366×768 laptop.** That is the actual machine
   in the actual lab, not a 27" display.

---

## 2. Color tokens

Defined as CSS custom properties on `:root`, redefined under both
`@media (prefers-color-scheme: dark)` and `[data-theme="dark"]` so the manual toggle wins
in both directions. Tailwind references the properties; it never hardcodes a hex.

### 2.1 Brand

| Token | Light | Dark | Use |
|---|---|---|---|
| `--k-primary` | `#6D5EF8` | `#8B7CFF` | Brand, primary actions, active/current step |
| `--k-primary-hover` | `#5B4CE6` | `#A394FF` | Hover state |
| `--k-primary-subtle` | `#EEEBFF` | `#241F45` | Selected-row and highlight fills |
| `--k-secondary` | `#0891B2` | `#22D3EE` | Accepting states, secondary emphasis |
| `--k-secondary-subtle` | `#E0F7FC` | `#0C3540` | Accepting-state fill wash |

**Note the light/dark split is not cosmetic.** `#22D3EE` on white is **1.81:1** — it fails
every contrast threshold and can only ever be decoration. Light mode therefore uses
`#0891B2` (**3.68:1**, clears the 3:1 bar for graphical objects) wherever dark mode uses the
bright cyan. Getting this wrong is the single easiest way to ship an inaccessible diagram.

### 2.2 Surfaces

| Token | Light | Dark |
|---|---|---|
| `--k-bg` | `#FFFFFF` | `#0F1117` |
| `--k-surface` | `#F8FAFC` | `#161923` |
| `--k-surface-raised` | `#FFFFFF` | `#1E2230` |
| `--k-border` | `#E2E8F0` | `#2A3040` |
| `--k-border-strong` | `#CBD5E1` | `#3A4254` |
| `--k-canvas` | `#FCFCFD` | `#0B0D13` |
| `--k-grid-dot` | `#E2E8F0` | `#232838` |

The canvas is deliberately a hair different from the page background — enough to read as
a distinct workspace, not enough to be a visible rectangle.

### 2.3 Text

| Token | Light | Dark | Contrast on its surface |
|---|---|---|---|
| `--k-text` | `#0F172A` | `#E8EAF2` | 17.9:1 / 14.8:1 |
| `--k-text-muted` | `#475569` | `#9BA3B8` | 7.9:1 / 7.2:1 |
| `--k-text-faint` | `#64748B` | `#6B7488` | 4.8:1 / 4.1:1 |

### 2.4 Canvas semantics

The hues that carry algorithmic meaning. These appear in the step-through views and are
the most load-bearing colors in the product.

| Meaning | Light | Dark | Contrast (light) | Second channel |
|---|---|---|---|---|
| **Active** — current state / current step | `#6D5EF8` | `#8B7CFF` | 4.57:1 | stroke 3px + glow |
| **Accepting** | `#0891B2` | `#22D3EE` | 3.68:1 | double ring (always) |
| **New** — just added to the worklist | `#059669` | `#34D399` | 3.72:1 | 400ms scale-in pop |
| **Dead / trap / unreachable** | `#64748B` | `#6B7488` | 4.77:1 | 4-2 dashed stroke + 55% opacity |
| **Distinguishing** — the string that split a block | `#E11D48` | `#FB7185` | 4.69:1 | stroke 3px + dash animation |
| **Origin highlight** — NFA states behind a DFA state | `#F59E0B` | `#FBBF24` | 2.15:1 ⚠ | fill wash only, never a stroke or text |

⚠ Amber is below 3:1 on light backgrounds. It is permitted **only** as a translucent fill
behind a shape that already has a compliant stroke. It never carries meaning alone.

### 2.5 Feedback

| Token | Light | Dark |
|---|---|---|
| `--k-success` | `#059669` | `#34D399` |
| `--k-warning` | `#B45309` | `#FBBF24` |
| `--k-error` | `#DC2626` | `#F87171` |

---

## 3. Typography

| Role | Family | Size / weight | Notes |
|---|---|---|---|
| UI | Inter | 14px / 400 | `-apple-system` fallback stack |
| UI emphasis | Inter | 14px / 550 | Optical weight; avoid 700 in dense panels |
| Section label | Inter | 11px / 600, `0.06em` tracking, uppercase | Panel headers |
| **State labels** | **JetBrains Mono** | **13px / 500** | On-canvas, inside state circles |
| **Regex input** | **JetBrains Mono** | **16px / 400** | Larger — it is the primary input of the app |
| Step reasoning | Inter | 14px / 400, 1.6 line-height | Prose; must be readable, not terse |
| Set notation | JetBrains Mono | 12px / 400 | `{q1, q3, q4}` renders monospace, always |
| Code / export | JetBrains Mono | 13px / 400 | TikZ and DOT output panes |

Both families are **self-hosted and subset**, never fetched from a CDN — the app must work
fully offline as a PWA and inside the Tauri shell.

Set notation is monospace everywhere, without exception. `{q1, q3}` in a proportional face
looks like prose; in mono it reads as a mathematical object, which is what it is.

---

## 4. Diagram geometry

Exact numbers, because "it looks about right" is how diagrams end up looking generated.
All values at zoom level 1.0.

### 4.1 States

```
radius                    24px
stroke                    1.75px
accepting inner ring      radius − 4.5px, same stroke
label                     centred, JetBrains Mono 13px/500
fill                      --k-surface-raised
hover                     stroke → 2.25px, 120ms ease-out
selected                  2px --k-primary ring at radius + 4px
```

The accepting ring inset is 4.5px, not 4 or 5. At 4 it reads as a rendering artifact; at 6
the two rings look unrelated. This is the detail that separates a hand-made diagram from a
generated one, and it is why it is specified rather than left to the implementer.

### 4.2 Start marker

```
arrow length              22px, entering from the left
arrowhead                 8px long, 6px wide
gap to state              2px  ← never 0; a touching arrowhead looks like a bug
```

### 4.3 Transitions

```
stroke                    1.5px
arrowhead                 9px long, 6.5px wide, at the target circle's edge (not centre)
label offset              12px along the edge normal, never on the line
label background          3px padding, --k-canvas fill, so it cuts the line cleanly
multi-symbol collapse     "a, b, c" on one edge — never parallel edges for the same pair
```

**Bidirectional pairs** (q0→q1 and q1→q0 both exist): quadratic curve, control point offset
**28px** perpendicular to the midpoint, one bending each way. Straight overlapping edges are
the most common way a generated automaton diagram looks broken.

**Self-loops:** a circle of radius 16px tangent to the state, placed in the first free
direction in the order `above, right, below, left`. Free means no other state's bounding box
and no incident edge within 40px of that anchor. 🔵 Phase 0 ships `above` only.

### 4.4 Canvas

```
grid                      24px dot grid, 1px dots, --k-grid-dot
snap                      8px  (visible grid is 24px; snapping at 24 feels rigid)
zoom range                0.25 – 4.0, wheel + pinch, cursor-anchored
default node distance     96px  ← maps to TikZ node distance=2.4cm
```

The 96px ↔ 2.4cm correspondence is deliberate: what the student arranges on screen is what
comes out of TikZ export, without a fudge factor.

---

## 5. Layout, spacing, motion

**Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 · 48. Nothing else.
**Radii:** 6px controls · 10px panels · 14px modals · full for pills.
**Elevation:** borders first. One shadow token for popovers, one for modals. Nothing else
floats.

**Motion:**

| Interaction | Duration | Easing |
|---|---|---|
| Hover / focus | 120ms | `ease-out` |
| Panel open, popover | 180ms | `cubic-bezier(.2,.8,.2,1)` |
| Step transition (scrubber) | 280ms | `cubic-bezier(.2,.8,.2,1)` |
| State merge / split (minimization) | 420ms | `cubic-bezier(.4,0,.2,1)` |

The 280ms step transition is the most important number here. Faster and the eye cannot
follow which subset became which state; slower and scrubbing through 30 rounds is tedious.

All motion respects `prefers-reduced-motion`, where transitions become instant cuts — but
**highlights persist**. Reduced motion must not mean reduced information.

---

## 6. Accessibility and the print constraint

- Every UI text pair clears **4.5:1**; every graphical object clears **3:1**.
- Focus rings are 2px `--k-primary` at 2px offset, never removed, visible in both themes.
- The full editor is keyboard-reachable — this is also what makes it demoable without a
  mouse and testable in Playwright.
- All canvas semantics carry a **non-color second channel** (§2.4, last column).

**The greyscale test is a CI check, not a guideline.** Kleene's diagrams end up in printed
PDFs. The semantic hues in §2.4 have luminances between 0.17 and 0.24 — under greyscale
they are nearly indistinguishable. Any view that relies on hue alone is broken in the medium
this tool exists to serve. Snapshot tests render the canvas desaturated and assert the
distinctions still read.

---

## 7. What this system explicitly rejects

- **Gradients on states.** They do not survive TikZ export, so on-screen and exported
  diagrams would diverge.
- **Icon-only toolbars.** This is a teaching tool for people who do not yet know the
  vocabulary. Labels stay.
- **A colored app chrome.** The violet is for meaning on the canvas. A violet header
  spends the brand color where it carries no information.
- **Animated page transitions.** See principle 3.
