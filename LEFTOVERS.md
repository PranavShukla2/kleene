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

*Status: in progress.*

| What | Why it did not land | Where it went | Cost of leaving it |
|---|---|---|---|
| Free-space-aware self-loop placement (D4) | Planned as `loop above` only. Full direction selection needs the collision logic that Phase 2 builds anyway. | Phase 2 C4 | None. A single hardcoded DFA has one self-loop and nowhere for it to collide. |
| Cloudflare Pages deployment (E4) | Blocked on 🔴 [D10](docs/plan/DECISIONS.md#d10--cloudflare-pages-account-and-dns) — needs Pranav's Cloudflare account and an API token. | Blocked; `deploy.yml` is written and committed, and goes green the hour the secrets land. | **This is the Phase 0 exit criterion.** Everything else in the phase can complete, but the phase does not close until there is a public URL. |

## Phase 1 — Core engine

*Not started.*

## Phase 2 — The editor

*Not started.*

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
