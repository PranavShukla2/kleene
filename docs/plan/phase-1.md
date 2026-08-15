# Phase 1 — Core engine

**Weeks 2–4 · ~30 hrs**

> **Exit criterion:** `kleene equiv student.kln reference.kln` works from a terminal, and
> the property tests pass.

## Goal

Every algorithm in v1, headless, traced, and property-tested. **No UI work at all this
phase** — not a stylesheet, not a component. The temptation to "just check how it looks"
is what turns a three-week phase into a five-week one.

At the end of this phase the project is already a publishable Rust crate with a real
property-test suite. That is the point of doing it second: it is the first defensible
stopping point if the semester goes sideways (roadmap §7).

---

## The decisions that block this phase

Six questions must be answered before the corresponding task starts. They are notation and
pedagogy questions, not engineering ones — Claude picking a default here means the tool
teaches something subtly different from what the course teaches, which defeats its purpose.

| | Blocks | Question |
|---|---|---|
| 🔴 **D1** | B2, B3 | Does `+` mean **union** or **one-or-more**? |
| 🔴 **D2** | A2, B1 | Are alphabet symbols single characters, or multi-character tokens? |
| 🔴 **D3** | D1–D4 | Is the primary minimizer **Moore partition refinement** or **table-filling (Myhill–Nerode)**? |
| 🔴 **D4** | C3, D3 | How are subset-construction states named and displayed? |
| 🔴 **D6** | E1 | What order does state elimination remove states in? |
| 🔴 **D7** | A3, B4 | Is the empty string written **ε** or **λ**? |

**D1 is the one to answer first.** In Hopcroft–Ullman and in most Indian TOC syllabi, `+`
is *union* — `a + b` means "a or b". In every programming regex dialect, `+` is *one or
more*. These are irreconcilable in one grammar, the parser is written against whichever is
chosen, and changing it later invalidates every saved document and shared URL. Full context
in [DECISIONS.md](DECISIONS.md).

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
      Includes `origin: Option<BTreeSet<StateId>>` from the first commit. 🔴 **D2**
- [ ] **A3.** Alphabet handling, epsilon representation (`Option<Symbol>`, `None` = ε),
      and the display convention. 🔴 **D7**
- [ ] **A4.** Validation: `Automaton::validate()` returning structured errors — unreachable
      start, transitions on symbols outside Σ, dangling state ids. Every constructor path
      goes through it.
- [ ] **A5.** Builder API ergonomic enough that a test can express a 4-state DFA in 6 lines.
      Every test in this phase depends on this being pleasant.

### Track B — Regex front end

- [ ] **B1.** `regex/lexer.rs` — tokens, positions retained for error spans. 🔴 **D2**
- [ ] **B2.** `regex/parser.rs` — recursive descent. Precedence: alternation <
      concatenation < postfix. Supports grouping, `∅`, `ε`. 🔴 **D1**
- [ ] **B3.** Parse errors carry a byte span and a human sentence, not "unexpected token".
      The regex bar in Phase 3 underlines the offending character using this. 🔴 **D1**
- [ ] **B4.** `regex/thompson.rs` — AST → ε-NFA, **traced**: one step per AST node,
      recording the fragment constructed and why. 🔴 **D7**
- [ ] **B5.** `Display` for the AST that round-trips through the parser — needed by the
      `to_regex` property test, and by the UI to show a normalized form.

### Track C — Conversions

- [ ] **C1.** `convert/epsilon.rs` — ε-closure by worklist, **traced** so the closure can
      be shown growing one state at a time.
- [ ] **C2.** ε-removal producing an equivalent ε-free NFA, traced.
- [ ] **C3.** `convert/subset.rs` — subset construction, **traced per round**. Each step
      records: the subset being expanded, the symbol read, the resulting ε-closure, and
      whether the target was new or already seen. `origin` is populated here — this is what
      makes Phase 3's hover-highlight possible. 🔴 **D4**
- [ ] **C4.** Reachable / co-reachable pruning, traced. Dead-state removal.
- [ ] **C5.** Completion with an explicit trap state — required before complement.
      Whether the trap state is shown by default is a UI question, deferred to Phase 2.

### Track D — Minimization

- [ ] **D1.** `convert/minimize.rs` — the **primary, traced** minimizer. Each step records
      the partition before, the block being split, the symbol that split it, and the
      resulting blocks. 🔴 **D3**
- [ ] **D2.** The **distinguishing string** for each split, reconstructed and attached to
      the step. This is the single highest-value line in the whole engine: it is exactly
      what the roadmap §1.1 identifies as the thing JFLAP will not tell you, and what the
      exam actually asks for. It is not free — it needs a witness back-pointer maintained
      through refinement — and it must not be dropped when the week gets tight.
- [ ] **D3.** Human-readable step rendering: *"Reading `a` from block {q1, q3} reaches two
      different blocks, so {q1, q3} splits into {q1} and {q3}. The string `ab` is accepted
      from q1 but not from q3."* Generated in **core**, not in the frontend, so the CLI's
      verbose mode and the docs get it for free. 🔴 **D4**
- [ ] **D4.** Hopcroft minimization — untraced, for the CLI on large inputs. Property-tested
      to agree with the primary minimizer on state count. 🔴 **D3**

### Track E — Analysis and operations

- [ ] **E1.** `convert/to_regex.rs` — state elimination via GNFA. Traced, with the
      eliminated state and the resulting relabelled edges per step. 🔴 **D6**
- [ ] **E2.** Regex simplification pass — `(a|a)` → `a`, `a∅` → `∅`, `ε·r` → `r`, nested
      star collapse. Without it, state elimination emits regexes hundreds of characters long
      and the feature is unusable in practice. 🔵 **LEFTOVER CANDIDATE**: the aggressive
      rules. The four listed above are mandatory.
- [ ] **E3.** `ops.rs` — complement, product construction (union, intersection, difference).
- [ ] **E4.** `equiv.rs` — Hopcroft–Karp with union-find. Returns not just a bool but, on
      inequality, **a shortest witness string** separating the two languages. The witness is
      what makes the autograder useful instead of merely correct.
- [ ] **E5.** `simulate.rs` — DFA single-state stepping and NFA configuration-set stepping,
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
- [ ] **G3.** `kleene equiv a.kln b.kln` — exit code 0/1 for scripting, and on failure
      prints the witness string from E4. **This is the autograder wedge** (roadmap §6.2).
- [ ] **G4.** `--verbose` on every subcommand prints the `Traced` steps. This is where the
      trace design pays for itself the first time.
- [ ] **G5.** `--json` output on every subcommand, so a professor can pipe results into a
      spreadsheet. 🔵 **LEFTOVER CANDIDATE**, but cheap and it is what makes Phase 7 possible.

### Track H — Tests

- [ ] **H1.** `arb_regex()` and `arb_string()` proptest strategies. Getting the generator
      right matters more than the assertions — a generator that only emits trivial regexes
      passes everything.
- [ ] **H2.** `all_representations_agree` — NFA, DFA, and minimal DFA accept identically.
- [ ] **H3.** `minimization_is_idempotent`.
- [ ] **H4.** `roundtrip_through_regex` — regex → DFA → regex → DFA must be equivalent.
      The roadmap calls this the strong one and it is right. Expect it to fail first, and
      expect the failures to be real.
- [ ] **H5.** Differential testing against the `regex` crate on shared syntax.
- [ ] **H6.** `insta` snapshots for DOT and `.kln`.
- [ ] **H7.** proptest at 10,000 cases in CI; regressions committed.

---

## Definition of done

- [ ] Every algorithm in roadmap §2.4 implemented; every one marked *traced* returns steps.
- [ ] `cargo test --workspace` green including proptest at 10k cases.
- [ ] `kleene equiv` returns correct exit codes and prints a witness on mismatch.
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

- **E4's witness string** is what Phase 7's `kleene grade` reports back to students. Built
  here for the CLI; costs nothing extra.
- **G5's `--json`** is the machine-readable surface Phase 7 batch grading consumes.
- **D2's distinguishing string** is what Phase 6's Arena uses to give a failing challenge
  attempt a specific counterexample instead of "wrong".
- **Core-generated step prose (D3)** means Arena hints and Classroom feedback come from the
  same source as the UI, with no second implementation to keep in sync.
