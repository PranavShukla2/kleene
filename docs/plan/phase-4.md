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

- [ ] **A1.** `io/tikz.rs` in core, taking automaton + layout. The first core function that
      needs layout, so it takes it as a parameter rather than storing it — **`kleene-core`
      still does not know what a pixel is** (roadmap §2.3).
- [ ] **A2.** Coordinate mapping: 96px → 2.4cm, per design-system §4.4. Chosen so what the
      student arranged on screen is what comes out, with no fudge factor.
- [ ] **A3.** Self-loops: `loop above/below/left/right`, direction chosen by free space —
      the same rule the renderer uses, so the export matches the screen.
- [ ] **A4.** Bidirectional pairs → `bend left` / `bend right`.
- [ ] **A5.** Multi-symbol edges collapsed to `a, b`.
- [ ] **A6.** Label escaping: `_`, `^`, `{`, `}`, `\`, `$`, `#`, `&`, `%`, `~`. A label
      containing `q_{0}` must not produce a LaTeX compile error, because a student who hits
      one will not debug it — they will go back to drawing by hand.
- [ ] **A7.** Emit the required `\usepackage{tikz}` and `\usetikzlibrary{automata,positioning}`
      as a comment header. The most common failure is a correct picture that will not compile
      in the user's document.
- [ ] **A8.** `insta` snapshot tests over all of the above (roadmap §2.7).
- [ ] **A9.** **Compile the snapshot outputs with a real LaTeX pass in CI.** Snapshot tests
      prove the output did not change; they do not prove it ever compiled.
      🔵 **LEFTOVER CANDIDATE** — a TeX toolchain in CI is slow. If cut, compile them
      manually once per release and say so in LEFTOVERS.

### Track B — TikZ UI

- [ ] **B1.** Export panel with the TikZ source in a monospace pane, syntax-highlighted.
- [ ] **B2.** Copy button with real feedback.
- [ ] **B3.** Live preview that updates as the diagram is edited.
      🔴 **DECISION D16** — a real preview needs a LaTeX renderer in the browser, which is
      a large dependency and fights the 400 KB wasm budget. The alternatives are a rendered
      SVG approximation (honest, cheap, slightly inaccurate) or no preview at all.
- [ ] **B4.** A visible note on which packages the snippet requires.

### Track C — Raster and vector export

- [ ] **C1.** SVG export. Nearly free — the renderer already produces the DOM to export
      (roadmap §2.5), which is why SVG was chosen over Canvas in the first place.
- [ ] **C2.** Inline the computed styles and embed the font subset, so the exported file
      renders identically outside the app. An SVG that only looks right inside Kleene is not
      an export.
- [ ] **C3.** PNG export at 1×/2×/3×, with a transparent-background option.
- [ ] **C4.** Export honours the current theme, but **defaults to the light palette** —
      exports go into white documents, and a dark-mode user will otherwise paste a black
      rectangle into their assignment without noticing.
- [ ] **C5.** Copy-image-to-clipboard as well as download.

### Track D — Documents

- [ ] **D1.** `.kln` save and load, round-tripping layout and metadata.
- [ ] **D2.** Format frozen and documented at `docs/formats/kln.md`. 🔴 **DECISION D8** —
      this is the last moment it can change freely. After the first shared link exists, every
      change needs a migration path.
- [ ] **D3.** Version field respected on load, with a clear error for a future version rather
      than a silent misparse.
- [ ] **D4.** Drag-and-drop a file onto the canvas to open it.

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

- [ ] **F1.** `document → JSON → deflate (CompressionStream) → base64url → location.hash`
      (roadmap §2.6).
- [ ] **F2.** **Fragment, never a query parameter.** It never reaches a server, so there is
      no privacy story to explain and no infrastructure to run.
- [ ] **F3.** Size check with a `.kln` download fallback above ~8 KB (roadmap §2.6).
- [ ] **F4.** Copy-link button with a visible character count, so the limit is never a
      surprise.
- [ ] **F5.** Round-trip property test: any document survives encode → decode unchanged.
- [ ] **F6.** `CompressionStream` fallback for browsers lacking it.
      🟡 **ASSUMPTION** — baseline is Safari 16.4+ / Chrome 80+ / Firefox 113+. Below that,
      an uncompressed base64 fragment, which is larger but works.
- [ ] **F7.** Restoring from a link must never silently discard the current document.

### Track G — Graphviz DOT

- [ ] **G1.** `io/dot.rs` export (already built in Phase 1 F3 — wire up the UI).
- [ ] **G2.** Snapshot tests.

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
