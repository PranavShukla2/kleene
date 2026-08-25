# Changelog

What has shipped, in the order it shipped. Written from the commit history, which has been
kept readable as a build log since the first commit for exactly this reason.

Dates are when the work landed on `main`. Nothing here is tagged yet — `v1.0.0` is the last
item in Phase 5 — so the headings are phases rather than versions.

The site carries a shorter version of this at
[/changelog](https://kleene.pranavmshukla.in/changelog).

---

## Phase 5 — Ready for other people · in progress

_2026-08-24 onwards_

### Added

- **Twenty worked examples**, from a two-state DFA to Thompson's construction of `(a|b)*abb`,
  each with the language it recognises stated in words. They live in the Rust core, so the
  gallery, the CLI and the test suite all read the same catalogue — and every one of them is
  a fixture the property suite runs against.
- **An installable app that works offline.** The whole thing is precached, including the
  WebAssembly module and the fonts, and an end-to-end test switches the network off and opens
  a route the session has never visited.
- **An update prompt** when a new version has been fetched, rather than a silent swap or a
  stale tab that never notices.
- **An Install button** in the editor. Chrome and Edge install directly from it; Safari and
  Firefox get told where that browser keeps the option, and that there is no separate desktop
  application to download. It removes itself once the app is installed.
- **Clear the canvas** — one button, one undo to reverse. It was always `Mod+A` then
  `Backspace`, which is two keystrokes and no evidence on screen that either exists.
- **Drag a state onto the canvas**, and an editor rebuilt around one panel at a time: a rail
  replaces the permanent seven-panel column, the transition table opens along the bottom edge
  at full width, and the canvas keeps the rest.
- **A first-run tour** in the editor, three cards long and dismissed for good. It exists for
  one gesture: a transition is drawn from a state's _rim_, and someone who never learns that
  concludes the editor cannot draw transitions at all.
- **Project hygiene** — `CONTRIBUTING.md` with the four architectural rules a patch is
  expected not to break, `SECURITY.md` written against the threat model a backendless app
  actually has, the Contributor Covenant, and issue templates built around the share link.

### Fixed

- The end-to-end job in CI had been failing on every push since it was added: Playwright's
  web server ran the full build, which shells out to `wasm-pack`, which that job does not
  install. The server never started and all thirty tests timed out — a total failure wearing
  the costume of a test failure.

---

## Phase 4 — Getting work out of the tool

_2026-08-24_

### Added

- **TikZ export.** LaTeX source, not a picture, matching the on-screen layout exactly — there
  is one test that renders both and compares the geometry, because a diagram that drifts from
  the tool that drew it is worse than no export.
- **SVG and PNG export**, rendered from a clean off-screen copy rather than scraped off the
  live canvas, so the grid and the selection glow do not end up in an assignment.
- **Graphviz DOT export**, including the invisible node that gives the start arrow something
  to come from.
- **Share links.** The entire machine travels in the URL fragment, deflate-compressed — never
  sent to a server by any browser. Above the length limit it offers a file instead of
  producing a link that silently truncates.
- **Files.** Save and open `.kln`, and drop one anywhere on the editor.
- **JFLAP import.** `.jff` files open directly, so existing course materials work on day one.
  The importer reports what it had to change rather than quietly changing it.

### Changed

- Saved documents no longer carry their `origin` — the record of the expression a machine was
  generated from. It was 22–34% of a file's bytes and described where a machine came from
  rather than what it is.

---

## Phase 3 — The conversions, on screen

_2026-08-18 to 2026-08-23_

### Added

- **A regular expression bar** that compiles as you type and underlines the exact span of a
  syntax error.
- **Three synchronised panes** — ε-NFA, DFA, minimal DFA — from a single pass over what you
  typed.
- **The subset construction, animated.** States appear as they are discovered, edges draw from
  their source, and a subset that has been seen before is struck through rather than
  duplicated. The worklist drains beside it and the transition table fills in cell by cell,
  distinguishing "not worked out yet" from "no move on this symbol".
- **Minimization, both ways round** — the partition refining, and the string that caused each
  split named explicitly.
- **State elimination**, with the GNFA redrawn at every step.
- **A step scrubber** with play, speed control and deep links, so a link can point at round
  four.

### Fixed

- Every page has exactly one `main` landmark and one `h1`, with a test that says so.
- The router held only the route, not the location, so `/tools/a` → `/tools/b` did not
  re-render.

---

## Phase 2 — The editor

_2026-08-16 to 2026-08-18_

### Added

- **A canvas.** Draw states and transitions directly, drag them, select several, with undo
  across every surface that can change a document.
- **The transition table and the formal 5-tuple**, both editable, both in step with the
  diagram.
- **Simulation** — run a string one symbol at a time with the configuration set shown.
- **Live validation**: unreachable states, a partial δ, every problem clicking through to the
  state it is about.
- **Autosave** to IndexedDB, debounced, recovering on load.

---

## Phase 1 — The engine

_2026-08-16_

### Added

- Thompson's construction, subset construction, Hopcroft-style minimization and state
  elimination — every one of them returning its reasoning alongside its result.
- Counterexamples: two machines that differ report the shortest string they disagree on, and
  which way.
- A command line tool. `kleene equiv reference.kln submission.kln` exits 0 when two machines
  agree and 1 when they do not, so it can drive a grading script.
- Property tests for the algebraic laws at 10,000 cases, and a differential suite checking the
  whole pipeline against Rust's `regex` crate. This is what found the real bugs.

---

## Phase 0 — Foundations

_2026-08-15 to 2026-08-16_

### Added

- A Rust workspace, WebAssembly bindings, and TypeScript types generated from the Rust
  definitions and committed, so the web build never needs a Rust toolchain.
- A design system with measured contrast, and a motion vocabulary that separates algorithm
  steps from marketing motion.
- CI, and a wasm size budget of 400 KB gzipped enforced by it.
