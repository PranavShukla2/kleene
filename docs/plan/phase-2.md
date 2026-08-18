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
- [x] **D7.** Context menus on state, edge, and canvas.
- [x] **D8.** Full keyboard model: `Tab` cycles states, `Enter` edits, arrows nudge,
      `Cmd/Ctrl+Z`/`Shift+Z` undo/redo, `Cmd/Ctrl+A` select all. Also the Playwright surface.
- [x] **D9.** A discoverable `?` shortcut sheet.

> **Track D is closed.** Driven end to end in Chromium: create, delete, drag, multi-drag,
> marquee, draw a transition, edit its symbols, rename a state, right-click any of the three
> targets, and cycle with `Tab`.
>
> `Tab` is the one key that could not be taken globally — moving between the page's own
> controls is how anyone navigating by keyboard reaches the canvas at all. So the shortcut
> table grew a *scope*, and the canvas became genuinely focusable, which is the honest
> description of what it now is: a widget rather than a picture.
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

- [x] **E1.** Alphabet panel: view Σ, add/remove symbols, warn before removing a symbol
      still in use and offer to delete the affected transitions.
- [x] **E2.** Properties panel for the selection — state label, accepting, start; edge
      symbols. Deliberately thin: the canvas is the primary interface, not the panel.
- [x] **E3.** Validation surface — a non-modal strip listing problems ("q2 has no outgoing
      transition on `b`") with click-to-focus. Never a blocking dialog.
- [x] **E4.** Determinism indicator: a persistent badge reading **DFA** / **NFA** / **ε-NFA**,
      recomputed live. It teaches the distinction for free, every time an edit changes it.

> **Track E is closed**, and closing it removed a duplicate the architecture had been carrying
> since Phase 0.
>
> `determinism` was reimplemented in TypeScript because Phase 0 had no conversions to call
> through to, with a comment saying E4 would fix it. It now comes from wasm, along with
> `validate` — and the comment was right about why it mattered: a definition of "is this a DFA"
> living in two languages would have drifted *invisibly*. Both sides compile, both return one
> of three plausible answers, and the badge would simply have disagreed with the preconditions
> the algorithms enforce, on some machine nobody had tried.
>
> The validation strip pays off a decision made back in `validate.rs`: every problem already
> named the states it concerned, "because the editor's validation strip is click-to-focus". It
> is, and it did not need a single change to the core to become so.

### Track F — Input tester

- [x] **F1.** Input bar with an accept/reject verdict.
- [x] **F2.** Step forward/back through the run, driven by the Phase 1 `simulate` trace —
      **not** re-implemented in TypeScript. If a simulation bug can exist in two places,
      the architecture has already failed.
- [x] **F3.** Active state(s) highlighted per design-system §2.4, with the consumed input
      prefix and remaining suffix shown as a tape.
- [x] **F4.** NFA configuration-set view: all currently-active states highlighted at once.
      This is the view that actually explains nondeterminism.
- [ ] **F5.** Play/pause with adjustable speed.
- [ ] **F6.** A batch tester — paste many strings, get a pass/fail table.
      🔵 **LEFTOVER CANDIDATE**, though v1.1 assignment links reuse it directly.
- [ ] **F7.** Animate the *transition being taken*, not just the highlight moving.
      *(Added after F1–F4 shipped.)* Design-system §1.3 is the test — **"motion explains
      causality, or it doesn't happen."** The strongest causal claim the simulator makes is
      **which edge was read**, and swapping a highlight between two states does not make it:
      the student sees where the machine ended up, never how it got there. On an NFA, where
      one symbol fans a configuration out along several edges at once, the highlight simply
      appears in three new places and the reason is invisible.
      280ms, per §5's step-transition row. This is also the *only* animation that survives
      principle §1.3 — animating ordinary edits would fail it.

> **Track F is closed**, and it cost less than the plan budgeted because Phase 1 had already
> done the hard part. `simulate.rs` returns a configuration per point in the run, a verdict
> with *three* values, and a sentence of prose per step — all written before there was any UI
> to consume them. The tester walks that; it computes nothing.
>
> Two details that were already right in the core and would have been easy to get wrong here:
>
> **`Run::consumed_at` lives in Rust**, with a comment saying the tape's split point is a
> function of the run rather than of the display. It is: an ε-transition advances a
> configuration without consuming a symbol, so `input.slice(step)` is wrong on exactly the
> machines this tool exists to explain.
>
> **`Verdict` has three values.** `Stuck` is not `Rejected` — one string was read to the end
> and landed somewhere non-accepting, the other ran out of moves partway and the rest was never
> looked at. The tape shows the difference without a word of explanation.
>
> F4 needed no work at all. Configurations are sets, so an NFA lights up every state it could
> be in at once — which is the same picture as the subset construction, as `simulate.rs` says.
>
> One thing this track *did* surface: `Traced<T>` is generic and has no TypeScript name, so the
> boundary now carries a flattened `Simulation`. That is the first of these. Phase 3 exposes
> several more traced algorithms, and the choice between a wire type per algorithm and teaching
> ts-rs to emit a generic belongs there, where there is more than one case to look at.

### Track G — Layout

- [x] **G1.** elkjs layered left-to-right auto-layout, tuned spacing (roadmap §2.5).
- [x] **G2.** **Manual positions are never silently overwritten** (roadmap §7). Auto-layout
      is an explicit button, it animates from old to new positions so the change is legible,
      and it is undoable like any other command.
- [x] **G3.** `d3-force` "shake it out" as a secondary button.
- [x] **G4.** Layout runs in a Web Worker if it blocks the main thread beyond 100ms.
      ~~🔵 **LEFTOVER CANDIDATE**~~ — **measured, and needed.**

> **Track G is closed.** The conditional task turned out to be required, which is the useful
> kind of answer to get from a measurement.
>
> G4 was written as "only needed if measured", so it was measured — 14ms at 10 states, 42ms at
> 30, **104ms at 60**, 360ms at 120, 1651ms at 250. It crosses the 100ms line at exactly the
> size Track B chose for its frame-rate floor, so the two independent measurements agree about
> what counts as a large teaching automaton. Using elk's worker build also takes the 1.4MB off
> the main thread's bundle entirely: the app imports a 5KB shim and the worker fetches the
> algorithm.
>
> **The start state has to be pinned to the first layer.** elk lays out by graph structure and
> has no idea which state is special; an automaton is full of back edges, so which state lands
> leftmost depends on how the cycles happened to be broken. The first run put the accepting
> state on the left and the start state in the middle — not merely ugly, since reading left to
> right is how a student follows a string through the machine.
>
> **G3 is repulsion only, hand-written rather than `d3-force`.** A general force simulation
> solves a harder problem: it would also pull *connected* states together, fighting the
> arrangement someone deliberately made. What is wanted after a few drags is separation, and
> separation alone — and a test now asserts that spread-out states are left untouched, so
> nobody later "improves" it into a simulation.

### Track I — The other two representations

*Added mid-phase, after roadmap §2.4a. Not scope creep: a finite automaton is taught in three
notations, converting between them is an examined skill, and Phase 2 was shipping one of the
three. The data is already in the document — this is presentation, and it is cheap.*

- [x] **I1.** Transition table: rows are states, columns are Σ (plus an ε column when the
      machine has ε-transitions), cells hold the target set. Start and accepting states marked
      in the row header with the same `→` and `*` convention textbooks use, so the table reads
      the way a printed one does.
- [x] **I2.** The table is **editable**. Click a cell, type targets, `Enter` commits — the same
      inline-edit contract as edge labels, and the same commands underneath. Read-only would
      make it a report; typing a target is how a large share of people prefer to build a dense
      DFA, and it is faster than drawing one.
- [x] **I3.** Selection is shared with the canvas, both ways. Clicking a row selects the state
      on the diagram; selecting on the diagram highlights the row. Two views of one object that
      disagree about what is selected are two objects.
- [x] **I4.** Formal definition panel: `M = (Q, Σ, δ, q₀, F)` with each component expanded, and
      δ presented as the table rather than restated. This is the thing exams ask for verbatim.
- [x] **I5.** Both render through `notation.rs` (D7), never through hard-coded glyphs. Courses
      disagree about `ε` vs `λ` and `∅` vs `{}`, and a tool that quietly picks the other
      convention is harder to learn from than one that picks none.
- [ ] **I6.** Copy the table as TSV, so it pastes into a spreadsheet or a LaTeX `tabular`.
      🔵 **LEFTOVER CANDIDATE** — cheap, but Phase 4 owns export properly.

> **Track I is closed except I6**, which is export and belongs to Phase 4.
>
> The table went into the *core*, not the frontend. Grouping transitions by `(from, symbol)` is
> four lines of TypeScript, so difficulty was never the reason — three of the decisions are
> semantic rather than presentational: whether an ε column exists, what an empty cell means,
> and which glyph stands for the empty string. Answering those in the view layer would put half
> the definition of δ in the code that draws it, and the CLI and TikZ exporter would each need
> their own answer.
>
> Two decisions the build forced that the task list did not anticipate:
>
> **An empty machine reports δ *incomplete*.** Vacuous truth says a machine with no states has
> a total transition function. That is technically defensible and useless to someone staring at
> a blank canvas.
>
> **A table edit is the same command as a canvas edit.** Cells commit through `setEdgeSymbols`,
> so undo does not care which surface the edit came from — and the undo button reads "Undo edit
> transition" either way. Two editing surfaces that produced different history entries would be
> two tools sharing a document.

### Track J — The workbench shell

*Added mid-phase, from roadmap §2.8. The editor works; it is arranged like a document. On the
1366×768 laptop design-system §1.5 names as the target, a centred `max-w-5xl` column spends a
third of the width on margins while the canvas — the product — is squeezed into what is left.*

- [x] **J1.** Full-bleed layout: one compact command bar, canvas filling everything under it,
      no page margins and no footer competing with the tool.
- [x] **J2.** Collapsible side panel. **The diagram is the only permanent surface** — closing
      everything leaves a canvas and a command bar, which is design-system §1.1 restated as
      geometry.
- [x] **J3.** The panel's open/closed state persists, because a preference that resets every
      session is not a preference. Same store, same IndexedDB, alongside the theme.
- [x] **J4.** Viewport controls float over the canvas rather than occupying a strip. Vertical
      pixels on a 768px screen are the scarcest thing on it.
- [x] **J5.** The validation strip docks to the bottom of the canvas, not below the fold. A
      problem list you have to scroll to find is a problem list nobody reads.
- [x] **J6.** Keyboard: a chord to toggle the panel, in the shortcut table like everything else.
- [x] **J7.** Responsive fallback under `lg` — the panel becomes a sheet over the canvas rather
      than a column beside it, so the tool is usable on a tablet without a second layout.

> **Track J is closed.** Measured on the machine design-system §1.5 names: the canvas went
> from roughly 800×480 inside a centred column to **1078×658** full-bleed, on the same
> 1366×768 laptop. Collapsing the panel takes it to 1366×658.
>
> Two things fell out that were not on the list.
>
> **The title block and the hint paragraph went away.** Both were explaining gestures that the
> `?` sheet documents properly and that roadmap §2.8 assigns to a first-run tour. A paragraph
> nobody reads twice is not worth a permanent row on a 768px screen.
>
> **`min-h-0` is load-bearing.** Without it a flex child refuses to shrink below its content
> height, and the canvas pushes the status bar off the bottom of the window. Worth recording
> because the symptom — a status bar that is simply not there — looks nothing like its cause.

### Track K — The front door, early

*Pulled forward from Phase 5 at the project owner's request: something showable, so that
everything built after it can be seen and checked rather than described. The **shell** moves;
the plan does not. Phase 5 Track E still owns the finished landing page, and Track C still owns
the real example gallery — they now fill in a page that exists instead of creating one.*

**The rule that makes this honest:** every feature named on the page is either working, or
carries a marker saying *which phase it lands in*. Not "coming soon" — a vague badge scattered
over a page is a worse lie than an empty page, because it promises everything and dates
nothing. A visitor should be able to tell, at a glance, what they can use today.

- [x] **K1.** A route split: `/` is the overview, `/editor` is the workbench. A hand-rolled
      pathname router, not a routing library — three routes do not justify 20KB, and roadmap
      §6.1 already wants `/tools/*` pages later, so the seam is worth having early.
- [x] **K2.** SPA fallback for the host, so a deep link to `/editor` is not a 404.
- [x] **K3.** Hero with a **real automaton already rendered** — the component the editor uses,
      not a screenshot (roadmap §5, Phase 5 E1).
- [x] **K4.** What it does, as a feature grid, each item tagged with its status and phase.
- [x] **K5.** The JFLAP comparison table from roadmap §1.3 — the clearest single statement of
      why this exists.
- [x] **K6.** Examples strip: what the gallery will be, populated from the engine's built-in
      examples so it is real rather than mocked, and marked as growing in Phase 5.
- [x] **K7.** The account-free promise stated plainly and once: work stays in this browser
      (roadmap §2.8, Phase 5 E7).
- [x] **K8.** No render-blocking wasm. The overview must paint before the engine arrives — it
      is the page a first-time visitor sees on a bad connection (Phase 5 E4).

> **Track K is closed.** `/` is the overview, `/editor` is the workbench, and an example opens
> in one click from either a card or a URL.
>
> **K8 verified rather than assumed:** the overview page requests no `.wasm` at all. The hero
> automaton is a six-line literal instead of an engine call, precisely so the one thing a
> first-time visitor is guaranteed to see cannot wait on a 400KB module.
>
> Two things fell out that were not on the list.
>
> **`?example=` beats autosave recovery.** Someone who clicked a specific machine asked for
> *that* machine; silently restoring their last session would look like the link was broken.
> With no example in the URL, recovery wins — that is the ordinary return visit. Neither
> ordering is obviously right until the other one is tried.
>
> **This is also what makes the tool checkable.** Every feature built after this can be aimed
> at a real machine in one click rather than one that has to be hand-drawn first, which was the
> actual complaint behind "build the UI first".

### Track H — Tests

- [x] **H1.** Vitest over the command stack: every command's `invert` restores state exactly.
      Property-style, over random command sequences.
- [x] **H2.** Vitest over geometry helpers — screen↔world round trip, edge clipping.
- [x] **H3.** The C7 routing snapshots wired into CI.
- [x] **H4.** Playwright, added this phase: build the "even number of a's" DFA entirely
      through the UI, run a string, assert the verdict. That is the exit criterion, automated.

> **Track H is closed, and two of its four tasks were already done.**
>
> **H3 needed no work at all.** The twelve routing snapshots are vitest tests, and CI has run
> `vitest run` since the start of the phase — so they have been gating merges the whole time.
>
> **H1 needed less than it looked.** The property test was there, running 200 random command
> sequences under a fixed seed. Its *pool*, though, was written when the pool was the whole
> command set, and four commands had been added since — three of them batches. A pool that
> stops being extended turns a property into a guarantee about the oldest code and silence
> about the newest, which is exactly backwards.
>
> **H4 caught a mistake on its first green run, and the mistake was in the test.** `aab` was in
> the rejected list; it has two a's. Writing the assertions as membership questions about a
> *language* rather than as expected outputs of a code path is what made that visible — you can
> be wrong about a language in a way you cannot be wrong about a snapshot.

---

## Definition of done

- [x] The "even number of a's" DFA can be built, edited, and tested end to end in the UI.
- [x] The same machine reads correctly as a transition table and as a formal 5-tuple, and the
      table can build it just as well as the canvas can.
- [x] The editor fills the window on a 1366×768 laptop, with the canvas as the largest thing
      on screen and every panel closable.
- [x] Undo/redo is correct across every command, including drags and deletions.
- [x] The 12 pathological routing fixtures all render without overlap or occluded labels.
- [x] 60fps while dragging within a 60-state automaton, measured.
- [x] The editor is fully keyboard-operable.
- [x] Auto-layout never destroys manual positions without an undoable, explicit action.
- [x] Playwright e2e green in CI.
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
