# Decisions — things Claude will not guess

Every 🔴 marker in the phase documents resolves to a row here.

These are not tasks. They are questions where picking wrong is either **expensive to
reverse** or **teaches students something different from what the course teaches**. In both
cases a plausible default is worse than an open question, because a default gets built on
before anyone notices it was never really chosen.

**How to use this file:** the 🔥 rows that blocked Phase 1 are all answered — see
[Answered](#answered) at the bottom. Everything remaining can be answered the week it blocks. Record answers inline under each decision, with the date, and
change the status. Do not delete a decision once answered — the reasoning is the valuable
part, and it is what stops the same question being reopened in week 9.

| Status | Meaning |
|---|---|
| 🔥 **BLOCKING** | Work stops here until answered. |
| ⏳ **SCHEDULED** | Needed by the phase named; not urgent yet. |
| 🟡 **DEFAULTED** | Claude picked something to keep moving. Reversible now, expensive later. |

---

## ⏳ Answer these when the phase arrives

### D5 — Is the trap state shown by default?

**Status:** ⏳ Phase 2 · **Blocks:** Phase 1 C5's UI treatment, Phase 2 E3

A complete DFA needs a trap state for every missing transition, and drawing it doubles the
edge count for a machine that is conceptually unchanged. Some courses insist DFAs are drawn
complete; others always omit it.

**Recommendation:** hidden by default with a visible toggle, and always shown when the
operation being demonstrated requires it (complement). Whichever way, the *badge* in Phase 2
E4 should say whether the machine is complete.

### D6 — What order does state elimination remove states in?

**Status:** ⏳ Phase 1 E1 · **Blocks:** Phase 1 E1, Phase 3 F3

Elimination order does not change correctness but changes the output regex size
enormously — a bad order produces something ten times longer. Common heuristics: fewest
in-degree × out-degree first, or textbook order (as numbered).

Also pedagogical: if the course works examples in a fixed order, matching it means the
student's hand-worked answer and the tool's agree line for line.

**Recommendation:** default to the min-degree-product heuristic for quality, with a
"textbook order" toggle, and make the order visible either way (Phase 3 F3).

### D8 — Freeze the `.kln` format

**Status:** ⏳ **Hard deadline: Phase 4 D2** · **Blocks:** Phase 4 D2, teaching layer A4

Not a design question so much as a commitment point. The moment one shared link exists in
the wild, every change needs a migration path. Phase 4 is the last week it can change freely.

**What is needed:** a read-through of `docs/formats/kln.md` and a yes.

### D9 — Which two panes are the default on a small screen?

**Status:** ⏳ Phase 3 B2

Four panes do not fit on a 1366×768 laptop. Candidates: **ε-NFA | DFA** (the conversion
everyone comes for) or **regex | DFA** (input and result).

**Recommendation:** ε-NFA | DFA, since the pipeline's selling point is the conversion, not
the endpoints.

### D11 — Umami or Plausible?

**Status:** ⏳ Phase 5 H1

Umami is free but needs somewhere to run and to be maintained. Plausible is ~$9/month and
needs nothing. Both are cookieless with no banner (roadmap §6.4).

**Recommendation:** Plausible if the budget exists, because a self-hosted analytics instance
is another thing that can be down during launch week. Umami otherwise — the numbers matter
more than the hosting model.

### D12 — Confirm the license

**Status:** 🟡 DEFAULTED · **Reversible until:** the first outside contribution

Roadmap §5 says "MIT or Apache-2.0". Claude committed **dual MIT/Apache-2.0**, the Rust
ecosystem convention and what crates.io consumers expect. Flagged rather than assumed
because relicensing after contributions requires every contributor's agreement.

### D13 — Wordmark, favicon, and OG image

**Status:** ⏳ Phase 5 E5

The design system fixes the palette and type, but not the mark. Share links are the
distribution mechanism (roadmap §2.6, §6.1), so the OG preview image does real work.

**Claude can produce** an SVG wordmark in the project's type and palette. **Pranav decides**
whether it is the identity.

### D14 — The corpora

**Status:** ⏳ Phase 4 E4, Phase 5 C1, teaching layer C1 · **Claude cannot invent these**

Three collections that must come from reality, not imagination:

1. **`.jff` fixtures** — real files from public course repos, for import testing
   (roadmap §3.2). Hand-written samples will not exercise JFLAP's real quirks.
2. **~20 example automata** — should track a real syllabus so they are recognisable.
3. **~20 problem set entries** (v1.1) — a teaching artifact. Ordering is the hard part and
   it is a teaching judgement.

**What is needed:** links to course repos, and either your CSE2004 problem sheets or a
pointer to what the sequence should be.

### D15 — Code signing for desktop builds

**Status:** ⏳ Phase 5 B5 · **Has an annual cost**

Unsigned macOS builds trip Gatekeeper; unsigned Windows builds trip SmartScreen. Certificates
cost real money per year (Apple Developer ~$99/yr; a Windows OV cert similar or more).

**Recommendation:** ship v1 unsigned with clear install instructions, and revisit if desktop
downloads turn out to matter. The web app is the product; desktop is a proof point about
bundle size against JFLAP's JRE. But it should be a decision, not a surprise at the first
bug report.

### D16 — TikZ live preview

**Status:** ⏳ Phase 4 B3

A true preview needs a LaTeX renderer in the browser — a large dependency that fights the
400 KB wasm budget (roadmap §3.2).

| Option | Cost |
|---|---|
| No preview, just the source and a copy button | Free. Slightly disappointing. |
| SVG approximation of what TikZ will produce | Cheap, honest if labelled, occasionally slightly off. |
| Real LaTeX in browser | Accurate, and blows the size budget. |

**Recommendation:** the SVG approximation, labelled as an approximation. It is what the
canvas already renders.

### D17 — crates.io account and the `kleene-core` name

**Status:** ⏳ Phase 5 F2 · **Claude cannot do this**

Needs the name checked for availability and a crates.io account with an API token.
Worth checking **early** — if `kleene-core` is taken, the fallback name should be settled
long before release week.

### D18 — Size caps in the browser

**Status:** ⏳ Phase 3 G2

A pathological regex can produce a DFA with thousands of states and a trace with thousands
of steps. Some limit must exist or a tab locks up.

**Recommendation:** cap the *trace*, not the computation — compute the full result, but stop
recording steps past ~500 and say so in the UI. The answer stays correct; only the
explanation is truncated, which is the right thing to lose.

### D19 — How adversarial is the pumping lemma game?

**Status:** ⏳ v1.2 (teaching layer E2) · **This is a teaching judgement**

If the machine always plays optimally, a first-time student loses every round and concludes
the lemma is impossible. If it plays randomly, they win without understanding and conclude
it is trivial. Neither teaches.

**Recommendation:** difficulty that adapts — a forgiving decomposition on the first attempt
at a language, optimal play thereafter. But this is exactly the kind of thing to playtest on
classmates before committing to.

---

## Answered

*(Move decisions here once resolved, with the answer, the date, and the reasoning.)*

### D0 — Accent palette · **Answered 2026-08-15**

The roadmap's `#0D9488` teal is superseded by a **violet primary** (`#6D5EF8` light /
`#8B7CFF` dark) with **cyan secondary** (`#0891B2` light / `#22D3EE` dark). Theme follows
the system by default, with a persisted manual override.

Chosen for a brighter, lighter feel than the original teal while keeping five semantic hues
that stay distinguishable as thin strokes. Recorded in full in
[design-system.md](design-system.md).

### D3 — Which minimizer is the primary, explainable one? · **Answered 2026-08-16**

**Both methods were taught in CSE2004**, so the question dissolves: the tool must be able to
show either, and neither can be the "alternative view" tucked behind a menu.

That turns out to cost far less than building two minimizers, because **table-filling is the
dual of partition refinement, not a different algorithm**. A pair `(p, q)` is marked at round
*k* by the table method exactly when `p` and `q` first fall into different blocks at round *k*
of refinement — both are computing "distinguishable by some string of length ≤ k", from
opposite ends.

The witness reconstruction is shared too. If `(p, q)` separates at round *k* via symbol `a`,
its distinguishing string is `a · w`, where `w` is the witness for
`(δ(p,a), δ(q,a))` at round *k−1*, bottoming out at `ε` for the round-0 accepting/
non-accepting split. That is exactly the back-pointer Phase 1 D2 already requires — so the
marking table's round numbers and the distinguishing strings come out of one mechanism.

**Resolution:**

- `convert/minimize.rs` implements **Moore partition refinement**, traced, as the engine.
- The marking table is **derived from the refinement trace**, not computed separately. A
  second implementation would be a second thing to keep correct for no gain.
- Phase 3 renders **both views as equals**, switchable, from the same `Traced` output.
- Default view: partition refinement, since it is the engine's natural shape. Trivially
  changed once there is something to look at.

**Consequence worth noting:** this makes the derived table a *property test target* — the
marking table and the refinement rounds must agree on which pairs are distinguishable and on
each witness, which is a strong internal consistency check that neither view provides alone.

### D1 — Does `+` mean union, or one-or-more? · **Answered 2026-08-16**

**`+` means union.** `|` is accepted as a synonym. One-or-more is written `aa*`; a
superscript `⁺` may be added to the symbol palette later without breaking anything already
saved.

The deciding argument was not "the textbook wins" but an asymmetry in how each choice fails:

- Under **union**, someone assuming the programming convention writes `a+`, the right operand
  is missing, and they get a **syntax error** — which carries a specific message
  (*"`+` means union here. For one-or-more, write `aa*`."*) and teaches them something.
- Under **one-or-more**, someone pasting `a + b` from a lecture slide gets `a⁺b`. It parses
  cleanly, builds the wrong machine, and **reports nothing**. They then debug their own
  understanding of subset construction rather than their input.

For a tool whose users do not yet know when they are wrong, a loud failure beats a silent one
regardless of which convention is more "correct". Phase 1 B3 owes the dedicated error message.

### D2 — Single characters or multi-character tokens? · **Answered 2026-08-16**

**Single characters** in v1 (`a`, `b`, `0`, `1`).

`Symbol` is already `String` rather than `char` in `automaton.rs`, so widening to
multi-character tokens later is a lexer and parser change rather than a migration of every
saved `.kln` file and every shared URL. The escape hatch costs nothing today and is already
in place.

### D4 — How are subset-construction states named? · **Answered 2026-08-16**

**Sequential labels on the canvas, provenance everywhere else.** States read `A`, `B`, `C`;
the subset appears in a legend, on hover, in the transition table, and in the step prose
(*"Reading `a` from B = {q1, q3} reaches {q2, q4} — new state C."*).

Set notation is self-explanatory at two elements and unreadable at five, and subset
construction's entire drama is subsets **growing** — so literal set labels degrade exactly as
the diagram becomes worth looking at. A 24px state circle cannot hold `{q1,q2,q4,q7}` without
reflowing the whole diagram on every step.

This is what `State::origin` exists for (roadmap §2.3): the provenance is carried in the
model, so nothing is lost by keeping the label short. Cheap to expose as a toggle later,
since it only affects label rendering.

### D7 — Is the empty string `ε` or `λ`? · **Answered 2026-08-16**

**`ε` by default, implemented as a display setting rather than a constant.**

It appears on edges, in regexes, in step prose, in TikZ output (`\varepsilon`) and in the
docs, so hard-coding it would make a change a find-and-replace across the codebase and every
exporter. As a setting, a course that writes `λ` flips one preference and every surface
follows.

### D10 — Cloudflare Pages account and DNS · **Answered 2026-08-16**

Secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set on the repository, and
**Phase 0's exit criterion is met**: <https://kleene.pages.dev> renders the `ends_with_ab`
DFA, in both themes, with no console errors.

The Pages project is created by `deploy.yml` rather than by hand, so the repository needs
only the two secrets to bootstrap — there is no dashboard setup step to write down and let
drift.

**The custom domain is still outstanding.** `pranavmshukla.in` is on GoDaddy nameservers
(`domaincontrol.com`), not Cloudflare, with the apex pointing at Vercel. Attaching
`kleene.pranavmshukla.in` therefore does **not** require moving the zone, and should not:
that would put the existing portfolio's DNS through an unnecessary migration for the sake of
one subdomain. A `CNAME` from `kleene` to `kleene.pages.dev` at GoDaddy, plus adding the
custom domain in the Pages project, is the whole job.
