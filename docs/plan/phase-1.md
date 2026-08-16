# Phase 1 — Core engine

**Weeks 2–4 · ~30 hrs**

> **Exit criterion:** `kleene equiv student.kln reference.kln` works from a terminal, prints
> the shortest disagreeing string under `--counterexample` when the two differ, and the
> property tests pass.

## Goal

Every algorithm in v1, headless, traced, and property-tested. **No UI work at all this
phase** — not a stylesheet, not a component. The temptation to "just check how it looks"
is what turns a three-week phase into a five-week one.

At the end of this phase the project is already a publishable Rust crate with a real
property-test suite. That is the point of doing it second: it is the first defensible
stopping point if the semester goes sideways (roadmap §7).

---

## Notation, as decided

These were settled before any code was written (see [DECISIONS.md](DECISIONS.md)), because
each one is a choice about what the tool *teaches* rather than how it is built, and each one
is expensive or impossible to reverse once documents and share-links exist.

| | Decision | Consequence for this phase |
|---|---|---|
| **D1** | `+` means **union**; `\|` is a synonym; one-or-more is `aa*` | B2 parses it this way. B3 owes a dedicated error for postfix `+`. |
| **D2** | Alphabet symbols are **single characters** | `Symbol` stays `String` so widening later is a parser change, not a migration. |
| **D3** | **Both** minimization methods are taught | D1 implements refinement; D3 derives the marking table from its trace. |
| **D4** | Subset states are labelled **`A`, `B`, `C`** | Provenance goes in the legend, hover, table and prose — carried by `origin`. |
| **D7** | The empty string is **ε**, as a display setting | Never a hard-coded constant; every surface reads the setting. |

D1's error message is worth writing out, since it is the whole justification for the choice:
a user who types `a+` expecting Kleene plus must be told *"`+` means union here. For
one-or-more, write `aa*`."* — a loud, teachable failure, rather than the silent wrong machine
the other convention produces for `a + b`.

---

## Work breakdown

### Track A — Foundations

- [ ] **A1.** `trace.rs` — `Traced<T>`, `Step`, and the step-kind enum. Written **first**,
      before any algorithm, so nothing is ever written untraced (roadmap §2.1).
      `Traced<T>` gets `map`, `and_then`, and `Deref` to `T` so chaining conversions does
      not turn into a pile of `.result`.
- [ ] **A2.** `automaton.rs` — `Automaton`, `State`, `Transition`, `Symbol`, `StateId`.
      `IndexMap` for deterministic iteration order — **required**, because
      non-deterministic iteration makes traces non-reproducible and snapshot tests flaky.
      Includes `origin: Option<BTreeSet<StateId>>` from the first commit.
- [ ] **A3.** Alphabet handling, epsilon representation (`Option<Symbol>`, `None` = ε),
      and the ε/λ display setting (D7) — a setting from the start, never a constant.
- [ ] **A4.** Validation: `Automaton::validate()` returning structured errors — unreachable
      start, transitions on symbols outside Σ, dangling state ids. Every constructor path
      goes through it.
- [ ] **A5.** Builder API ergonomic enough that a test can express a 4-state DFA in 6 lines.
      Every test in this phase depends on this being pleasant.

### Track B — Regex front end

- [ ] **B1.** `regex/lexer.rs` — tokens, positions retained for error spans.
- [ ] **B2.** `regex/parser.rs` — recursive descent. Precedence: alternation <
      concatenation < postfix. Supports grouping, `∅`, `ε`. `+` and `|` both parse as
      union (D1).
- [ ] **B3.** Parse errors carry a byte span and a human sentence, not "unexpected token".
      The regex bar in Phase 3 underlines the offending character using this. **Includes the
      postfix-`+` message** — this error is the entire reason D1 chose union, so shipping the
      parser without it forfeits the argument.
- [ ] **B4.** `regex/thompson.rs` — AST → ε-NFA, **traced**: one step per AST node,
      recording the fragment constructed and why.
- [ ] **B5.** `Display` for the AST that round-trips through the parser — needed by the
      `to_regex` property test, and by the UI to show a normalized form.

### Track C — Conversions

- [ ] **C1.** `convert/epsilon.rs` — ε-closure by worklist, **traced** so the closure can
      be shown growing one state at a time.
- [ ] **C2.** ε-removal producing an equivalent ε-free NFA, traced.
- [ ] **C3.** `convert/subset.rs` — subset construction, **traced per round**. Each step
      records: the subset being expanded, the symbol read, the resulting ε-closure, and
      whether the target was new or already seen. `origin` is populated here — this is what
      makes Phase 3's hover-highlight possible. States are labelled `A`, `B`, `C` with the
      subset carried in `origin` (D4).
- [ ] **C4.** Reachable / co-reachable pruning, traced. Dead-state removal.
- [ ] **C5.** Completion with an explicit trap state — required before complement.
      Whether the trap state is *shown* by default is a UI question. 🔴 **D5**, Phase 2.

### Track D — Minimization

- [ ] **D1.** `convert/minimize.rs` — **Moore partition refinement**, traced. Each step
      records the partition before, the block being split, the symbol that split it, and the
      resulting blocks. This is the engine; both taught presentations render from its trace
      (decision D3, answered).
- [ ] **D2.** The **distinguishing string** for each split, reconstructed and attached to
      the step. This is the single highest-value line in the whole engine: it is exactly
      what the roadmap §1.1 identifies as the thing JFLAP will not tell you, and what the
      exam actually asks for. It is not free — it needs a witness back-pointer maintained
      through refinement — and it must not be dropped when the week gets tight.
- [ ] **D3.** **Derive the Myhill–Nerode marking table from the refinement trace.** Both
      methods are taught in CSE2004, so both must be renderable — but table-filling is the
      *dual* of refinement, not a second algorithm: a pair is marked at round *k* exactly
      when it first falls into different blocks at round *k*. Emitting the table from the
      trace means one implementation to keep correct, and it reuses D2's back-pointer for
      the per-pair witness.
- [ ] **D4.** Human-readable step rendering: *"Reading `a` from block {q1, q3} reaches two
      different blocks, so {q1, q3} splits into {q1} and {q3}. The string `ab` is accepted
      from q1 but not from q3."* Generated in **core**, not in the frontend, so the CLI's
      verbose mode and the docs get it for free. Prose names the subset, not just the
      label: *"block B = {q1, q3}"*.
- [ ] **D5.** Hopcroft minimization — untraced, for the CLI on large inputs. Property-tested
      to agree with the primary minimizer on state count.

### Track E — Analysis and operations

- [ ] **E1.** `convert/to_regex.rs` — state elimination via GNFA. Traced, with the
      eliminated state and the resulting relabelled edges per step. 🔴 **D6**
- [ ] **E2.** Regex simplification pass — `(a|a)` → `a`, `a∅` → `∅`, `ε·r` → `r`, nested
      star collapse. Without it, state elimination emits regexes hundreds of characters long
      and the feature is unusable in practice. 🔵 **LEFTOVER CANDIDATE**: the aggressive
      rules. The four listed above are mandatory.
- [ ] **E3.** `ops.rs` — complement, product construction (union, intersection, difference).
- [ ] **E4.** `equiv.rs` — Hopcroft–Karp with union-find. Near-linear; the fast path that
      answers only *are these the same language*.
- [ ] **E5.** `counterexample.rs` — **the shortest string two machines disagree on.**
      Symmetric difference by product construction, then BFS from the product's start state
      to its nearest accepting state. BFS, not DFS: the shortest disagreement is the whole
      point, and a long one is nearly useless to a confused student.
      Returns the string *and the direction* — "`abba` should be accepted, your machine
      rejects it" — because the direction is half the diagnostic information.
      Both halves of this already exist by the time it is written (E3 product construction,
      C-track determinization), so it is assembly rather than new theory.
- [ ] **E6.** `simulate.rs` — DFA single-state stepping and NFA configuration-set stepping,
      both fully traced, with per-step accept/reject/stuck status.

### Track F — I/O

- [ ] **F1.** `io/json.rs` — the canonical `.kln` format, versioned from v1.
- [ ] **F2.** Format spec written to `docs/formats/kln.md` **as the format is implemented**,
      not afterwards. It is a public format the moment the first share-link exists.
      🔴 **D8** (freeze before Phase 4).
- [ ] **F3.** `io/dot.rs` — Graphviz DOT export, snapshot-tested.
- [ ] **F4.** `io/tikz.rs` deferred to Phase 4 — it needs layout data, which does not exist
      until Phase 2.

### Track G — CLI

- [ ] **G1.** `kleene convert` — regex → NFA/DFA/minimal, `--to`, `--from`.
- [ ] **G2.** `kleene minimize`, `kleene run <automaton> <string>`, `kleene export`.
- [ ] **G3.** `kleene equiv a.kln b.kln` — exit code 0/1 for scripting, and under
      `--counterexample` prints the shortest disagreeing string from E5 with its direction.
      **This is the autograder wedge** (roadmap §6.2). Exit codes make it scriptable; the
      counterexample makes its output worth reading.
- [ ] **G4.** `--verbose` on every subcommand prints the `Traced` steps. This is where the
      trace design pays for itself the first time.
- [ ] **G5.** `--json` output on every subcommand, so a professor can pipe results into a
      spreadsheet. 🔵 **LEFTOVER CANDIDATE**, but cheap, and `kleene grade --format csv`
      (roadmap §9.1) is built directly on it.

### Track H — Tests

- [ ] **H1.** `arb_regex()` and `arb_string()` proptest strategies. Getting the generator
      right matters more than the assertions — a generator that only emits trivial regexes
      passes everything.
- [ ] **H2.** `all_representations_agree` — NFA, DFA, and minimal DFA accept identically.
- [ ] **H3.** `minimization_is_idempotent`.
- [ ] **H4.** `roundtrip_through_regex` — regex → DFA → regex → DFA must be equivalent.
      The roadmap calls this the strong one and it is right. Expect it to fail first, and
      expect the failures to be real.
- [ ] **H5.** `marking_table_agrees_with_refinement` — the derived table and the refinement
      rounds must agree on which pairs are distinguishable, on the round each pair separates,
      and on each pair's witness string. Deriving one view from the other makes this a real
      internal consistency check rather than a tautology, and it is the test that would catch
      an off-by-one in the round accounting.
- [ ] **H6.** `counterexample_is_always_a_real_witness` — both directions. A returned
      witness must be accepted by exactly one machine; no witness returned must mean the two
      are genuinely equivalent. A fabricated witness lies to a student who is already
      confused, and a withheld one turns "correct" into an unbacked claim.
- [ ] **H7.** Differential testing against the `regex` crate on shared syntax.
- [ ] **H8.** `insta` snapshots for DOT and `.kln`.
- [ ] **H9.** proptest at 10,000 cases in CI; regressions committed.

---

## Definition of done

- [ ] Every algorithm in roadmap §2.4 implemented; every one marked *traced* returns steps.
- [ ] `cargo test --workspace` green including proptest at 10k cases.
- [ ] `kleene equiv` returns correct exit codes and prints a shortest counterexample,
      with direction, on mismatch.
- [ ] `--verbose` produces reasoning a student could follow.
- [ ] `docs/formats/kln.md` exists and matches the implementation.
- [ ] Zero clippy warnings; no `unsafe`.
- [ ] Deferred items recorded in [LEFTOVERS.md](../../LEFTOVERS.md).

## Known risks for this phase

| Risk | Mitigation |
|---|---|
| **The distinguishing string (D2) gets cut** | It is the differentiator, not a nice-to-have. If the week is short, cut Hopcroft (D4) instead — it is a performance optimisation for a case that does not exist yet at teaching sizes. |
| State elimination emits monstrous regexes | E2 simplification is mandatory, not optional, and E1 is not "done" without it. |
| proptest generator too weak to find bugs | Assert the generator itself: a corpus check that it produces nesting depth ≥ 3 and all operators within 1000 samples. |
| Trace payloads balloon the wasm bundle | Steps hold ids and small sets, never cloned automata. Watch the size budget from the first traced algorithm. |
| Phase 1 slides into UI work | No `web/` file may change during this phase. Enforced by discipline, visible in the diff. |

## Hooks for later phases

- **E5's counterexample** is the foundation the entire teaching layer stands on
  (roadmap §9.2). `kleene grade` reports it per submission, assignment links use it for
  instant self-check feedback, and the problem set uses it to say *why* an attempt failed.
  Built here for the CLI, at no extra cost to v1.
- **G5's `--json`** is the machine-readable surface `kleene grade --format csv` consumes
  in v1.1 (roadmap §9.1).
- **D2's distinguishing string** is the minimization-time analogue of E5, and what lets a
  failing attempt be told exactly which pair of states it wrongly merged. It also supplies
  the per-pair witness in the derived marking table (task D3).
- **Core-generated step prose (task D4)** means CLI verbose output, in-app explanations, and
  every v1.1/v1.2 teaching feature read from one source, with no second implementation to
  keep in sync.
