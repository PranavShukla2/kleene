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
| [phase-6.md](phase-6.md) | **Arena** — gamified challenge mode — Weeks 13–15 *(post-v1)* |
| [phase-7.md](phase-7.md) | **Classroom Lite** — backendless assignments — Weeks 16–19 *(post-v1)* |
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
                                                    ┌─> Phase 6  Arena
Phase 0 ──> Phase 1 ──> Phase 3 ──> Phase 4 ──> Phase 5          │
   │                       ▲           ▲             └─> Phase 7 Classroom Lite
   └──────> Phase 2 ───────┘           │                          ▲
                └──────────────────────┘                          │
                                       └──────────────────────────┘
                                        (share + .kln + CLI equiv
                                         are what Classroom is built on)
```

Phase 2 (editor) and Phase 1 (engine) touch almost nothing in common — the editor
manipulates a document, the engine transforms an automaton. If a week gets eaten by
coursework, the two can be interleaved without conflict. Phase 3 is the join point and
needs both.

Phases 6 and 7 are **post-v1 and strictly optional**. They are planned here, and small
hooks for them are threaded through Phases 1–5, but v1 ships without either. Nothing in
Phases 0–5 may grow in scope to accommodate them.

## The v1 line, restated

Roadmap §1.4 excludes pushdown automata, Turing machines, grammars, accounts, cloud
save, any backend, and collaborative editing. Phases 6–7 do not relax that line for v1:

- **Phase 6 (Arena) respects it completely.** Challenges are static JSON shipped with
  the app, progress is local (IndexedDB), and correctness is decided by `equiv()` running
  in wasm. No account, no server, works offline. It *could* have shipped in v1; it is
  after v1 only because v1 should ship on time.
- **Phase 7 (Classroom Lite) respects it by design, not by compromise.** Assignments are
  share-links, submissions are self-contained receipt files, and grading happens in the
  professor's terminal via `kleene grade`. The full hosted classroom — rosters, logins,
  a database, student PII — is deliberately *not* this phase. See
  [phase-7.md](phase-7.md) §"The fork in the road" for what adopting it would actually cost.
