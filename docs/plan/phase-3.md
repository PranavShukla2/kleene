# Phase 3 — The conversion pipeline

**Weeks 8–9 · ~20 hrs**

> **Exit criterion:** a student who missed the lecture can learn subset construction from
> this page.

## Goal

This is the feature nobody else has, and the one the launch post is about. Everything
before it was infrastructure for this.

It is also the phase where the Phase 0 architectural bet either pays off or does not. If
`Traced<T>` was designed correctly, this phase is mostly *rendering* — the frontend reads
`steps[i]` and draws it, and the intelligence is already in Rust. If it was designed badly,
this is the phase where the reasoning has to be reverse-engineered in TypeScript, and the
project quietly becomes JFLAP with better fonts.

**A note on the exit criterion.** "A student who missed the lecture can learn from this" is
not a checkbox — it is a claim about someone else's mind, and it cannot be self-assessed.
The only honest test is to hand it to a classmate who has not covered the topic and watch
them, silently, without explaining. That test is [task H3](#track-h--validation) and it is
the real definition of done for this phase.

---

## Work breakdown

### Track A — Regex bar

- [x] **A1.** A prominent regex input, JetBrains Mono 16px, the visual focal point of the
      page. This is the app's primary input.
- [x] **A2.** Live parse on every keystroke, debounced ~150ms.
- [x] **A3.** Parse errors underline the exact offending span, using the byte spans from
      Phase 1 B3, with the human sentence shown inline. Never a red border and "invalid".
- [x] **A4.** Symbol palette for `∅`, `ε`, `|`, `*` — students on laptop keyboards should not
      have to hunt for these. Per D1, `+` and `|` both mean union; per D7 the ε/λ glyph
      follows the display setting rather than being fixed in the palette markup.
- [x] **A5.** Example regexes on the empty state, one click to load. The empty state is the
      most-viewed screen in the app; it should teach rather than sit blank.

> **Track A is closed.** `/convert` compiles as you type and draws the ε-NFA Thompson's
> construction builds.
>
> **A3 needed a mirror.** An `<input>` cannot style a range of its own text, so the real field
> sits transparent over a copy that carries the underline — same font, size and padding, written
> once, because any drift shows immediately as a misaligned mark. A zero-width span gets a
> caret-width block: "expected a symbol after `(`" legitimately points past the last character,
> and a mark of zero width is no mark at all.
>
> **The canonical form earns its place.** The core returns the expression as the *parser*
> understood it, and the bar shows it as "read as". Typing `ab+c` and seeing it come back with
> precedence made explicit is how someone discovers their assumption was wrong — which is the
> most common misunderstanding a regex bar can clear up, and it costs one line.
>
> **D1's justification surfaced verbatim.** Typing `a+` produces: *"`+` means union here, so it
> needs something on both sides. — If you meant 'one or more', write `aa*` instead of `a+`."*
> That sentence was written in `parser.rs` in Phase 1 as the argument for choosing union over
> one-or-more; it is now what a student actually reads.

### Track B — Multi-pane view

- [x] **B1.** Four panes: **regex | ε-NFA | DFA | minimal DFA**, each independently
      pannable and zoomable.
- [x] **B2.** Responsive collapse. Four panes do not fit on a 1366×768 laptop, which is the
      actual target machine (design-system §1). Default there is two panes with a selector,
      not four unreadable ones.
      🔴 **DECISION D9** — which two panes are the default pair.
- [x] **B3.** Synchronised highlight across panes: hovering anything highlights its
      counterpart everywhere it appears.
- [x] **B4.** Per-pane state counts, and a visible reduction figure on the minimal DFA
      ("11 states → 4"). That number is the entire argument for minimization.
- [ ] **B5.** Each pane is independently exportable, so a student can take just the ε-NFA
      into an assignment. 🔵 **DEFERRED to Phase 4**, which owns export — the clipboard
      handling, the TikZ writer and the SVG serializer are all its work, and building a
      pane-sized version first would be two exporters.

> **Track B is closed except B5**, which is export and belongs to Phase 4.
>
> **D9 decided, and building it changed the question.** A1 had already made the regular
> expression the page's primary input; a *pane* showing the same expression would be the input
> rendered twice, one copy not editable. So there are three diagram panes, not four — B1's
> framing over-counted by one, and that alone buys back a third of the width the decision was
> about. Default pair: ε-NFA and DFA.
>
> **B3 needed no engine change.** Subset construction already records which ε-NFA states each
> DFA state came from, in `origin`, written in Phase 1 with a comment saying that retrofitting
> provenance would mean re-deriving what the algorithm knew and threw away. This is the view
> that needed it.
>
> **A framing bug surfaced as "missing arrows".** Panes were rendering at 100% with the diagram
> running off the edge, because `fit` ran before the ResizeObserver had measured anything — and
> `fitTo` returns identity for a zero-sized box, correctly, since there is nothing to fit into.
> The symptom looked like a *routing* fault, which is a good reminder that the twelve routing
> fixtures cannot catch anything about the viewport.
>
> **Thompson produces chains, and chains need wrapping.** `(a|b)*abb` is fourteen states and
> 1300px on one line. Wrapping at eight per row took it from 32% to 57% zoom in the same box,
> with reading order preserved — which matters, because left-to-right is how a string is
> consumed.
>
> One thing was added that the plan did not have: **"edit →" on every pane**, handing that
> machine to the editor. There was no route from a converted machine to editing it by hand, and
> that gap was found by being asked about it rather than by reading the plan.

### Track C — The step scrubber

The centrepiece control of the product.

- [ ] **C1.** A scrubber bound to `Traced.steps` — drag, click, or arrow-key to any step.
- [ ] **C2.** Play/pause with adjustable speed; step transitions at 280ms
      (design-system §5), the number tuned so the eye can follow which subset became which state.
- [ ] **C3.** Keyboard: `←`/`→` step, `Space` play/pause, `Home`/`End` jump. Scrubbing is
      the interaction people will do most; it must be keyboard-first.
- [ ] **C4.** Step counter and a progress indicator: "Round 3 of 7".
- [ ] **C5.** **The reasoning panel** — plain-language text for the current step, read from
      core (Phase 1 task D4), never composed in TypeScript:
      *"Reading `a` from {q1, q3} reaches {q2, q4} — new state, added to the worklist."*
- [ ] **C6.** The diagram animates *between* steps rather than cutting. Watching a new state
      appear and connect is the thing that teaches; a cut is just a slideshow.
- [ ] **C7.** Deep-link a specific step in the URL fragment, so a TA can send a link to
      round 4 rather than saying "scrub to round 4".

### Track D — Subset construction view

- [ ] **D1.** The worklist rendered as a live queue — pending subsets, current, done. The
      worklist *is* the algorithm; showing it is most of the explanation.
- [ ] **D2.** Hovering a DFA state highlights its `origin` states in the ε-NFA pane
      (roadmap §2.3). This is the payoff for designing `origin` in at Phase 0.
- [ ] **D3.** The transition table filling in cell by cell, in step with the diagram. Half of
      students think in tables and half in diagrams; showing both, synchronised, reaches both.
- [ ] **D4.** ε-closure computation shown as its own sub-step, expanding one state at a time.
- [ ] **D5.** Visually distinguish "this subset is new" from "already seen" — the
      distinction students most reliably get wrong.

### Track E — Minimization view

- [ ] **E1.** Partition blocks rendered as visual groupings over the DFA.
- [ ] **E2.** Each refinement round shows the blocks before and after.
- [ ] **E3.** **The distinguishing string for each split, displayed prominently** — from
      Phase 1 D2. This is the thing JFLAP does not do (roadmap §1.1), the thing the exam
      asks for, and therefore the single most important element on this screen.
- [ ] **E4.** Merge animation when equivalent states collapse (420ms, design-system §5).
- [ ] **E5.** **Two switchable presentations of the same trace**, because CSE2004 teaches
      both and a student revising from their notes needs whichever one their notes use:
      the round-by-round **partition** view, and the triangular **marking table**
      (Myhill–Nerode). Neither is a secondary "alternative view" — they are peers, and the
      switch is visible rather than buried.
- [ ] **E6.** In the marking table, each marked cell shows the round it was marked and its
      distinguishing string on hover. This is where the exam's actual question lives.
- [ ] **E7.** Switching views mid-scrub keeps position — round 3 of the partition view is
      round 3 of the table. They are the same trace, so the scrubber must not reset.
- [ ] **E8.** Highlight the *pair* of states being distinguished, not just the block.

### Track F — DFA → regex

- [ ] **F1.** State elimination with the eliminated state animated out and edges relabelled.
- [ ] **F2.** The intermediate GNFA regex on each edge, updating per step. Watching an edge
      label grow from `a` to `ab*c` is the whole lesson.
- [ ] **F3.** Elimination order shown and, ideally, selectable. 🔴 **D6**
- [ ] **F4.** Final regex displayed with its simplification steps, so the tidy output does
      not look like magic.

### Track G — Cross-cutting

- [ ] **G1.** Conversions run in wasm off the main thread if any takes >50ms.
      🔵 **LEFTOVER CANDIDATE** — only if measured.
- [ ] **G2.** Trace payloads capped. A pathological regex can generate thousands of steps;
      the UI must degrade gracefully rather than freeze. 🔴 **D18**
- [ ] **G3.** Every pane, scrubber and reasoning panel is screen-reader navigable. The
      reasoning text is already prose — it is the accessible representation of the diagram,
      which is a rare and genuinely valuable position to be in.
- [ ] **G4.** `prefers-reduced-motion`: transitions become cuts, but **highlights persist**
      (design-system §5). Reduced motion must not mean reduced information.

### Track H — Validation

- [ ] **H1.** Vitest over step-rendering logic.
- [ ] **H2.** Playwright: type a regex, scrub to the last step, assert the minimal DFA's
      state count.
- [ ] **H3.** **Hand it to a classmate who has not covered subset construction. Do not
      explain anything. Watch where they get stuck.** Whatever confuses them is the phase's
      real remaining work. This is the exit criterion; the checkboxes above are only
      preconditions for attempting it.

---

## Definition of done

- [ ] Regex → ε-NFA → DFA → minimal DFA, all four visible and synchronised.
- [ ] Every step is scrubbable, with reasoning from core, and animated between states.
- [ ] Hovering a DFA state highlights its origin states in the NFA.
- [ ] Every partition split names the string that caused it, in both presentations.
- [ ] DFA → regex animates its elimination order.
- [ ] Works on a 1366×768 screen without horizontal scrolling.
- [ ] **H3 has actually been run on a real person**, and what they got stuck on is either
      fixed or written into [LEFTOVERS.md](../../LEFTOVERS.md).

## Known risks for this phase

| Risk | Mitigation |
|---|---|
| **Reasoning gets written in TypeScript** | The single most important rule of this phase. All prose comes from core (C5). If a sentence has to be assembled in the frontend, that is a missing `Step` field — fix it in Rust. |
| Four panes are unreadable on a laptop | B2, decided at design time rather than discovered at demo time. |
| Animation looks impressive and teaches nothing | Design-system principle 3: motion must show causality. A transition that does not answer "which thing became which" gets cut. |
| Trace size explodes | G2 caps it. Watch the wasm size budget too — traces cross the FFI boundary. |
| Exit criterion is self-assessed | It cannot be. H3 is a person, not a checkbox. |

## Hooks for later phases

- **C7's step deep-linking** shares the fragment codec Phase 4 formalises. Building it here
  first means Phase 4 inherits a tested encoder rather than writing one cold.
- **B5's per-pane export** is most of Phase 4's export UI, arrived at early.
- **C5's reasoning panel** is what v1.1 assignment feedback renders (roadmap §9.1).
