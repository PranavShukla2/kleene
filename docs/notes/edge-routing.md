# Edge routing rules

*Written before implementing Phase 2 Track C, as the plan requires. The plan calls edge
routing the single biggest UX risk in the project ([roadmap §7](../ROADMAP.md)), and the
point of writing the rules down first is that "it looks about right" is how a diagram ends
up looking generated.*

---

## What the research actually found

**Graphviz was the obvious place to look and turned out to be the wrong one.** Its
[`splines` documentation](https://graphviz.org/docs/attrs/splines/) describes routing modes —
`spline`, `polyline`, `ortho`, `curved` — but says nothing about self-loops or parallel edges,
which are precisely the two cases that make automaton diagrams look broken. Its actual
approach is general-purpose spline routing around node bounding boxes: powerful, and far more
machinery than a diagram of twelve circles needs.

**The binding constraint came from the other end of the pipeline.** Kleene exports to TikZ
(Phase 4), and the whole promise of that export is that *what a student arranges on screen is
what comes out in their assignment*. So the routing vocabulary cannot be richer than what
TikZ's `automata` library can express. That library offers exactly:

| Construct | TikZ |
|---|---|
| Straight edge | `edge` |
| Curved edge | `bend left`, `bend right`, with a configurable `bend angle` |
| Self-loop | `loop above`, `loop below`, `loop left`, `loop right` |

That is the entire vocabulary. **Four loop directions, two bend directions, and straight.**

This is a genuinely useful constraint rather than a limitation. A router free to emit
arbitrary splines would produce screen output that TikZ could only approximate, and the two
would drift — which is exactly the failure the 96px ↔ 2.4cm mapping in
[design-system.md §4.4](../plan/design-system.md) was chosen to avoid. Restricting the router
to TikZ's vocabulary means an export can be *exact* rather than nearly right.

**Rule 0: the router may only produce shapes TikZ can name.**

---

## The four cases

From [phase-2.md](../plan/phase-2.md). Each is individually easy; the combination is not.

### 1. Self-loops

**Rule:** place the loop in the first free direction, in the order
`above, right, below, left`.

A direction is *free* when no other state's bounding box, and no edge incident to this state,
lies within **40px** of the loop's anchor.

`above` is first because automata are laid out left-to-right (design-system §4.4), so the
vertical axis is the emptier one, and because `loop above` is what almost every textbook
draws. `left` is last because it collides with the start arrow on the start state.

*Phase 0 status:* only `above` is implemented, recorded in
[LEFTOVERS.md](../../LEFTOVERS.md). This is where that is paid off.

### 2. Bidirectional pairs

**Rule:** when `p → q` and `q → p` both exist, both bend, both passing the **same** side
value, with a control offset of 28px.

Passing `+1` and `−1` to "make them opposite" is wrong, and Phase 0 shipped that bug before a
test caught it: the curve bends along the normal to `from → to`, and that vector *already*
reverses when the endpoints swap. Negating `side` as well cancels the flip and puts both
curves on top of each other — the precise overlap the rule exists to prevent.

In TikZ this is `bend left` on both, which is the same trick: the direction is relative to
travel, not to the page.

### 3. Multi-symbol edges

**Rule:** one drawn edge per ordered pair, labelled `a, b, c`, symbols sorted.

Never parallel edges for the same pair. Sorting matters beyond tidiness — an unsorted label
depends on transition insertion order, so the same machine would render differently after a
round-trip through a file, and snapshot tests would be worthless.

### 4. An edge passing through an unrelated state

**Rule:** if the straight path passes within `radius + 10px` of a state that is not one of its
endpoints, bow the edge **downward** with a control offset of **96px**.

Two numbers here are load-bearing and neither is obvious:

- **96, not 28.** A quadratic Bézier only reaches *half* its control offset at the midpoint.
  28 deviates by 14px and passes straight through a 24px-radius state — a fix that looks like
  a fix and changes nothing. 96 deviates by 48px, leaving 24px of daylight.
- **Downward, always.** Self-loops sit *above* their state (rule 1 prefers `above`), so an
  edge routed over the top trades one collision for another. Going under keeps them apart
  without needing to know which states carry loops.

This is the least obvious of the four and the one Phase 0 shipped wrong: a straight `q2 → q0`
in a left-to-right row runs directly over `q1`, and the result reads as a double-headed arrow
between `q0` and `q1`. It is a *wrong* diagram, not an ugly one — someone learning from it
misreads the machine.

Found by screenshotting the first real render, not by reading the code. Which is the argument
for [task C7](../plan/phase-2.md).

---

## The cases combine

**Rule:** the four cases are not alternatives. An edge can be half of a bidirectional pair
*and* have a state in the way, and both facts have to be honoured.

They are honoured by splitting what each decides:

- **Which case applies chooses the side.** A pair keeps its own convention — both halves pass
  the same side and separate on the direction vector's own flip. An unpaired obstructed edge
  bows downward.
- **Whether anything is obstructed chooses how far.** `bendClearance` when there is something
  to clear, `bendOffset` when there is not.

Written down because the code got this wrong first: routing checked "is this a pair?" and
returned, so a paired edge never asked whether it was also obstructed, and both halves of
`q0 ↔ q2` ran through `q1` at 14px of deviation. It is the same defect the 96px number exists
to prevent, arriving by the one path that skipped the check — and reading the function does
not show it, because the two branches look like a tidy priority order and the bug is entirely
in the question the first one fails to ask.

Caught by fixture 05 on its first run.

---

## Label placement

**Rule:** 12px off the edge along its normal, on a plate filled with the canvas colour so the
line is cut cleanly behind the glyphs.

A label sitting *on* its own edge is the single most common way a generated diagram reads as
amateur. For curves the label rides the curve's true midpoint — the quadratic evaluated at
`t = 0.5`, not the midpoint of the chord, which would float off the line.

When a label still collides after the normal offset, slide it along the edge before growing
the offset: moving *along* the line keeps the association between label and edge obvious,
where pushing it further away weakens it.

**Rule: the edge proposes, a global pass disposes.** An edge knows its own shape and nothing
about the rest of the diagram, so it cannot tell whether the spot it picked is already taken.
Each edge therefore offers *ordered candidates* and a separate pass, which sees every state
and every label at once, chooses between them. Ordered as: both sides of the midpoint first,
then positions slid toward either end — a label on the far side of its edge still obviously
belongs to it, while one slid toward an endpoint is already slightly ambiguous.

**Rule: greedy, in a fixed order.** Not because it is easier but because it is *stable*.
Adding a transition at the end of a machine must not rearrange the labels at the start, and an
optimiser would do exactly that. A diagram whose labels move while you edit it is worse than
one placed slightly suboptimally.

**Rule: never drop a label.** When every candidate collides, take the least-bad one. A diagram
missing a transition symbol is a *different machine*; a cramped one is only ugly. State
collisions are weighted above label collisions, because covering a state costs its name too.

**Rule: every line is drawn before any label.** A label's plate can only cut what was drawn
before it, so labels rendered per-edge get painted over by edges that come later — which is
what made symbols read as `b)` and `a|` in the 30-state render. The plate was working exactly
as designed and simply had nothing left to cut.

The plate counts as part of what a label occupies. Sizing to the glyphs alone lets two labels
pass the collision test while visibly touching.

Labels are monospace for a reason beyond style: every glyph has the same advance, so
`length × 7.2px` is exact rather than estimated, and placement needs no DOM measurement. It
stays a pure function, testable without a browser.

---

## What is deliberately not done

- **General spline routing around obstacles.** Graphviz's approach, and far more than twelve
  circles need. It would also emit paths TikZ cannot name, breaking rule 0.
- **Edge–edge crossing minimisation.** A layout concern, not a routing one — elkjs (Track G)
  owns it, and crossings are not *wrong*, only busy.
- **Orthogonal routing.** Reads as a flowchart. Automata are drawn with curves in every
  textbook this tool is meant to sit beside.

---

## How these stay true

A rule nobody checks is a rule that decays. [Task C7](../plan/phase-2.md) is **done**: twelve
pathological fixtures live in `web/src/canvas/fixtures.ts` and render to snapshot SVGs in
`web/src/canvas/__fixtures__/`.

They are real `.svg` files, openable in a browser, carrying an inline stylesheet that stands in
for the design tokens. That is not a convenience — a snapshot nobody can look at tells you only
*that* something changed, and these exist to show *what*.

A failing snapshot is not automatically a bug. Routing work is supposed to move these files.
What the check guarantees is that they cannot move without someone seeing it.

Three assertions sit alongside them, because a snapshot proves the output did not change and
cannot prove it was ever right: one label per grouped edge, no `NaN` in any path, and distinct
fixture names.

Every routing bug found so far was found by *looking at output*, not by reading code — the
first two by screenshot, the third by fixture 05 on its first run. The fixtures make that
looking automatic.
