# Kleene — Build Plan

The [roadmap](../ROADMAP.md) says *what* Kleene is and *why*. These documents say
*how it gets built*, in order, with acceptance criteria you can check off.

## The documents

| Document | What it holds |
|---|---|
| [phase-0.md](phase-0.md) | De-risk the toolchain — Week 1 |
| [phase-1.md](phase-1.md) | Core engine, headless — Weeks 2–4 |
| [phase-2.md](phase-2.md) | The editor — Weeks 5–7 |
| [phase-3.md](phase-3.md) | The conversion pipeline — Weeks 8–9 |
| [phase-4.md](phase-4.md) | Export and share — Week 10 |
| [phase-5.md](phase-5.md) | Ship v1 — Weeks 11–12 |
| [teaching-layer.md](teaching-layer.md) | **v1.1 / v1.2** — assignment links, problem set, pumping lemma game *(post-v1)* |
| [DECISIONS.md](DECISIONS.md) | **Everything that needs Pranav, not Claude** |
| [design-system.md](design-system.md) | Visual language the UI is held to |
| [../../LEFTOVERS.md](../../LEFTOVERS.md) | Work deferred out of a phase, with why |

## How to read a phase document

Each phase document has the same five sections:

1. **Goal** — one sentence, plus the exit criterion copied verbatim from the roadmap.
2. **Work breakdown** — tasks small enough to be a single commit, grouped into
   *tracks* that can be worked in any order within the group.
3. **Decision points** — inline `🔴 DECISION Dn` markers wherever the task cannot be
   completed without Pranav answering something. Every marker also appears in
   [DECISIONS.md](DECISIONS.md).
4. **Definition of done** — the checklist that lets the phase close.
5. **Known risks for this phase** — with the mitigation being applied.

## Markers used throughout

| Marker | Meaning |
|---|---|
| 🔴 **DECISION Dn** | Blocked on Pranav. Claude will not guess. Tracked in DECISIONS.md. |
| 🟡 **ASSUMPTION** | Claude picked a sensible default and moved on. Reversible, but say so early. |
| 🔵 **LEFTOVER CANDIDATE** | Known to be deferrable if the week runs short. Goes to LEFTOVERS.md. |

## Working agreement

- **Commit granularity.** Every task in a work breakdown is one commit, minimum.
  Commit messages state what changed and why; the repository history is meant to be
  readable as a build log. No `Co-Authored-By` trailers — this is Pranav's repo and
  Pranav's authorship.
- **Never more than two weeks from something shippable.** Every phase boundary is a
  defensible stopping point (roadmap §7). Phase boundaries do not slip silently: if a
  task cannot land, it moves to LEFTOVERS.md with a reason, and the phase still closes.
- **The core stays pure.** `kleene-core` has zero I/O and zero geometry. If a task
  wants to put a pixel in the core crate, the task is wrong.
- **`Traced<T>` from day one.** No algorithm ships untraced and gets traced later
  (roadmap §2.1). Retrofitting reasoning is the failure mode this whole design avoids.
- **UI is not a later concern.** Phase 0 already renders a *good-looking* DFA, not a
  placeholder. The design system is written before the editor is, so Phase 2 has
  something to conform to rather than invent.

## Phase dependency graph

```
Phase 0 ──> Phase 1 ──> Phase 3 ──> Phase 4 ──> Phase 5 ──> v1.0
   │                       ▲           ▲                      │
   └──────> Phase 2 ───────┘           │                      ▼
                └──────────────────────┘              teaching layer
                                                       v1.1 ──> v1.2
```

Phase 2 (editor) and Phase 1 (engine) touch almost nothing in common — the editor
manipulates a document, the engine transforms an automaton. If a week gets eaten by
coursework, the two can be interleaved without conflict. Phase 3 is the join point and
needs both.

The teaching layer is **post-v1 and strictly optional**. It is planned in
[teaching-layer.md](teaching-layer.md), and small hooks for it are threaded through
Phases 1–5, but v1 ships without it and no v1 phase may grow in scope to accommodate it.

## The v1 line, restated

Roadmap §1.4 excludes pushdown automata, Turing machines, grammars, accounts, rosters,
cloud-stored student work, any backend, and collaborative editing. The teaching layer does
not relax that line — it is built to live inside it. Every v1.1/v1.2 feature is static files
or CLI: assignment links are URL fragments, progress is `localStorage`, correctness is
`equiv()` in wasm, and grading happens in the professor's own terminal.

One piece of the teaching layer *does* ship in v1: the **counterexample engine**
(roadmap §2.4, Phase 1 tasks E5/H5). It is v1 core work in its own right — "is this DFA
correct?" is decidable, so a wrong answer should name the shortest string it gets wrong
rather than just saying no — and everything in v1.1/v1.2 is built on top of it.
