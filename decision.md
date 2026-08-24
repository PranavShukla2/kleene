# Decisions — the stack, and why each piece beat the obvious alternative

**Two decision files, and they answer different questions.**
[`docs/plan/DECISIONS.md`](docs/plan/DECISIONS.md) records *product* decisions — the ones where
guessing would teach students something their course does not, each numbered and each blocking
a phase until it is answered. This file records *engineering* decisions: what was chosen, what
the popular choice would have been, and what made the difference.

Neither supersedes the other. If a decision is about what the tool should teach, it belongs
there; if it is about what the tool is built out of, it belongs here.

Every entry follows the same shape, because the third line is the one that matters: a
justification that does not name what it beat is a justification you cannot check.

---

## The shape of the whole thing

```
crates/kleene-core     Rust      every algorithm, and every sentence of reasoning
crates/kleene-wasm     Rust      a thin binding layer, no logic
crates/kleene-cli      Rust      the same core, on a terminal
web/                   TS/React  the views
```

**One rule holds the design together: nothing about automata is implemented twice.** Whether a
machine is a DFA, what an empty cell in δ means, what "stuck" means during a run — each is
defined once, in Rust, and every surface asks the same question of the same code. The cost is a
build step and an FFI boundary. The thing it buys is that the browser and the command line
cannot disagree, which is the failure mode that makes a teaching tool untrustworthy.

---

## Language and runtime

### Rust for the engine — over TypeScript

**Chosen:** Rust compiled to WebAssembly.
**The obvious alternative:** write the algorithms in TypeScript and ship one language.

Three things decided it.

1. **The CLI has to exist and has to agree.** Roadmap §1.1 promises equivalence checking from a
   terminal. In a TypeScript-only world that is Node, and then the browser and the CLI are the
   same code only as long as nobody optimises one of them. In Rust it is literally one library.
2. **Property tests.** `proptest` generates 160,000 machines and checks algebraic laws —
   minimizing twice equals minimizing once, determinizing a DFA does not change its language.
   `fast-check` exists for TypeScript and is good; the difference is that exhaustive generation
   over a recursive AST is where a strong type system stops you writing the generator wrong.
3. **It is the honest choice for the subject.** These are graph algorithms over sets. A language
   with `BTreeSet`, exhaustive `match` and no `undefined` removes an entire class of bug that
   would otherwise be caught by a test I had not thought to write.

**What it cost:** a wasm build in CI, a type-generation step, and about 110KB gzipped on the
wire. All three are visible in the repo and none of them are hidden from the user.

**Not Go:** its WASM output is an order of magnitude larger (the runtime ships with it).
**Not C++:** no reason to take the memory-safety risk for an application with no legacy.

### WebAssembly — over a server API

**Chosen:** everything runs in the browser.
**The obvious alternative:** a small backend that runs the Rust and returns JSON.

A backend would have been *easier* — no wasm toolchain, no size budget, no boundary. It was
rejected for reasons that are structural rather than technical:

- **No marginal cost per user**, which is what makes "free forever" a fact about the
  architecture instead of a promise. This is written on the pricing page in exactly those terms.
- **Nothing to leak.** There is no database, so there is no breach to have.
- **No latency between a keystroke and a diagram.** The regex bar recompiles on a 150ms
  debounce; over a network that is a spinner, and the entire product is *watching* a conversion.

**The price:** no server-side rendering, so the first paint depends on JavaScript, and there is
a hard size budget (400KB gzipped, 27% used as of Phase 3).

---

## The boundary

### `serde-wasm-bindgen` — over JSON strings

**Chosen:** structured values across the FFI.
**The obvious alternative:** `serde_json::to_string` in Rust, `JSON.parse` in JS.

Traces are the main payload and they cross in bulk — a subset construction on a modest NFA is
hundreds of steps. Serialising to a string and re-parsing pays for the entire structure twice.
`serde-wasm-bindgen` builds JS values directly.

### `ts-rs` — over hand-written types, tRPC, or OpenAPI

**Chosen:** TypeScript types generated from the Rust definitions, committed, and diffed in CI.
**The obvious alternatives:** hand-written `.d.ts`; tRPC; an OpenAPI schema.

- **Hand-written drifts, and drifts silently.** The FFI stops being checked the moment the
  ambient declaration describes what you *think* Rust exports.
- **tRPC is for a client and a server.** There is no server.
- **OpenAPI is for HTTP.** There is no HTTP.

The generated files are committed so building the web app never requires a Rust toolchain, and
CI regenerates and fails on a diff — because a generated file that has drifted from its source
is worse than a hand-written one, since it carries a promise it is not keeping.

**A consequence worth naming:** `Traced<T>` exports as a real TypeScript generic. That was not
true at first — `Simulation` exists as a hand-flattened wire type from before it was — and when
the second case arrived (the ε-closure drill-down) the generic won and no algorithm since has
needed a wire type of its own. Except `Minimization`, and for a different reason: its `marks`
field is a map keyed by a *pair of state ids*, and JSON has no such key.

---

## The frontend

### React — over Svelte, Solid, or Vue

**Chosen:** React 19.
**The honest position:** Svelte or Solid would both be *faster* here, and neither was chosen.

The deciding factor was not performance, it was that the canvas is the hard part and the canvas
is plain SVG with a hand-written interaction state machine — the framework barely touches it.
What the framework does touch is thirty other components, and React's advantage there is
boring and real: the largest amount of prior art, and the largest amount of the reader's
existing knowledge if anyone else ever works on this.

**Where React actively helped:** `useSyncExternalStore`-style per-slice subscription, which is
what keeps dragging a 60-state machine at 60fps while `layout` changes and `automaton` does not.

### Vite — over Next.js

**Chosen:** Vite.
**The obvious alternative:** Next.js, which is what most people reach for.

Next.js is a framework for rendering on a server. There is no server. Everything it is good at
— SSR, ISR, server components, route handlers — is either impossible or pointless here, and
what remains is a heavier build with opinions this project cannot use.

**What was given up:** server-rendered HTML, and with it some SEO. Mitigated by the `/tools/*`
pages having real URLs, real `<title>`s, and Open Graph images, and by the app being small
enough to paint fast.

### A hand-rolled router — over React Router or TanStack Router

**Chosen:** ~120 lines reading `location.pathname`.
**The obvious alternative:** React Router (~20KB) or TanStack Router.

Eleven flat routes and exactly one parameterised segment (`/tools/<slug>`). A matcher, nested
outlets, loaders and route context would be paying for problems this app does not have.

**This one nearly went wrong, and the failure is instructive.** The router held a `Route` and
nothing else, so navigating from `/tools/nfa-to-dfa` to `/tools/minimize-dfa` handed React the
value it already had — no state change, no re-render, and the URL updated under a page that
never changed. A library would have got this right for free. The fix was to hold the *location*
and derive the route from it, plus six e2e tests, and the entry in this file is the honest
accounting: rolling your own is cheap right up until the case you did not think about.

**The line for reconsidering is written down**: a second parameterised route.

### Tailwind v4 — over CSS Modules or styled-components

**Chosen:** Tailwind v4, with every colour behind a `--color-k-*` custom property.
**The obvious alternatives:** CSS Modules; styled-components/emotion.

- **styled-components** puts styling in the JS bundle and costs runtime. For a page whose entire
  claim is that it is light, that is the wrong trade.
- **CSS Modules** would have been fine. Tailwind won on the specific grounds that this project
  has a written design system with measured contrast values, and utilities keep the distance
  between "the spec says 12px" and the code at zero.

**The important half is that the tokens are CSS custom properties, not Tailwind config.** That
is what lets the Tauri shell, exported SVG and the docs read one palette. `docs/PALETTE.md`
exists because of this and is portable to a project with no Tailwind at all.

### zustand — over Redux, Jotai, or Context

**Chosen:** zustand 5.
**The obvious alternatives:** Redux Toolkit; Jotai; plain Context.

- **Context re-renders every consumer.** Dragging a state changes `layout` and nothing else, and
  a component reading only `automaton` must not re-render for it. This is the measured
  difference between 60fps and not.
- **Redux** brings a lot of ceremony for a store that is one `History` object.
- **Jotai** is atom-shaped, and this state is document-shaped: one undo stack over one document.

**All the logic worth testing is outside the store** — `history.ts` and `commands.ts` know
nothing about React or zustand — which is what made 300+ tests possible without a renderer.

### `motion` — over GSAP or CSS-only

**Chosen:** `motion` (the successor to Framer Motion).
**The obvious alternatives:** GSAP; hand-written CSS animations.

- **GSAP** is a superb timeline engine for animations that are *choreography*. Almost nothing
  here is: it is components entering, a list reordering, a shared layout moving. That is exactly
  what `layout` and `AnimatePresence` do declaratively and GSAP does imperatively.
- **CSS-only** is what the *canvas* uses, and deliberately — every diagram animation is a
  keyframe in `styles.css` with no JS involved, because those run per algorithm step and must
  not cost a frame.

**Two vocabularies, and they never mix.** `--ease-k` has no overshoot and is used where motion
explains a computation; `--ease-k-spring` overshoots and is used on marketing pages. An
overshoot on a diagram implies a correction the algorithm did not make.

### elkjs in a Web Worker — over dagre, d3-force, or cytoscape

**Chosen:** elkjs, dynamically imported, running off the main thread.
**The obvious alternatives:** dagre; d3-force; cytoscape.js.

- **d3-force** is wrong for this: automata are layered, not organic, and a force simulation
  gives a different answer every run — which is intolerable for a diagram a student is
  comparing against their own drawing.
- **dagre** is lighter and unmaintained; elk has real layered-layout options, including
  `layerConstraint: FIRST`, which is what puts the start state on the left. Without it elk
  cheerfully put the accepting state leftmost, because it has no notion of a start state.
- **cytoscape** is a whole rendering framework, and the rendering is already written.

**It is 1.4MB, which is more than the entire rest of the app.** That is why it is dynamically
imported and in a worker: it never touches the initial bundle and never blocks a frame.

### SVG — over Canvas or WebGL

**Chosen:** SVG.
**The obvious alternative:** `<canvas>`, which is what most graph editors use.

Hit-testing for drag comes free, CSS transitions work, keyboard focus works, and SVG export
becomes almost trivial because the DOM being rendered *is* the thing to export. The performance
ceiling is lower — measured: layout crosses 100ms at around 60 states — and that ceiling is
above every machine this tool is for.

---

## Testing

### Vitest — over Jest

Same API, runs through the same Vite pipeline, no second transform config to keep in sync with
the first. There was no real argument here.

### Playwright — over Cypress

**Chosen:** Playwright, Chromium only, no retries, builds then previews.

- **No retries is deliberate.** A test that passes on the second attempt is a test that is
  telling you something, and retries are how that message gets thrown away.
- **Chromium only** for now, because the value is in catching wiring bugs, not rendering
  differences, and a matrix costs minutes per push for a class of bug this app has not had.

**Where e2e earned its place, precisely:** unit tests on the router were *right the whole time*
while two pages were silently broken. Some bugs need a real history stack and a real render.

### The property that keeps the algorithms honest

`proptest` for algebraic laws, plus differential tests that check the conversions agree with
each other — regex → NFA → DFA and regex → NFA → DFA → minimal must accept the same strings.
That is a stronger statement than any example-based test, because it does not depend on my
having thought of the right example.

---

## Storage and hosting

### IndexedDB for documents, `localStorage` for preferences

Two stores because they are two kinds of thing. Documents are work worth not losing, and
IndexedDB holds structured data without a serialisation step. Preferences are two booleans, and
reading them *synchronously* on first render is what stops the panel flashing open and then
shutting on every page load — which `localStorage` can do and IndexedDB cannot.

### Cloudflare Pages

Static hosting with a `_redirects` SPA fallback. Free, fast, and — the deciding factor — it has
no server-side execution to accidentally start depending on.

### Self-hosted fonts (`fontsource`) — over Google Fonts

The app has to work fully offline as a PWA and inside a native shell. A CDN font is a network
dependency in a product whose whole claim is that it does not have one. It also avoids sending
every visitor's IP to a third party.

---

## Type and colour

### Bricolage Grotesque + Plus Jakarta Sans + JetBrains Mono — over Inter

**Inter was there first and was removed.** It is an excellent neutral face, and neutral was
exactly the problem: a page set entirely in Inter looks like every other page set entirely in
Inter. Display sizes now carry Bricolage's flared `a`, curled `y` and eared `g`; the interface
carries Plus Jakarta's softened terminals; notation stays monospace.

**The monospace is not decorative.** Anything that is *notation* is monospace — state labels,
symbols, `ε` and `Σ`, and any number meant to be compared with another. The Greek subset is
loaded explicitly, because an epsilon falling back to a system font beside monospace labels is
instantly visible and looks broken.

**Discovered the hard way:** none of the three fonts contains `₹` (U+20B9). Measurable — each
renders it at exactly the generic fallback's width and 3px wider than its own digits. The fix
was to *choose* the substitution with a `@font-face` pinned to `unicode-range: U+20B9`, rather
than let each platform pick.

### Light and dark are different hues, not one hue dimmed

`#22D3EE` on white measures **1.81:1** and fails every contrast threshold. So light mode uses
`#0891B2` (3.68:1) and dark uses `#22D3EE` (8.9:1 on `#0F1117`). Same semantic role, two
colours, each chosen against the background it sits on. **Never derive one theme from the other
programmatically** — the rule is in `docs/PALETTE.md` because it is the one a tool will get
wrong.

---

## Architecture decisions specific to this problem

### `Traced<T>` — reasoning is a return value

Every algorithm returns its explanation alongside its result, produced in Rust beside the line
that made the move. **This is the whole product.** The alternative — a UI that reconstructs an
explanation from the result — is what every other tool does, and it is why they can show you a
minimal DFA and not why two states merged.

The consequence is that the step scrubber, the CLI's `--verbose` and the generated docs read
one array. There is no second explanation to drift out of step with the first.

### `Frame` — two integers, not a snapshot

To animate a machine being *built*, a view needs to know what existed at step *n*. The obvious
implementation is a snapshot per step. Instead: every algorithm that emits frames appends in
discovery order and never rewrites, so "what existed after step *n*" is a **prefix** — and a
prefix is two integers rather than an O(states) clone per step crossing the FFI boundary.

The prefix property is asserted in tests, because an algorithm that renumbered states mid-run
would break the animation silently rather than loudly.

### `Split` — and why `Frame` was *not* reused for minimization

Minimization was expected to reuse `Frame`. It should not. `Frame` describes a result being
**appended to**; refinement describes a partition being **divided**. Forcing one onto the other
would have produced a count that meant nothing.

So minimization has `Split` — one per step, carrying the partition as it stood, what broke, and
the pair that proved it. Two shapes, because they describe two kinds of algorithm.

### The two minimization views are derived from one fact

"Is this pair marked yet" is answered by asking whether the states sit in different blocks of
the partition at that step — *not* by reading the marking table's round number. That makes the
duality hold at every step rather than only at the end, and it sidesteps a timing bug: a round
can contain several splits, so "round 2" is not a moment.

---

## Reversals — decisions that were wrong

Kept because a reversal with its reasoning is worth more than a decision without.

| Was | Now | Why it changed |
|---|---|---|
| No "coming soon" anywhere; unbuilt features carry a phase number only | Badges say **both** | A bare phase number is precise and meaningless to anyone who has not read the roadmap. Two readers, two halves. |
| Unknown URLs fall through to the overview | A real 404 that then does what the overview would have | A visitor silently handed the front page cannot tell whether their URL was wrong or the site moved. |
| Conversion panes frame the whole layout, so a machine grows into a space already the right size | Frame the drawn content, with an eased camera | Stable, and it looked wrong: one state against the left edge of a box sized for five reads as a diagram that failed to load. |
| Router holds a `Route` | Router holds the location | Two pages of one route could not navigate between each other. |
| `Frame` will be reused for minimization | `Split`, a second shape | `Frame` describes a result being *appended to*; refinement describes a partition being *divided*. Forcing one onto the other gives a count that means nothing. |
| D18's step cap covers the pathological cases | It covers subset construction; elimination needed a **refusal** | Elimination emits one step per state, so a step cap never fires. Its blow-up is in the expression — 33 states is 177,197 characters — and a truncated expression is a wrong answer that looks like a right one. |
| `Simulation` as a hand-flattened wire type, pending a decision | `Traced<T>` exports as a generic | The second case arrived and the generic won. `Simulation` stays flattened only because `run` reads better than `result`. |

---

## Rules learned from bugs, written where they will be read

- **A data file never shares a name with its component.** `Docs.tsx` / `docs.ts` differ only in
  case; macOS resolves that and CI does not, and TypeScript reports it as an unrelated error
  while silently dropping a file from the program. Hit three times (`Examples`, `Roadmap`,
  `Docs`) before the rule was written down.
- **A value computed twice is a value that can differ.** The command palette called `grouped()`
  once for the keyboard list and once in the render; the footer counted one and the screen drew
  the other.
- **Ids that are keys must be tested for uniqueness.** Duplicate React keys do not error — they
  strand a row from a previous render in the DOM, visible and unreachable.
- **`useId()` for anything an SVG references by `url(#…)`.** Literal ids collide across
  instances, and `url(#…)` resolves to the *first* match in the document.
- **Reduced motion degrades to plain visible content, never to a faster animation.** An element
  that slides 24px in 10ms is a flicker, not an accommodation.
- **Never compare a wasm value strictly against `null`.** ts-rs types `Option<T>` as
  `T | null`, but `serde_wasm_bindgen` sends `None` across as **`undefined`**. A
  `if (x !== null)` guard is therefore true on every successful call — which made the
  elimination section render an empty refusal instead of its answer, on every run that
  worked. Test loosely (`if (x)` or `!= null`) for anything crossing the boundary.
- **A build script used in one CI job must be checked against every job that runs it.**
  Playwright's webServer ran `npm run build`, which runs `wasm-pack`, which is not installed
  in the e2e job — the server never started and all thirty tests timed out. Thirty tests
  failing looks like a problem with the tests, which is why it survived for weeks.
