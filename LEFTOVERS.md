# Leftovers

Work that was planned for a phase and did not land in it.

This file exists so that a phase can **close honestly**. The alternative — a phase that
stays 90% done for three weeks because one task will not die — is how a twelve-week project
becomes a twenty-week one and then becomes nothing. The rule from
[the working agreement](docs/plan/README.md) is that phase boundaries do not slip silently:
if a task cannot land, it moves here with a reason, and the phase still closes.

---

## How to use this file

**When a phase closes**, every unchecked box in its plan document is resolved into exactly
one of four outcomes:

| Outcome | Meaning |
|---|---|
| **Deferred** | Still wanted, scheduled into a named later phase. |
| **Descoped** | No longer wanted. Say why — a descoped item that looks deferred gets rebuilt by accident six weeks later. |
| **Blocked** | Waiting on a [decision](docs/plan/DECISIONS.md) or something external. |
| **Done late** | Landed after the phase closed. Kept for the record, then struck through. |

Each entry records **what**, **why it did not land**, **where it went**, and **what it costs
to leave undone**. That last column is the one that matters — it is the difference between
"we skipped it" and "we know what we are trading."

**Two rules that keep this file honest:**

1. **Nothing lands here silently.** If a task is being dropped, it gets written down in the
   same session it is dropped, not reconstructed from memory in week 11.
2. **Anything marked 🔵 LEFTOVER CANDIDATE in a plan document is *pre-approved* to arrive
   here.** Anything not marked is not — dropping an unmarked task means the plan was wrong,
   and the plan document should be corrected too, so the mistake is visible rather than
   quietly absorbed.

**What must never appear here.** Some tasks are explicitly protected in their phase
documents, because they look optional and are not:

- **Phase 1 D2** — the distinguishing string attached to each partition split. It is the
  thing JFLAP does not do (roadmap §1.1) and the reason the project exists. Cut Hopcroft
  minimization instead; that is a performance optimisation for a problem size nobody has.
- **Phase 1 E2** — the four mandatory regex simplification rules. Without them, state
  elimination emits unusable output and the feature is decorative.
- **Phase 2 A3** — the command stack. Retrofitting undo is a rewrite.
- **Phase 3 C5** — reasoning prose generated in core, not TypeScript. Breaking this breaks
  the architecture's central claim.
- **Phase 4 A6** — TikZ label escaping. A LaTeX compile error loses the user permanently.

---

## Phase 0 — De-risk the toolchain

*Status: complete.*

| What | Why it did not land | Where it went | Cost of leaving it |
|---|---|---|---|
| **Deferred** — free-space-aware self-loop placement (D4) | Planned as `loop above` only. Full direction selection needs the collision logic Phase 2 builds anyway. | Phase 2 C4 | None yet. The Phase 0 example has two self-loops and nothing for them to collide with. |
| ~~**Blocked** — Cloudflare Pages deployment (E4)~~ **Done late 2026-08-16** | Was blocked on D10 until the Cloudflare secrets were added to the repository. | Landed after the phase's other work; `deploy.yml` now runs for real. | — |
| **Deferred** — Playwright end-to-end tests | Nothing is interactive yet, so an e2e test would assert only that a static page rendered — which `vitest` and the build already cover. Playwright is installed and was used to screenshot and verify both themes. | Phase 2 H4, where there is an interaction worth testing | Low. The render was verified visually at 1366×768 in both themes, and that check found a real routing bug. |
| **Deferred** — ESLint + Prettier (C5) | Never landed. TypeScript strict mode plus `noUnusedLocals` is catching the class of thing lint would, and the codebase is nine files. | Phase 2, before the editor grows | Low now, rising fast. Worth doing before Phase 2 rather than after. |
| **Deferred** — branch protection on `main` (E5) | Requires repository settings, not code. | Pranav, whenever convenient | Low while this is a single-contributor repo, but it is what makes CI a gate rather than a suggestion. |

## Phase 1 — Core engine

*Status: complete. Exit criterion met — `kleene equiv` works from a terminal, prints the
shortest counterexample, and the property suite passes at 10,000 cases.*

| What | Why it did not land | Where it went | Cost of leaving it |
|---|---|---|---|
| **Deferred** — Hopcroft minimization (D5) | Pre-approved as the thing to cut. It is a performance optimisation for large inputs, and partition refinement is instant at teaching sizes — the largest machine in the whole test suite is 17 states. | Whenever a real input is slow enough to notice | None measurable. Revisit only with a profile showing minimization is the bottleneck, which no current input produces. |
| **Deferred** — ε-removal as a standalone step (C2) | **Not** marked as a leftover candidate, so this is a plan defect rather than a scheduling one — see below. Nothing in the pipeline needs it: subset construction consumes ε-transitions directly via precomputed closures, so ε-NFA → DFA never passes through an ε-free NFA. | Phase 3, alongside the ε-NFA pane | Low. It is a *teaching* step rather than a pipeline step — some courses show ε-NFA → NFA → DFA as three diagrams — so it belongs with the view that would display it. |
| **Descoped** — `--json` on every subcommand as a separate task (G5) | Landed as part of G1–G4 rather than after them. | Done | — |

**Plan correction.** C2 was scheduled in Phase 1 without a 🔵 marker, which under the rules
above means the plan was wrong rather than the work. It was listed as though the pipeline
depended on it; it does not, because `Closures` handles ε directly. [phase-1.md](docs/plan/phase-1.md)
has been corrected so the mistake is visible rather than quietly absorbed.

## Phase 2 — The editor

**Closed 2026-08-18.** 73 of 77 boxes. Every item in the Definition of Done is ticked, and the
exit criterion — building the "even number of a's" DFA end to end through the UI — runs in CI
on every push.

Two tracks were added mid-phase and both are closed: **I** (the transition table and the formal
5-tuple, from roadmap §2.4a) and **J** (the workbench shell, from §2.8). A third, **K**, pulled
the front-door shell forward from Phase 5 so that what comes next can be seen and checked
rather than described.

| What | Why it did not land | Where it went | Cost of leaving it |
|---|---|---|---|
| **Deferred** — play/pause with adjustable speed (F5) | The step controls work and stepping by hand is what a student actually does when learning; autoplay is for demonstrating, which is Phase 3's job. Building it now would mean building the speed control twice, since Phase 3's scrubber needs one for conversions too. | Phase 3 Track C, alongside the step scrubber | None. Manual stepping covers every case autoplay would, more slowly and more deliberately. |
| **Deferred** — batch tester (F6) | Pre-approved as a leftover candidate. One string at a time answers "does this machine do what I think", which is the question in Phase 2. Many strings at once answers "does this machine match a spec", which is a *grading* question and belongs with the teaching layer that asks it. | Phase 3, or v1.1 §9.1 where assignment links reuse it directly | None yet. It becomes load-bearing only when there is an assignment to check against. |
| **Deferred** — animate the transition being taken (F7) | Added mid-phase after F1–F4 shipped, once it was visible that swapping a highlight between two states shows *where* the machine went and never *how*. Design-system §1.3 already governs it — "motion explains causality, or it doesn't happen" — and 280ms is already specified in §5. | Phase 3, with the step scrubber that shares the timing | Low but real. On an NFA, one symbol fans the configuration out along several edges and the highlight simply appears in three new places, which is the case the animation most needs to explain. |
| **Deferred** — copy the table as TSV (I6) | Marked a leftover candidate when Track I was written. It is *export*, and Phase 4 owns export properly — including the clipboard handling, the LaTeX `tabular` variant, and the question of what a partial δ looks like in a spreadsheet. | Phase 4, with the other exporters | None. The table is readable and selectable on screen today. |

**Nothing was descoped, and nothing is blocked.**

One item from an earlier phase was paid off here as promised: Phase 0's deferred
free-space-aware self-loop placement landed as **C4**. Phase 0's deferred ESLint and Prettier
landed before the editor grew, as that entry asked. Phase 0's deferred Playwright tests landed
as **H4**, which is where that entry said they belonged.

## Phase 3 — The conversion pipeline

*Not started.*

## Phase 4 — Export and share

*Not started.*

## Phase 5 — Ship v1

*Not started.*

## Teaching layer (v1.1 / v1.2)

*Not started. Post-v1 — see [teaching-layer.md](docs/plan/teaching-layer.md).*

---

## Descoped — decided against, with reasons

*Kept permanently. This section is what stops a rejected idea being re-proposed in week 9
and quietly accepted because nobody remembers why it was dropped.*

| What | Why not | Decided |
|---|---|---|
| Arena / Classroom Lite as separate post-v1 phases | Superseded by [roadmap §9](docs/ROADMAP.md), which draws a better line: one teaching layer across v1.1/v1.2, with the counterexample engine as the single piece crossing into v1. The old framing implied two products with their own week budgets. | 2026-08-15 |
| XP, badges, streaks, leaderboards | Roadmap §9.2. Generic point systems are filler bolted onto content that could not hold attention on its own, and students read them as exactly that. Every teaching-layer mechanic is instead a real, machine-checkable property of the subject. A leaderboard would also need a server, which §9 forbids outright. | 2026-08-15 |
| A hosted classroom with accounts and rosters | Roadmap §9's zero-backend rule and §1.4's exclusion list. Holding a class list means DPDP/FERPA/GDPR duties; a submission deadline is an uptime promise landing in the same week as finals. Revisit **only** when a named professor asks with specific requirements — at which point it is validation to act on, not scope creep. | 2026-08-15 |
