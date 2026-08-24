# Phase 4 — Export and share

**Week 10 · ~10 hrs**

> **Exit criterion:** you use it for an actual assignment submission and it saves you time.

## Goal

The highest value-per-line-of-code week in the project (roadmap §2.7). Nothing here is
algorithmically hard; all of it is what turns a demo into a tool someone uses on a Tuesday
night because the alternative is fighting TikZ at 2am.

The exit criterion is the most honest one in the roadmap because it cannot be faked. Either
an assignment got submitted using it or it did not.

---

## Work breakdown

### Track A — TikZ export *(do this first)*

Roadmap §2.7 calls it the single highest-value feature per line of code in the whole
project, and that is correct — it is the one output nothing else in this space produces.

- [x] **A1.** `io/tikz.rs` in core, taking automaton + layout. The first core function that
      needs layout, so it takes it as a parameter rather than storing it — **`kleene-core`
      still does not know what a pixel is** (roadmap §2.3).
- [x] **A2.** Coordinate mapping: 96px → 2.4cm, per design-system §4.4. Chosen so what the
      student arranged on screen is what comes out, with no fudge factor.
- [x] **A3.** Self-loops: `loop above/below/left/right`, direction chosen by free space —
      the same rule the renderer uses, so the export matches the screen.
- [x] **A4.** Bidirectional pairs → `bend left` / `bend right`.
- [x] **A5.** Multi-symbol edges collapsed to `a, b`.
- [x] **A6.** Label escaping: `_`, `^`, `{`, `}`, `\`, `$`, `#`, `&`, `%`, `~`. A label
      containing `q_{0}` must not produce a LaTeX compile error, because a student who hits
      one will not debug it — they will go back to drawing by hand.
- [x] **A7.** Emit the required `\usepackage{tikz}` and `\usetikzlibrary{automata,positioning}`
      as a comment header. The most common failure is a correct picture that will not compile
      in the user's document.
- [x] **A8.** `insta` snapshot tests over all of the above (roadmap §2.7).
- [ ] **A9.** **Compile the snapshot outputs with a real LaTeX pass in CI.** Snapshot tests
      prove the output did not change; they do not prove it ever compiled.
      🔵 **LEFTOVER CANDIDATE** — a TeX toolchain in CI is slow. If cut, compile them
      manually once per release and say so in LEFTOVERS.

### Track B — TikZ UI

- [x] **B1.** Export panel with the TikZ source in a monospace pane, syntax-highlighted.
- [x] **B2.** Copy button with real feedback.
- [x] **B3.** Live preview that updates as the diagram is edited.
      🔴 **DECISION D16** — a real preview needs a LaTeX renderer in the browser, which is
      a large dependency and fights the 400 KB wasm budget. The alternatives are a rendered
      SVG approximation (honest, cheap, slightly inaccurate) or no preview at all.
- [x] **B4.** A visible note on which packages the snippet requires.

**Tracks A and B closed but for A9.**

**A3 required writing one rule twice, and that is recorded rather than hidden.** The
"which side is a self-loop free on" rule lives in TypeScript (`web/src/canvas/geometry.ts`)
because the renderer needs it every frame of a drag, and now in Rust because the exporter needs
it without a renderer. Routing the renderer through wasm to ask would put an FFI call in a drag
loop. `matches_the_renderer` in `io/tikz.rs` restates the renderer's own cases against the Rust
copy — it is what holds them together, and it is written to fail loudly rather than let them
drift into a student's assignment not looking like their screen.

**One thing the plan did not anticipate: the coordinates needed shifting.** The canvas lays a
machine out from (90, 130), so an unshifted export carried coordinates like (2.25, -3.25) —
arbitrary-looking because they were. Relative positions are the promise; the absolute origin is
an editor detail. The export now puts the top-left at the origin, and a test translates a whole
layout to assert the output is byte-identical.

Carried forward:

| # | What | Why it is not done | Where it goes |
|---|---|---|---|
| **A9** | Compile the snapshots with a real LaTeX pass in CI | Already flagged as a leftover candidate in the task itself: a TeX toolchain in CI is slow. No LaTeX on this machine either, so it has not been done manually yet. Snapshot tests prove the output did not *change*; they do not prove it ever compiled — that gap is real and open. | Before v1, manually if not in CI |

### Track C — Raster and vector export

- [x] **C1.** SVG export. Nearly free — the renderer already produces the DOM to export
      (roadmap §2.5), which is why SVG was chosen over Canvas in the first place.
- [x] **C2.** Inline the computed styles and embed the font subset, so the exported file
      renders identically outside the app. An SVG that only looks right inside Kleene is not
      an export.
- [x] **C3.** PNG export at 1×/2×/3×, with a transparent-background option.
- [x] **C4.** Export honours the current theme, but **defaults to the light palette** —
      exports go into white documents, and a dark-mode user will otherwise paste a black
      rectangle into their assignment without noticing.
- [x] **C5.** Copy-image-to-clipboard as well as download.

**Track C closed, and C1's "nearly free" was optimistic.**

The DOM being SVG is what made it *possible* — Canvas would have meant a second renderer — but
three things stood between "serialize the element" and an export worth having, and all three
were invisible in the panel:

1. **The whole canvas came out.** The editor's SVG is a viewport, far larger than the machine
   in it, so the file was a small drawing marooned in white.
2. **The session came out with the machine** — pan, zoom, and the input tester's highlight on
   whichever state it was sitting on.
3. **The PNG had no labels.** `decode()` resolves before an SVG's embedded `@font-face` has
   loaded, so the raster was taken too early. The SVG opened directly looked perfect, which is
   exactly what made it hard to see.

**The fix for the first two was to stop scraping the live canvas.** The panel renders a second,
clean copy off-screen — no selection, no active states, no grid — and exports that. Stripping
chrome from a serialized clone meant *guessing* which attributes were interface, and the crop
comes free because `AutomatonView` already fits its viewBox to the layout.

**C2's font embedding costs ~28KB per SVG and is worth it.** A monospace fallback has different
advance widths, so labels stop being centred in their circles — a diagram that is subtly and
unfixably wrong in someone else's document. Only the Latin subset travels; a Greek label falls
back to a slightly different epsilon, which is a different kind of wrong from a broken layout.

### Track D — Documents

- [x] **D1.** `.kln` save and load, round-tripping layout and metadata.
- [x] **D2.** Format frozen and documented at `docs/formats/kln.md`. 🔴 **DECISION D8** —
      this is the last moment it can change freely. After the first shared link exists, every
      change needs a migration path.
- [x] **D3.** Version field respected on load, with a clear error for a future version rather
      than a silent misparse.
- [x] **D4.** Drag-and-drop a file onto the canvas to open it.

**Track D closed. D8 is answered — the format is frozen at version 1, with `origin` no longer
written.**

The freeze turned out cheap, because the versioning rule already said that *adding an optional
field never bumps the version*. So it narrowed to one question — is anything in the format
wrong enough that it would later have to come out? — and `origin` was the only candidate: it
names states of a machine the file does not contain, and measured 22–34% of a document, growing
with size, against a URL-fragment budget of a few kilobytes.

It is stripped on the **document**, not on the wire type. The same shape crosses the
WebAssembly boundary, where the source machine *is* present and `origin` is exactly what makes
the hover-highlight work. Reading a file that has it still keeps it.

**The load path is tested by trying to break it.** A file that fails to open must leave the
open document alone — someone who drags the wrong file onto their work has made a small
mistake, and losing an hour of drawing to it would be a much larger one. Four e2e tests throw
a future version, a dangling transition and plain text at it and assert the canvas is
unchanged each time.

One thing the plan did not anticipate: **documents cross the boundary through a JSON string**,
unlike everything else here. `layout` is keyed by state id and JavaScript object keys are
always strings, so `serde_wasm_bindgen` produced `invalid type: string "0", expected u32` — and
going the other way would have written a JS `Map` where the frontend expects a plain object.
The wasm crate's header argues against JSON strings for *traces*, which cross in bulk; a
document crosses when someone presses Save.

### Track E — `.jff` import (the migration path)

Roadmap §1.3: *"this is how you take users from an incumbent — you make switching free."*

- [ ] **E1.** `io/jff.rs` — parse JFLAP's XML.
- [ ] **E2.** Map JFLAP's model onto Kleene's, including its coordinate system and its state
      id conventions.
- [ ] **E3.** Handle the constructs v1 does not support (PDA, TM, grammars) with a **clear,
      specific message** — "this file contains a pushdown automaton, which Kleene does not
      support yet" — not a parse failure. The person hitting this is exactly the user being
      courted; the error is a first impression.
- [ ] **E4.** Fixture tests against every `.jff` file findable in public course repos
      (roadmap §3.2). 🔴 **DECISION D14** — the corpus needs real files.
- [ ] **E5.** Import from the file picker, drag-and-drop, and the CLI.
- [ ] **E6.** 🔵 **LEFTOVER CANDIDATE** — `.jff` *export*. Not needed for migration in the
      direction that matters, but it removes lock-in as an objection, which is worth
      something when pitching a professor.

### Track F — URL sharing

- [x] **F1.** `document → JSON → deflate (CompressionStream) → base64url → location.hash`
      (roadmap §2.6).
- [x] **F2.** **Fragment, never a query parameter.** It never reaches a server, so there is
      no privacy story to explain and no infrastructure to run.
- [x] **F3.** Size check with a `.kln` download fallback above ~8 KB (roadmap §2.6).
- [x] **F4.** Copy-link button with a visible character count, so the limit is never a
      surprise.
- [x] **F5.** Round-trip property test: any document survives encode → decode unchanged.
- [x] **F6.** `CompressionStream` fallback for browsers lacking it.
      🟡 **ASSUMPTION** — baseline is Safari 16.4+ / Chrome 80+ / Firefox 113+. Below that,
      an uncompressed base64 fragment, which is larger but works.
- [x] **F7.** Restoring from a link must never silently discard the current document.

**Track F closed. F7 turned out to be a bug rather than a policy.**

The task reads as a rule to follow — "restoring from a link must never silently discard the
current document" — and implementing it surfaced something worse. **A link differing from the
current page only by its fragment does not reload the page.** So clicking a share link while
already in the editor did nothing at all, for exactly the person most likely to click one.

Handled on `hashchange` as well as on mount, and *always* as an offer there: by definition
there is a document on screen someone has been looking at.

**F6's fallback was being taken silently, and the marker is what caught it.** The payload
carries one character saying whether it was compressed. Under jsdom `CompressionStream` exists
while the Blob plumbing beneath it does not, so the unit suite was taking the uncompressed path
while asserting nothing about which path ran. A browser check confirmed real compression: 284
characters for the default machine, against 356 of raw JSON.

**The `origin` decision paid for itself here.** Dropping it from documents (D8) took roughly a
third off every link, against a budget where a third matters.

### Track G — Graphviz DOT

- [x] **G1.** `io/dot.rs` export (already built in Phase 1 F3 — wire up the UI).
- [x] **G2.** Snapshot tests. Two, written in Phase 1 alongside the exporter — this track
      added nothing to them because the exporter did not change.

**Track G closed, and it really was the hour the estimate said.** The exporter existed; this
was a binding, a line in the engine surface, and a tab. The only design decision was that DOT
shares the LaTeX panel rather than getting its own: both are *source* rather than a picture,
both go into something already open, and both want copy before download. A near-copy of the
component would have been two places to fix the next time either changed.

The note under it says Graphviz lays the machine out itself, because that is the one
surprising thing here — the positions in the file are not the ones on the canvas, and TikZ
directly above it promises the opposite.

---

## Definition of done

- [ ] TikZ output compiles, unmodified, in a real LaTeX document.
- [ ] SVG and PNG exports render correctly outside the app.
- [ ] A shared link reconstructs the exact document, layout included.
- [ ] A `.jff` file from a real course repo imports and renders correctly.
- [ ] `.kln` format is frozen and documented.
- [ ] **An actual assignment has been submitted using output from this tool.**

## Known risks for this phase

| Risk | Mitigation |
|---|---|
| TikZ output does not compile | A6 escaping and A7 package headers are the two failure modes; A9 compiles it in CI if the toolchain is affordable. A student who hits a LaTeX error goes back to drawing by hand and does not return. |
| Exported SVG looks wrong elsewhere | C2 inlines styles and fonts. Test in a browser with the app closed. |
| Dark-mode users export black rectangles | C4 defaults exports to light. |
| `.kln` changes after links exist | D2 freezes it this week. This is the deadline. |
| `.jff` corpus is unrepresentative | D14 — real files from real courses, not hand-written samples. |

## Hooks for later phases

- **F1's codec** is exactly what v1.1 assignment links reuse (roadmap §9.1). If it is
  written generally — encoding *a payload* rather than *a document* — v1.1 costs a weekend.
  If it hardcodes the document shape, v1.1 pays to generalise it. Write it generally.
- **A1's layout-as-parameter** signature is what keeps core pure while still exporting
  positioned diagrams, and it is the pattern any future exporter follows.
