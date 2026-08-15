# Teaching layer — v1.1 / v1.2

Implementation plan for [roadmap §9](../ROADMAP.md). Classroom use and gamification, built
so that neither one ever requires a server.

> **The constraint, restated because it is the whole design:** every feature here ships as
> static files or CLI. No accounts, no database, no student PII. If a task in this document
> starts to need a backend, the task is wrong, not the constraint.

This document is **not** part of v1. Nothing here may be pulled forward into Phases 0–5,
and no v1 task may grow to accommodate it. The only piece of this that ships in v1 is the
counterexample engine (Phase 1, tasks E5/H5), which is v1 core work in its own right.

---

## What makes this cheap

Almost nothing here is new machinery. It is the v1 pieces, recombined:

| This needs | Which already exists from |
|---|---|
| Encoding a problem into a link | §2.6 share format — Phase 4 |
| Checking a student's answer | `equiv()` — Phase 1 E4 |
| Saying *why* an answer is wrong | `counterexample()` — Phase 1 E5 |
| Proving a state budget was met | `minimize()` — Phase 1 D1 |
| Running many strings at once | Batch tester — Phase 2 F6 |
| Batch grading a directory | `--json` CLI output — Phase 1 G5 |
| Storing progress | IndexedDB document store — Phase 2 A5 |

That table is the argument for why this is a weekend rather than a semester. It is also the
argument for **not cutting Phase 1 G5 or Phase 2 F6 when those weeks get tight** — they look
optional in isolation and are load-bearing here.

---

## v1.1 — Assignment links and the problem set

**Budget: one weekend.** Both features are the §2.6 share format carrying a different payload.

### Track A — Problem specs

- [ ] **A1.** A `ProblemSpec` type in core: target language (as a regex or a reference
      automaton), optional maximum state budget, optional alphabet restriction, a
      human-readable prompt.
- [ ] **A2.** Spec → compressed URL fragment, reusing the Phase 4 codec unchanged. If it
      needs changing, the Phase 4 codec was written too narrowly.
- [ ] **A3.** `kleene problem new` — build a spec from the CLI so a professor can generate a
      set of links from a shell script rather than by hand.
- [ ] **A4.** Spec versioning from day one. A link handed out in September must still open in
      November. 🔴 **DECISION D8** — same format freeze as `.kln`.

### Track B — The solve view

- [ ] **B1.** A mode where the prompt is shown, the canvas is the editor, and a **Check**
      button reports accept/reject with the counterexample on failure.
- [ ] **B2.** State-budget indicator when the spec sets one: *"4 states used, limit 4."*
- [ ] **B3.** Failure feedback that names the string and the direction — never a bare
      "incorrect". This is the entire pedagogical thesis of the project applied to one button.
- [ ] **B4.** Unlimited attempts, no scoring, no timer. This is practice, and framing it as
      assessment would be both dishonest (§9.1) and worse for learning.
- [ ] **B5.** An honest inline note that the answer is client-side and therefore inspectable.
      🟡 **ASSUMPTION** — stated plainly in the UI rather than buried in docs. A student who
      discovers this themselves will trust nothing else the tool says.

### Track C — Ordered problem set

- [ ] **C1.** ~20 problems in difficulty order, from *"strings ending in `ab`"* to
      *"binary numbers divisible by 3"*. Shipped as static JSON.
      🔴 **DECISION D14** — the problem list itself is a teaching artifact, not a
      technical one. It should match a real syllabus.
- [ ] **C2.** Progress in `localStorage`: attempted / solved / solved-within-budget.
- [ ] **C3.** Progress is exportable and importable as a file, because `localStorage` is one
      cleared cache away from gone and there is deliberately no server to fall back on.
- [ ] **C4.** No streak counter. No daily goal. See §9.2 — the mechanics are the subject,
      not the engagement loop.

### Track D — Teacher CLI

- [ ] **D1.** `kleene grade submissions/ --against reference.kln --format csv`.
- [ ] **D2.** CSV columns: filename, verdict, counterexample, direction, state count. The
      counterexample column is what turns a grade into feedback.
- [ ] **D3.** Robustness against real submission directories: unreadable files, `.jff` files
      mixed with `.kln`, nested folders, a file that is not an automaton at all. A grader
      that dies on submission 47 of 200 is worse than no grader.
- [ ] **D4.** `--format json` and `--format md` alongside CSV.
- [ ] **D5.** GitHub Classroom template repo + an Action running `kleene equiv` on push.
      Cheapest item in this document — it is a workflow file — and the one most likely to
      produce an actual adopting department.

---

## v1.2 — Pumping lemma game and state-budget golf

**The only genuinely new interaction work in the teaching layer.**

### Track E — Pumping lemma game

Built literally as the adversarial game it is already taught as. The roadmap argues this is
the single most valuable thing here even if nothing else gets built, because it targets the
one failure that is always the same failure: treating a proof about an adversary as a
formula to memorise.

- [ ] **E1.** Game state machine: machine picks *n* → student picks *w* → machine decomposes
      into *xyz* → student picks *i* → verdict.
- [ ] **E2.** The machine must play **well**, not randomly. If it picks a decomposition the
      student can trivially defeat, the student learns nothing and concludes the lemma is
      easy. 🔴 **DECISION D19** — how adversarial should it be? Always-optimal play is
      demoralising for a first attempt; random play is useless. This is a teaching judgement.
- [ ] **E3.** A library of languages to play against — some regular (where the *student*
      must lose, and understanding why is the lesson), some not.
- [ ] **E4.** Explain the verdict in the language of the lemma, quantifier by quantifier, so
      the game visibly *is* the proof rather than resembling it.
- [ ] **E5.** Replay of a completed game as a written proof sketch the student can read back.

### Track F — State-budget golf

- [ ] **F1.** Challenge format: a language plus a state bound, where the bound is verified
      achievable by minimizing the reference — so it is never accidentally impossible.
- [ ] **F2.** Live state count against the budget while editing.
- [ ] **F3.** On success, show the minimal machine alongside the student's and, when the
      student is above the bound, name the states that could have been merged and the string
      that proves it. This is Phase 1 D2's distinguishing string doing a second job.
- [ ] **F4.** Personal best per challenge, stored locally. Not a leaderboard — a leaderboard
      needs a server, and §9.2 rules out the mechanic anyway.

---

## Definition of done

**v1.1**
- [ ] A teacher can produce an assignment link without an account and without installing anything.
- [ ] A student opening it gets a prompt, an editor, and specific failure feedback.
- [ ] `kleene grade` handles a realistic 200-file directory without dying.
- [ ] The problem set is completable start to finish, with progress surviving a reload.

**v1.2**
- [ ] The pumping lemma game can be lost by a student who does not understand the lemma, and
      won by one who does. If it cannot be lost, it teaches nothing.
- [ ] Golf challenges verify their own bounds.

## Risks

| Risk | Mitigation |
|---|---|
| **This eats v1** | It is a separate document for a reason. No v1 phase may grow for it, and only the counterexample engine crosses the line. |
| **"Just a small backend"** | Roadmap §7's classroom-scope-creep row. The rule holds even when a server would obviously be nicer, which is exactly when it will be tested. |
| Assignment links get used for real grading | The inspectability note (B5) is in the UI, not the docs, and `kleene grade` is presented as the graded path everywhere. |
| Pumping lemma game plays badly and teaches badly | 🔴 D19 is flagged as a teaching decision, not an implementation detail. Worth playtesting on actual classmates before shipping. |
| Progress loss from cleared `localStorage` | C3 export/import. There is no server safety net by design, so the export has to exist. |
