# Kleene — Production Roadmap

**A browser-native automata theory workbench.**
Rust core → WebAssembly → web app, plus a native CLI and offline desktop build from the same codebase.

- **Repo:** `PranavShukla2/kleene`
- **Hosted at:** `kleene.pranavmshukla.in`
- **Owner:** Pranav Shukla
- **Status:** planning
- **Target v1 ship:** ~12 weeks at 8–12 hrs/week

---

## 1. What you are actually building

### 1.1 The problem

Every CS department on earth teaches a formal languages / theory of computation course. Nearly all of them point students at **JFLAP** — a Java desktop application whose interaction model dates to the early 2000s. It requires a JRE install, has no meaningful export story, and nothing built in it can be shared with a link.

Three concrete pains, all of which you have personally felt this semester:

1. **Nothing is shareable.** A student who wants to ask a TA "why is my DFA wrong?" has to screenshot it or email a `.jff` file.
2. **Diagrams have to be redrawn by hand for assignments.** Students hand-draw state diagrams in Word, or fight with TikZ syntax at 2am, or paste a low-res screenshot into a PDF.
3. **The tools give answers, not reasoning.** JFLAP will minimize a DFA. It will not show you *which input string distinguished the two states you thought were equivalent*. For a subject where the exam asks you to *show the partition refinement rounds*, that is the thing that matters.

### 1.2 The product

A single-page web app where you can:

- Draw an automaton directly on a canvas, or type a regular expression and have one built for you
- Read and edit the same machine as a **transition table**, and see its **formal 5-tuple**
  definition, both kept in step with the diagram
- Watch a conversion happen **step by step** — every round of subset construction, every partition split — with the reasoning attached to each step
- Run an input string and watch the configuration set move through the machine
- Export the diagram as **TikZ**, SVG, or PNG
- Share the entire automaton as a **URL** — no account, no server storage
- Work fully **offline** as an installed PWA, or as a ~6 MB native desktop app
- Do all of the above from a **CLI**, so a professor can autograde 200 submissions

### 1.3 The five things that make it different from JFLAP

| | JFLAP | Kleene |
|---|---|---|
| Install | JRE + jar download | Open a URL |
| Sharing | Email a `.jff` file | Copy a link |
| LaTeX | None | One-click TikZ |
| Explanation | Shows the result | Shows every step and *why* |
| Automation | None | CLI with equivalence checking |

**Migration path:** Kleene imports `.jff` files. Existing JFLAP users and existing course materials work on day one. This is how you take users from an incumbent — you make switching free.

### 1.4 What v1 explicitly does NOT include

Write this on a sticky note.

- ❌ Pushdown automata
- ❌ Turing machines
- ❌ Context-free grammars, CYK, CNF conversion
- ❌ Accounts, login, cloud save, any backend at all
- ❌ Student rosters, class enrolment, cloud-stored student work
- ❌ Collaborative editing
- ❌ Mobile-first editing (view + run on mobile is fine; editing is desktop)

All of these are good v2 ideas. Shipping v1 with them is how the project dies in November.

The classroom and gamification features people will ask for are not excluded forever — see
§9. They are excluded from *v1*, and when they do arrive they arrive without a backend.

---

## 2. Architecture

### 2.1 The central design decision

**Every algorithm returns its reasoning alongside its result.**

```rust
pub struct Traced<T> {
    pub result: T,
    pub steps: Vec<Step>,
}
```

This is not a UI feature bolted on later. It is the shape of the core library. `determinize()` does not return a DFA; it returns a DFA *and* the ordered list of subset-construction rounds that produced it, each with the subset being expanded, the symbol being read, the resulting ε-closure, and whether the target subset was new or already seen.

The frontend then does something almost trivial: it renders `steps[i]` and gives you a scrubber. All the intelligence lives in Rust, is unit-testable without a browser, and is equally available to the CLI.

Everything the product is good at falls out of this one decision. Make it in week 1, not week 8.

### 2.2 Workspace layout

```
kleene/
├── Cargo.toml                  # workspace root
├── crates/
│   ├── kleene-core/            # pure algorithms, zero I/O, zero pixels
│   │   ├── src/
│   │   │   ├── automaton.rs    # Automaton, State, Transition, Alphabet
│   │   │   ├── regex/
│   │   │   │   ├── lexer.rs
│   │   │   │   ├── parser.rs   # recursive descent → AST
│   │   │   │   └── thompson.rs # AST → ε-NFA
│   │   │   ├── convert/
│   │   │   │   ├── epsilon.rs  # ε-closure, ε-removal
│   │   │   │   ├── subset.rs   # NFA → DFA
│   │   │   │   ├── minimize.rs # partition refinement + Hopcroft
│   │   │   │   └── to_regex.rs # state elimination (GNFA)
│   │   │   ├── ops.rs          # complement, product, union, intersection
│   │   │   ├── equiv.rs        # Hopcroft–Karp equivalence
│   │   │   ├── counterexample.rs  # shortest string two machines disagree on
│   │   │   ├── simulate.rs     # step-by-step execution traces
│   │   │   ├── trace.rs        # Step, Traced<T>
│   │   │   └── io/
│   │   │       ├── json.rs     # canonical .kln format
│   │   │       ├── jff.rs      # JFLAP import
│   │   │       ├── tikz.rs     # LaTeX export
│   │   │       └── dot.rs      # Graphviz export
│   │   └── tests/
│   │       └── properties.rs   # proptest suite
│   ├── kleene-wasm/            # thin wasm-bindgen wrapper
│   └── kleene-cli/             # clap binary
├── web/                        # Vite + React + TypeScript
│   ├── src/
│   │   ├── canvas/             # SVG renderer, drag, hit-testing
│   │   ├── layout/             # elkjs auto-layout
│   │   ├── panels/             # step scrubber, input tester, export
│   │   ├── store/              # zustand + undo stack
│   │   └── wasm/               # generated bindings + loader
│   └── public/examples/        # ~20 preloaded automata
├── desktop/                    # Tauri v2 shell
└── docs/                       # docs site (Astro Starlight)
```

**Why a workspace and not four repos:** one `cargo test` runs everything, one version number, atomic changes across the FFI boundary. Danish's emulator work is a good reference point here — the value is in the core crate; the browser is one of several front ends.

### 2.3 Core types

Geometry deliberately lives **outside** the semantic model. `kleene-core` does not know what a pixel is.

```rust
pub type StateId = u32;

#[derive(Clone, Serialize, Deserialize)]
pub struct Automaton {
    pub alphabet: Vec<Symbol>,
    pub states: IndexMap<StateId, State>,
    pub start: StateId,
    pub transitions: Vec<Transition>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct State {
    pub label: String,
    pub accepting: bool,
    /// Provenance: which states of the source machine produced this one.
    /// Set by subset construction and minimization; drives the UI's
    /// "this DFA state came from {q1, q3, q4}" tooltip.
    pub origin: Option<BTreeSet<StateId>>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Transition {
    pub from: StateId,
    pub to: StateId,
    /// None = epsilon
    pub on: Option<Symbol>,
}
```

The `origin` field is small and does a lot of work. It is why the UI can show a subset-construction result where hovering a DFA state highlights the corresponding NFA states. Design it in now; retrofitting it is painful.

The document format layers presentation on top:

```jsonc
{
  "version": 1,
  "automaton": { /* semantic model above */ },
  "layout": { "0": { "x": 120, "y": 200 }, "1": { "x": 300, "y": 200 } },
  "meta": { "title": "Even number of a's", "created": "2026-08-15" }
}
```

### 2.4 Algorithms in v1

| Algorithm | Notes |
|---|---|
| Regex lexer + recursive-descent parser | Precedence: alternation < concatenation < postfix (`*`, `+`, `?`). Support `∅`, `ε`, grouping. |
| Thompson construction | AST → ε-NFA. Clean, produces the diagram students are taught. |
| ε-closure | Worklist algorithm. Traced — show the closure growing. |
| Subset construction | NFA → DFA. Traced per round. |
| Partition refinement (Moore) | **Primary** minimizer. O(n²·\|Σ\|) is irrelevant at teaching sizes, and it's what your syllabus teaches — so it's the one that must be explainable. |
| Hopcroft minimization | Secondary, for the CLI on large inputs. Not traced. |
| Completion / trap state | Needed before complement. |
| Product construction | Union, intersection, difference. |
| Hopcroft–Karp equivalence | Union-find, near-linear. Powers the CLI autograder. |
| **Counterexample search** | Symmetric difference by product construction, then BFS from the start state to the nearest accepting state of the product. Returns the shortest string the two machines disagree on, and which one accepts it. Both halves are already in this table — this is assembly, not new theory. Powers the CLI's grading output and every form of student feedback in the app. |
| State elimination → regex | DFA → regex. Arden's theorem territory; heavily taught, poorly tooled. |
| Simulation | NFA config-set stepping, DFA single-state stepping, with full trace. |
| Reachable / co-reachable pruning | Dead state removal. |

### 2.4a The three representations

A finite automaton is taught three ways, and a tool that shows only one teaches only one:

| Representation | What it is | Where students meet it |
|---|---|---|
| **Diagram** | A drawing of δ | Lectures, textbooks, the thing everyone pictures |
| **Transition table** | δ written out as a function | Exams, homework, every proof that manipulates δ directly |
| **5-tuple** | `M = (Q, Σ, δ, q₀, F)` | The formal definition; "give the formal definition of the machine below" |

These are not three views of the product. They are **the same object in the three notations
the subject actually uses**, and converting between them by hand is itself an examined skill.
The table is not a convenience pane bolted onto the diagram — it is the definition of δ, and
the diagram is a picture of it.

Two consequences for the build:

- **The table is editable.** Read-only would make it a report. Typing a target into a cell is
  how half the population prefers to build a machine, and for a dense DFA it is genuinely
  faster than drawing.
- **Notation is a setting, not a constant.** Courses disagree about `ε` vs `λ`, about `∅` vs
  `{}`, about whether δ is total. `notation.rs` already exists for exactly this (D7); the table
  and the tuple render through it rather than hard-coding glyphs.

### 2.5 Frontend stack, with reasons

| Choice | Why not the obvious alternative |
|---|---|
| **Vite + React + TS** | Not Next.js. There is no server, no SSR, no routes worth pre-rendering, and Next's bundler makes WASM loading fiddly. This is a static SPA; Vite is the correct tool and ships a smaller bundle. You already know React — that transfers. |
| **SVG rendering, not Canvas** | Hit-testing for drag is free, CSS transitions work, keyboard focus works, and **SVG export becomes almost trivial** because you're already producing the DOM you want to export. Automata are <100 nodes; the DOM cost is a non-issue. |
| **elkjs** for auto-layout | Layered left-to-right layout reads correctly for automata. `d3-force` is the wrong mental model (automata aren't a physics sim) but is worth adding as a secondary "shake it out" button. |
| **Zustand + explicit command stack** | It's an editor, so undo/redo is table stakes. Model edits as commands from day one rather than diffing state later. |
| **Tailwind** | With your existing identity: `#0D9488` teal, JetBrains Mono for state labels and the regex input. |
| **vite-plugin-pwa** | Full offline. The whole app is static assets + one `.wasm`. This is genuinely a good PWA candidate, unlike most. |
| **Tauri v2** for desktop | ~6 MB bundle vs Electron's ~100 MB. Reuses the exact same `dist/`. The comparison to JFLAP's JRE requirement writes itself. |

### 2.6 URL sharing

```
document → JSON → deflate (CompressionStream) → base64url → location.hash
```

Use the **fragment**, not a query parameter — it never reaches a server, which means sharing has no privacy story to explain and no infrastructure to run. Typical automaton compresses to 300–800 bytes; browsers handle fragments far larger. Above ~8 KB, fall back to offering a `.kln` file download.

### 2.7 TikZ export

The single highest-value feature per line of code in the whole project.

```latex
\begin{tikzpicture}[shorten >=1pt, node distance=2.4cm, on grid, auto]
  \node[state, initial]           (q0)              {$q_0$};
  \node[state, accepting]         (q1) [right=of q0] {$q_1$};
  \path[->]
    (q0) edge              node {a} (q1)
         edge [loop above] node {b} ()
    (q1) edge [bend left]  node {b} (q0);
\end{tikzpicture}
```

Handle correctly: self-loops (`loop above/below/left/right` chosen by free space), bidirectional pairs (`bend left`/`bend right`), multi-symbol edges collapsed to `a, b`, and label escaping. Snapshot-test the output with `insta`.

---

### 2.8 The shell: how the tool is arranged

Two surfaces, and they are not the same product:

**The workbench is full-bleed.** Not a page with a tool on it — the tool *is* the page. One
compact command bar across the top, the canvas filling everything below it, side panels that
collapse, and viewport controls floating over the canvas rather than sitting in a strip that
costs vertical space. Design-system §1.5 fixes the target as a 1366×768 laptop; a centred
`max-w-5xl` column throws away a third of that width on margins, and §1.4 ("density over
decoration") already says a student comparing four panes needs information per pixel.

The rule that keeps it coherent: **the diagram is the only permanent surface.** Every panel is
collapsible, nothing else is load-bearing, and closing everything leaves a canvas and a
command bar. That follows from §1.1 — chrome recedes, the automaton does not.

**The front door is a different product.** Someone who has never seen this needs to know what
it is and be *using* it within one click, without an account:

- A landing page with a **working automaton already on screen** — the thing itself, not a
  screenshot of it.
- An **example gallery**: curated machines, each tagged with what it demonstrates and how hard
  it is, each opening in the editor in one click.
- A **first-run tour** in the editor, skippable and never shown twice. Kleene's gestures are
  discoverable but not obvious — dragging from a state's *rim* draws a transition — and a tool
  that requires reading the shortcut sheet before the first success has already lost most of
  its audience.

When the teaching layer arrives (§9), the account-free path stays first-class and stays
**honest about what it lacks**: no saved work across devices, no assignments, no progress. A
signed-out mode that hides its own limits is worse than one that states them.

---

## 3. Testing strategy

This section is disproportionately important — it is what makes the repo read as engineering rather than coursework.

### 3.1 Property-based testing (`proptest`)

Generate random regular expressions, then assert invariants that must hold across every representation:

```rust
proptest! {
    #[test]
    fn all_representations_agree(re in arb_regex(), input in arb_string()) {
        let nfa   = thompson(&parse(&re)?);
        let dfa   = determinize(&nfa).result;
        let min   = minimize(&dfa).result;

        let a = nfa.accepts(&input);
        prop_assert_eq!(a, dfa.accepts(&input));
        prop_assert_eq!(a, min.accepts(&input));
    }

    #[test]
    fn minimization_is_idempotent(re in arb_regex()) {
        let m1 = minimize(&determinize(&thompson(&parse(&re)?)).result).result;
        let m2 = minimize(&m1).result;
        prop_assert!(equivalent(&m1, &m2));
        prop_assert_eq!(m1.states.len(), m2.states.len());
    }

    #[test]
    fn roundtrip_through_regex(re in arb_regex()) {
        let dfa  = minimize(&determinize(&thompson(&parse(&re)?)).result).result;
        let back = to_regex(&dfa);
        let dfa2 = minimize(&determinize(&thompson(&parse(&back)?)).result).result;
        prop_assert!(equivalent(&dfa, &dfa2));
    }

    #[test]
    fn counterexample_is_always_a_real_witness(a in arb_regex(), b in arb_regex()) {
        let (x, y) = (dfa_of(&a)?, dfa_of(&b)?);
        match counterexample(&x, &y) {
            // Disagreement means exactly one of them accepts the witness.
            Some(w) => prop_assert_ne!(x.accepts(&w), y.accepts(&w)),
            // No witness may be withheld: none returned must mean none exists.
            None    => prop_assert!(equivalent(&x, &y)),
        }
    }
}
```

That third one — regex → DFA → regex → DFA must be equivalent — is a genuinely strong test. It will find bugs in your state elimination that no hand-written test would.

The fourth is what keeps the counterexample engine honest in both directions. A witness that
is not actually a disagreement is a lie told to a student who is already confused, and a
withheld witness turns "correct" into a claim the tool cannot back up.

### 3.2 Other layers

- **Differential testing** against Rust's `regex` crate on the subset of syntax both support
- **Snapshot tests** (`insta`) for TikZ, DOT, and JSON output
- **Fixture tests** against every `.jff` file you can find in public course repos
- **Vitest** for frontend logic, **Playwright** for one critical e2e path: type a regex → convert → export TikZ
- **WASM size budget** enforced in CI (fail the build above 400 KB gzipped)

---

## 4. CI/CD

**`ci.yml`** on every PR:
`cargo fmt --check` → `cargo clippy -- -D warnings` → `cargo test --workspace` → `wasm-pack build` → size check → `vitest` → `playwright`

**`deploy.yml`** on main: build web, deploy to Cloudflare Pages (free, fast, good global edge — matters for an international student audience).

**`release.yml`** on tag: cross-compile the CLI for `x86_64-linux`, `aarch64-darwin`, `x86_64-windows`; build Tauri bundles for all three; attach to a GitHub Release. Publish `kleene-core` to crates.io.

---

## 5. Milestones

Assume 8–12 hrs/week alongside coursework, SIH, and EPICS.

### Phase 0 — De-risk the toolchain (Week 1)

Do the scary part first. Nothing here is throwaway; it's the skeleton.

- [ ] Cargo workspace, three crates, CI green on an empty test
- [ ] `kleene-wasm` exports one function; React calls it and gets a value back
- [ ] Hardcoded 3-state DFA renders as SVG in the browser
- [ ] Deployed to Cloudflare Pages at a real URL

**Exit criterion:** a URL you can send someone that renders a DFA. Ugly is fine.

### Phase 1 — Core engine (Weeks 2–4)

Headless. No UI work at all this phase.

- [ ] Regex lexer + parser + AST
- [ ] Thompson construction
- [ ] ε-closure, subset construction — both `Traced`
- [ ] Partition refinement — `Traced`
- [ ] Simulation with traces
- [ ] Hopcroft–Karp equivalence
- [ ] Counterexample search — shortest string on which two machines disagree
- [ ] `kleene-cli`: `convert`, `minimize`, `equiv`, `run`, `export`
- [ ] proptest suite passing at 10k cases

**Exit criterion:** `kleene equiv student.kln reference.kln` works from a terminal, prints the shortest disagreeing string under `--counterexample` when the two differ, and the property tests pass.

### Phase 2 — The editor (Weeks 5–7)

The longest and least glamorous phase. Budget honestly.

- [ ] SVG canvas: pan, zoom, grid
- [ ] Create/delete/drag states; double-click to toggle accepting; set start
- [ ] Draw transitions by dragging between states; edit symbols inline
- [ ] Self-loops and bidirectional edge routing that doesn't look broken
- [ ] Alphabet panel
- [ ] Undo/redo via command stack
- [ ] Input tester: type a string, step forward/back, watch the active state set
- [ ] elkjs auto-layout button
- [ ] **Transition table**, editable, kept in step with the diagram (§2.4a)
- [ ] **Formal 5-tuple** panel, rendered through the notation setting

**Exit criterion:** you can build and test the "even number of a's" DFA end to end without touching a config file — **and read it back as a table and as a 5-tuple**.

### Phase 3 — The conversion pipeline (Weeks 8–9)

This is the feature nobody else has. It's what the launch post is about.

- [ ] Regex input bar → live ε-NFA
- [ ] Multi-pane view: regex | ε-NFA | DFA | minimal DFA
- [ ] Step scrubber driven by `Traced.steps`
- [ ] Each step shows plain-language reasoning: *"Reading `a` from {q1, q3} reaches {q2, q4} — new state, added to the worklist."*
- [ ] Hover a DFA state → highlight its `origin` states in the NFA pane
- [ ] Partition refinement view: show each round's blocks and the distinguishing string that split them
- [ ] DFA → regex via state elimination, with the elimination order animated

**Exit criterion:** a student who missed the lecture can learn subset construction from this page.

### Phase 4 — Export and share (Week 10)

- [ ] TikZ export with a copy button and a live preview
- [ ] SVG and PNG export
- [ ] `.kln` save/load
- [ ] **`.jff` import** (JFLAP migration path)
- [ ] URL sharing with compression
- [ ] Graphviz DOT export

**Exit criterion:** you use it for an actual assignment submission and it saves you time.

### Phase 5 — Ship v1 (Weeks 11–12)

- [ ] PWA: offline manifest, install prompt, service worker
- [ ] Tauri desktop builds for three platforms
- [ ] ~20 curated example automata, loadable in one click, presented as a **gallery** — each
      tagged with what it demonstrates and how hard it is (§2.8)
- [ ] Docs site: getting started, the algorithms, CLI reference, `.kln` format spec
- [ ] Landing page — with a working automaton already on screen, no signup, no upload
- [ ] First-run tour in the editor: skippable, never shown twice (§2.8)
- [ ] `CONTRIBUTING.md`, issue templates, MIT or Apache-2.0 license
- [ ] Launch

**Exit criterion:** v1.0.0 tagged and public.

### Post-v1 (only if v1 gets used)

CFG editor + CYK + CNF conversion → PDA → Turing machines → autograder mode with rubric output → LMS-friendly batch grading → Moore/Mealy machines → pumping lemma game.

---

## 6. Distribution

The part student projects skip. Build time is maybe 20% of whether this succeeds.

### 6.1 Search

People actively search for a way out of JFLAP. Own those queries with pages that are *working tools with the input prefilled*, not blog posts:

- `/tools/nfa-to-dfa` — converter, loaded with an example
- `/tools/regex-to-nfa`
- `/tools/dfa-minimizer`
- `/tools/dfa-to-regex`
- `/jflap-alternative` — honest comparison, `.jff` import front and centre
- `/tools/dfa-to-latex` — the TikZ generator as its own destination

Each is a landing page and a real tool simultaneously. That's the whole SEO strategy.

### 6.2 Faculty

Faculty adoption is what turns a tool into a department standard, and the CLI autograder is the wedge — it saves them hours, which no student-facing feature does.

1. **Dr. Paras Jain first.** You took CSE2004. A tool that uses his terminology and his partition-refinement method has an obvious pitch, and one adopting professor gives you a real user cohort and a testimonial.
2. Then: find TOC course pages that link to JFLAP. Those pages are exactly the backlinks you want. Email the instructor — short, specific, lead with TikZ export and the autograder, link a shared automaton so they can see it work in one click.

### 6.3 Community

- **Show HN** — the step-through subset construction is the hook, not the feature list
- r/compsci, r/ProgrammingLanguages, r/rust (the Rust→WASM angle plays well there)
- lobste.rs
- `awesome-compilers`, `awesome-wasm`, `awesome-rust` PRs
- A short blog post on `pranavmshukla.in` in your existing voice: *"Property-testing an automata library, or: how regex → DFA → regex found my bugs"*

### 6.4 Measurement

Umami or Plausible — cookieless, no banner, no privacy story to defend. Track: unique visitors, tool pages by referrer, TikZ exports, share-links created, GitHub stars, known faculty adoptions.

You want these numbers because "3,000 students used this last semester" is a resume line and "I built an automata tool" is not.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| **Scope creep into PDA/TM** | The v1 exclusion list in §1.4 is a hard line. Open GitHub issues for them and close the mental loop. |
| **Classroom scope creep** | Every §9 feature is static files or CLI — no exceptions. "No backend" is the same kind of hard line §1.4 is for PDA/TM, and it holds even when the feature would clearly be nicer with a server. A database enters this project only when a named professor asks for something specific enough to justify it. |
| **Edge routing looks bad** | This is the single biggest UX risk and it's easy to underestimate. Budget the full three weeks of Phase 2. Study how Graphviz handles self-loops and parallel edges before writing your own. |
| **Auto-layout produces spaghetti** | elkjs layered mode with tuned spacing; always let the user drag afterwards; persist manual positions so layout never overwrites intent. |
| **You abandon it mid-build** | Phases 0–1 alone produce a publishable Rust crate with a strong property-test suite. Every phase boundary is a defensible stopping point. Never be more than two weeks from something shippable. |
| **Nobody uses it** | Then it is still a Rust + WASM + algorithms portfolio piece with real tests. But §6 is why that shouldn't happen — distribution is planned, not hoped for. |
| **Semester crunch** | Phase 2 is the interruptible one. If SIH or exams hit, pause there, not mid-Phase-1. |
| **Naming** | Don't use "JFLAP" in the product name or domain. Comparison pages are fine and normal; trading on their name is not. |

---

## 8. How to talk about it

**Resume:**
> **Kleene** — Automata theory workbench. Rust core compiled to WebAssembly, shared by a browser app, native CLI, and desktop build. Implements Thompson construction, subset construction, partition-refinement minimization, and Hopcroft–Karp equivalence, with every algorithm emitting a step-by-step trace consumed by the UI. Wrong answers are never reported as merely wrong — a counterexample search over the product automaton returns the shortest input string on which two machines disagree, and the direction of the error. Property-tested with proptest across all machine representations. *N users across M universities.*

**The interview answer to "what was hard about it":**
Not the algorithms — they're in every textbook. The hard part was designing the core library so that *explanation* was a first-class output rather than a UI afterthought. Once `determinize()` returned its reasoning alongside its result, the browser step-through, the CLI's verbose mode, and the docs examples all came from one source of truth. And the regex → DFA → regex round-trip property test found three bugs in state elimination that hand-written tests missed entirely.

That is a systems-design answer, not a coursework answer. It's the whole reason to build this.

---

## 9. Teaching layer (v1.1 / v1.2)

Two things people will ask for the moment this is usable: *can my professor set problems
with it*, and *can it be more fun than a textbook*. Both are reasonable. Both are also the
fastest available route to a rewrite, an on-call rotation, and a legal obligation.

So this section has exactly one organising constraint:

> **Every feature here ships with zero backend.** No accounts, no database, no student PII.
> Kleene stays static files on a CDN.

Three reasons, stated plainly so they are not quietly relitigated at 1am in week 14:

1. **Student data is not a thing to collect casually.** A class list is a set of named
   individuals, frequently minors, and holding it pulls in DPDP, FERPA and GDPR obligations
   simultaneously. Those are real duties with real penalties, and they are not duties a solo
   undergraduate should be signing up for in exchange for a feature.
2. **A backend is an uptime promise, and the promise comes due at the worst time.** The hour
   a submission deadline lands is the hour the server must be up, and that hour is
   statistically the same week as your own finals. A static file on a CDN has no such week.
3. **Nobody needs permission to run a binary.** A teacher cannot adopt a new LMS without
   institutional sign-off, procurement, and a data-protection review. A teacher can adopt a
   CLI tool this afternoon, without asking anyone. The zero-backend version is not the
   compromised version; it is the version that can actually be adopted.

### 9.1 Teacher workflow, without an LMS

**Assignment links.** A problem spec — target language, optional maximum state budget,
optional alphabet restriction — encoded into the URL fragment with the same compression
scheme as §2.6. The teacher writes the problem once and sends a link. The student opens it,
builds a machine, and the equivalence check runs client-side against the spec.

Be honest about what this is: **client-side means the answer is inspectable**. A student who
opens devtools can read the target. That makes this a practice and self-check mode, and it
is a genuinely good one — instant feedback, unlimited attempts, no submission anxiety. It is
not a graded assessment, and it should never be described as one.

**Graded work goes through the CLI.**

```
kleene grade submissions/ --against reference.kln --format csv
```

Batch-grade a directory into whatever gradebook the institution already mandates. The
reference automaton never leaves the professor's machine, so there is nothing to inspect.
This is also where the counterexample engine earns its place twice over: the CSV can carry
*why* each submission failed, not just that it did, which is the difference between a grade
and feedback.

**GitHub Classroom.** A template repository plus a GitHub Action that runs `kleene equiv` on
push. Many CS departments already run GitHub Classroom; this uses infrastructure they have
rather than asking them to adopt infrastructure they do not. It is also the cheapest thing
in this entire section to build — it is a workflow file.

### 9.2 Gamification, domain-native only

The rule, first: **no XP, no badges, no streaks, no leaderboards.** Generic point systems
are filler bolted onto content that could not hold attention on its own, and students read
them as exactly that. They also cost real implementation time and teach nothing.

Every mechanic below is instead a real property of the subject, machine-checkable, and
already something the course asks students to do.

| Mechanic | Why it works |
|---|---|
| **Counterexample feedback** | Ships in v1 (§2.4). The foundation everything else stands on: an attempt can always be told the shortest specific string it gets wrong, and in which direction. |
| **State-budget challenges** | *"Accept this language in ≤ 4 states."* Minimality is decidable, so the constraint is real rather than arbitrary — the tool can prove the bound is achievable and prove the student hit it. Automata golf, with a verifier. |
| **Pumping lemma game** | Implemented literally as the adversarial game it is already taught as: the machine picks *n*, the student picks *w*, the machine decomposes into *xyz*, the student picks *i*. Aimed squarely at the students who can recite the lemma and cannot apply it — which is most of them. |
| **Ordered problem set** | ~20 problems in difficulty order, *"strings ending in `ab`"* through *"binary numbers divisible by 3"*. Progress in `localStorage`. |

The pumping lemma game is the one worth building even if nothing else here gets built. It is
the topic students most reliably fail, the failure is always the same failure — treating a
proof about an adversary as a formula to memorise — and an adversary is precisely the thing
software is good at being.

### 9.3 Sequencing

| Version | Contents | Cost |
|---|---|---|
| **v1** | Counterexample engine only. | Already in §2.4; no additional scope. |
| **v1.1** | Assignment links + the ordered problem set. | One weekend. Both are the §2.6 share format with a different payload. |
| **v1.2** | Pumping lemma game + state-budget golf. | The only genuinely new interaction work in this section. |
| **Anything with a database** | Only when a real professor asks, with specific requirements. | Not estimated, deliberately. |

That last row is not a refusal. A professor arriving with specific requirements is the
strongest validation signal this project can receive, and it should be treated as such —
answered, scoped, and taken seriously. The point is that the requirements come *first*. A
database built in anticipation of a user is how a static site becomes a service nobody asked
for; a database built for a named professor with a stated need is a product decision.
