# The three v2 tracking issues

Phase 5 G3. Bodies for the three issues that give the v1 exclusions somewhere to go — open
them at https://github.com/PranavShukla2/kleene/issues/new, labelled `enhancement` + `v2`.

Kept in the repository rather than pasted once and lost, because the text is the reasoning
for _why_ each is out of scope, and that reasoning outlives the issue. The
feature-request template already tells people these exist, so filing them wants doing before
the repository has an audience.

---

## 1 — Pushdown automata

**Title:** Pushdown automata

**Body:**

Out of scope for v1, tracked here so the request has somewhere to go.

Kleene v1 covers regular languages completely: automata, regular expressions, and every
conversion between them, each with its reasoning attached. Pushdown automata are the next
rung — context-free languages, a stack, and non-determinism that no longer collapses into a
deterministic machine.

That last part is why this is not a small addition. Subset construction works because an NFA
has finitely many state sets; a PDA has unboundedly many stack contents, so the whole
step-through model — a finite list of frames, each a snapshot of a machine being built —
needs rethinking rather than extending.

What would need designing:

- A representation for stack contents in the trace, given they are unbounded.
- Simulation of a non-deterministic PDA, including a readable account of the branch that
  succeeded and the ones that did not.
- CFG ↔ PDA conversions, which is where most courses actually use them.

👍 this issue if you'd use it, and say what for — a course, a textbook, self-study. What goes
into v2 is decided by which of these three fills up.

---

## 2 — Turing machines

**Title:** Turing machines

**Body:**

Out of scope for v1, tracked here so the request has somewhere to go.

The natural end of the sequence a formal languages course walks: finite automaton, pushdown
automaton, Turing machine. Most of the editor would carry over — states, transitions, a
canvas — and the simulation would not, because a TM's configuration is a tape rather than a
state set, and the interesting runs are long.

What would need designing:

- Tape rendering that stays readable over thousands of steps, which the current
  frame-by-frame scrubber is not built for.
- A stance on non-termination. The honest answer is a step budget that says it gave up,
  rather than a spinner that never resolves.
- Variants: multi-tape, non-deterministic. Courses differ on which they teach.

👍 this issue if you'd use it, and say which variant your course uses.

---

## 3 — Context-free grammars

**Title:** Context-free grammars

**Body:**

Out of scope for v1, tracked here so the request has somewhere to go.

Of the three v2 candidates this is the one most likely to be genuinely useful soonest,
because grammars are where students spend the most time being confused and the least time
getting feedback.

What would need designing:

- A grammar editor — text, not a canvas. Productions are written, not drawn.
- Derivations and parse trees, step by step, in the same way the conversions work now: every
  step naming the production it applied and why.
- The normal-form conversions (CNF, Chomsky/Greibach), each of which is a sequence of
  transformations and therefore a natural fit for the trace model.
- CYK parsing, which is a table that fills in — the same shape as the transition table in
  subset construction, and the closest thing to an already-solved UI problem here.

👍 this issue if you'd use it, and say which part matters most.
