# Phase 2 — The editor

**Weeks 5–7 · ~30 hrs**

> **Exit criterion:** you can build and test the "even number of a's" DFA end to end
> without touching a config file.

## Goal

A direct-manipulation SVG editor that does not feel like a student project. The roadmap
calls this "the longest and least glamorous phase" and warns to budget honestly — the
honest budget is that **edge routing alone is a week**, and that is the number to plan
against rather than discover.

This is also the interruptible phase (roadmap §7). If SIH or exams hit, pause here.

---

## Why edge routing is the whole risk

Roadmap §7 names it the single biggest UX risk. Concretely, four cases have to look right
*simultaneously*, and each one is individually easy while the combination is not:

1. A self-loop where the obvious position is occupied by another state.
2. `q0→q1` and `q1→q0` both present — they must not overlap.
3. Three or more symbols on one edge — one edge labelled `a, b, c`, never three edges.
4. An edge passing under an unrelated state, where the label lands on top of it.

The plan therefore spends **Track C entirely on this**, before any of the more satisfying
features, and starts by reading how Graphviz solves it rather than by writing code.

---

## Work breakdown

### Track A — Document model and command stack

- [x] **A1.** The `KleeneDoc` TypeScript type mirroring the Rust `.kln` schema:
      `{ version, automaton, layout, meta }`. Generated from the Rust types via
      `ts-rs` — **not hand-written**, or the two drift within a fortnight.

  **Design note, found while setting this up.** `Automaton.states` is an `IndexMap` in Rust,
  and it crosses the two boundaries *differently*:

  | Boundary | Shape |
  |---|---|
  | `.kln` JSON via `serde_json` | object — `{"0": {…}}` |
  | wasm via `serde-wasm-bindgen` | JS `Map` |

  So one generated type cannot be correct for both, and generating one anyway would produce
  a type that silently lies about half its uses. The resolution:

  - **Generate the document shape.** `ts-rs` produces exactly the `.kln` schema, which is the
    format that is about to be frozen (D8) and the one that needs a guarantee against drift.
  - **Normalize at the wasm loader.** The loader converts the `Map` it receives into the
    canonical document shape, so the rest of the app sees one type. That conversion is the
    only place the difference exists, and it belongs there — it is a fact about the
    transport, not about the model.
  - **Do not "fix" this by making wasm emit plain objects.** It would unify the two shapes and
    quietly reintroduce the ordering hazard: JS objects iterate integer-like keys in ascending
    numeric order, not insertion order, and trace reproducibility depends on insertion order
    (Phase 1 A2). It works today only because state ids happen to be allocated ascending, and
    that is an assumption the editor's delete-and-recreate cycle would eventually break.
- [x] **A2.** Zustand store holding one document, with selectors granular enough that
      dragging a state does not re-render every edge.
- [x] **A3.** Command stack. Every mutation is a command object with `apply`/`invert`
      (roadmap §2.5). Modelled from day one, not diffed later.
- [x] **A4.** Undo/redo with coalescing — a 200-frame drag is **one** undo entry, not 200.
      Coalescing window: same command type on the same target within 400ms.
- [x] **A5.** Persist the working document to IndexedDB on a debounce, so a refresh or a
      browser crash does not lose work. There is no backend; this is the only safety net
      the user gets.
- [x] **A6.** Dirty-state tracking and a `beforeunload` guard.

### Track B — Canvas fundamentals

- [x] **B1.** Pan (space-drag and middle-drag), zoom (wheel and pinch, **cursor-anchored**,
      not centre-anchored — centre-anchored zoom feels broken and is a five-line fix).
- [x] **B2.** Dot grid at 24px, snapping at 8px, per [design-system.md](design-system.md) §4.4.
- [x] **B3.** Viewport transform as a single matrix; screen↔world helpers used everywhere so
      hit-testing and rendering can never disagree.
- [x] **B4.** "Fit to content" and "reset zoom", both keyboard-bound.
- [x] **B5.** Marquee selection; multi-select with shift; multi-drag.
- [x] **B6.** Render performance floor: **60fps while dragging a 60-state automaton**.
      Measured, not assumed. If SVG cannot hold it, that is worth knowing in week 5 rather
      than week 9.

### Track C — Edge routing *(the hard part — budget a full week)*

- [x] **C1.** Study how Graphviz places self-loops and parallel edges. Write down the rules
      being adopted in `docs/notes/edge-routing.md` **before** implementing them.
- [x] **C2.** Straight edges with endpoints clipped to the circle boundary, arrowhead at the
      boundary rather than the centre.
- [x] **C3.** Bidirectional pairs → symmetric quadratic curves, 28px control offset.
- [x] **C4.** Self-loops with free-direction selection in the order `above, right, below,
      left`, where "free" means no state bounding box and no incident edge within 40px.
      *(Phase 0 shipped `above` only — this is where that leftover is paid off.)*
- [x] **C5.** Multi-symbol collapse: one edge per ordered pair, labelled `a, b, c`, with
      sorted symbol order so the label is stable across renders.
- [x] **C6.** Label placement that avoids overlapping states and other labels — offset along
      the normal first, then slide along the edge if still colliding.
- [x] **C7.** A visual regression fixture: ~12 pathological automata (dense bidirectional
      pairs, four self-loops on one state, 8-symbol edges, states placed overlapping) that
      render to snapshot SVGs. This is what stops routing regressions later.

> **Track C is closed.** The fixtures live in `web/src/canvas/fixtures.ts` and their snapshots
> in `web/src/canvas/__fixtures__/`; the rules they enforce are written up in
> [edge-routing.md](../notes/edge-routing.md).
>
> C7 earned itself back on its first run. Fixture 05 — an edge that is *both* half of a
> bidirectional pair and obstructed by the state between its endpoints — showed both curves
> running straight through that state, because routing treated the two cases as alternatives
> and returned on the first match. The week the plan budgeted for Track C was budgeted for
> exactly this: routing is where a diagram stops being merely ugly and starts being *wrong*.
>
> Two rules were added that C1's research did not anticipate, both now in the note: the cases
> combine (which case applies picks the side; obstruction picks how far), and every line is
> drawn before any label (a label's plate can only cut what precedes it, so per-edge label
> rendering gets painted over — the cause of the `b)` artifacts in the 30-state render).

### Track D — Editing interactions

- [x] **D1.** Create state: double-click empty canvas. Delete: select + `Delete`.
- [x] **D2.** Drag states, with snapping and multi-select support.
- [x] **D3.** Toggle accepting (double-click a state), set start (context menu + keyboard).
- [x] **D4.** Draw a transition by dragging from a state's rim to another state, with a live
      preview edge following the cursor and a clear valid/invalid drop indication.
- [x] **D5.** Inline symbol editing on an edge — click the label, type, `Enter` commits,
      `Escape` cancels. Validates against the alphabet and offers to extend it.
- [x] **D6.** Rename a state inline; enforce label uniqueness.
- [ ] **D7.** Context menus on state, edge, and canvas.
- [ ] **D8.** Full keyboard model: `Tab` cycles states, `Enter` edits, arrows nudge,
      `Cmd/Ctrl+Z`/`Shift+Z` undo/redo, `Cmd/Ctrl+A` select all. Also the Playwright surface.
      *(All bound except `Tab` cycling, which is what remains.)*
- [x] **D9.** A discoverable `?` shortcut sheet.

> **Where Track D stands.** D1–D6 and D9 are done and driven end to end in Chromium: create,
> delete, drag, multi-drag, marquee, draw a transition, edit its symbols, rename a state.
>
> Two things came out of building it that the plan did not anticipate.
>
> **A drawn edge was silently changing what the machine is.** Committing a transition with no
> symbol makes it an ε-transition, so every edge drawn on the canvas turned a DFA into an
> ε-NFA with no indication anything had happened. Demanding a symbol mid-drag would mean a
> modal inside a gesture, so the transition commits without one and the symbol editor opens on
> it immediately.
>
> **Multi-drag sheared the selection.** Snapping each state independently sends two states
> 100px apart to grid points 96px apart, so a group deforms slightly on every drag until a
> layout somebody arranged deliberately has rearranged itself — with no moment where it looks
> broken. Only the grabbed state snaps now; the rest follow its delta.

### Track E — Panels

- [ ] **E1.** Alphabet panel: view Σ, add/remove symbols, warn before removing a symbol
      still in use and offer to delete the affected transitions.
- [ ] **E2.** Properties panel for the selection — state label, accepting, start; edge
      symbols. Deliberately thin: the canvas is the primary interface, not the panel.
- [ ] **E3.** Validation surface — a non-modal strip listing problems ("q2 has no outgoing
      transition on `b`") with click-to-focus. Never a blocking dialog.
- [ ] **E4.** Determinism indicator: a persistent badge reading **DFA** / **NFA** / **ε-NFA**,
      recomputed live. It teaches the distinction for free, every time an edit changes it.

### Track F — Input tester

- [ ] **F1.** Input bar with an accept/reject verdict.
- [ ] **F2.** Step forward/back through the run, driven by the Phase 1 `simulate` trace —
      **not** re-implemented in TypeScript. If a simulation bug can exist in two places,
      the architecture has already failed.
- [ ] **F3.** Active state(s) highlighted per design-system §2.4, with the consumed input
      prefix and remaining suffix shown as a tape.
- [ ] **F4.** NFA configuration-set view: all currently-active states highlighted at once.
      This is the view that actually explains nondeterminism.
- [ ] **F5.** Play/pause with adjustable speed.
- [ ] **F6.** A batch tester — paste many strings, get a pass/fail table.
      🔵 **LEFTOVER CANDIDATE**, though v1.1 assignment links reuse it directly.

### Track G — Layout

- [ ] **G1.** elkjs layered left-to-right auto-layout, tuned spacing (roadmap §2.5).
- [ ] **G2.** **Manual positions are never silently overwritten** (roadmap §7). Auto-layout
      is an explicit button, it animates from old to new positions so the change is legible,
      and it is undoable like any other command.
- [ ] **G3.** `d3-force` "shake it out" as a secondary button.
- [ ] **G4.** Layout runs in a Web Worker if it blocks the main thread beyond 100ms.
      🔵 **LEFTOVER CANDIDATE** — only needed if measured.

### Track H — Tests

- [ ] **H1.** Vitest over the command stack: every command's `invert` restores state exactly.
      Property-style, over random command sequences.
- [ ] **H2.** Vitest over geometry helpers — screen↔world round trip, edge clipping.
- [ ] **H3.** The C7 routing snapshots wired into CI.
- [ ] **H4.** Playwright, added this phase: build the "even number of a's" DFA entirely
      through the UI, run a string, assert the verdict. That is the exit criterion, automated.

---

## Definition of done

- [ ] The "even number of a's" DFA can be built, edited, and tested end to end in the UI.
- [ ] Undo/redo is correct across every command, including drags and deletions.
- [ ] The 12 pathological routing fixtures all render without overlap or occluded labels.
- [ ] 60fps while dragging within a 60-state automaton, measured.
- [ ] The editor is fully keyboard-operable.
- [ ] Auto-layout never destroys manual positions without an undoable, explicit action.
- [ ] Playwright e2e green in CI.
- [ ] Deferred items in [LEFTOVERS.md](../../LEFTOVERS.md).

## Known risks for this phase

| Risk | Mitigation |
|---|---|
| **Edge routing consumes the phase** | Expected. It has its own track, it goes first, and it starts with reading Graphviz rather than guessing. The 12-fixture snapshot suite is what makes it *stay* fixed. |
| Undo/redo retrofit | Commands from A3, before any interaction exists. Non-negotiable. |
| ~~SVG too slow at scale~~ **Closed 2026-08-17** | Measured, as B6 required. Continuous zoom in real Chromium holds a 16.7ms median — a solid 60fps — at 10, 30, 60 **and 120** states. Roughly double the headroom the floor asked for, so no virtualisation is needed and the fallback is not required. |
| Auto-layout destroys work | G2 is a correctness requirement, not a nicety. Layout is a command and is undoable. |
| The phase gets interrupted | Roadmap §7 designates this the interruptible one. Track order is chosen so that stopping after Track D still leaves a usable editor. |
| Simulation logic duplicated in TS | F2 forbids it. All simulation comes from wasm traces. |

## Hooks for later phases

- **F6's batch tester** is the same component v1.1 uses to run an assignment's test strings
  against a student's attempt (roadmap §9.1).
- **A5's IndexedDB persistence** is the store the v1.1 problem set records progress in;
  building it as a general document store rather than a single-slot save costs nothing now.
- **E4's determinism badge** becomes a v1.1 problem objective ("make this NFA deterministic").
