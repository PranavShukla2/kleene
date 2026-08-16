# Decisions — things Claude will not guess

Every 🔴 marker in the phase documents resolves to a row here.

These are not tasks. They are questions where picking wrong is either **expensive to
reverse** or **teaches students something different from what the course teaches**. In both
cases a plausible default is worse than an open question, because a default gets built on
before anyone notices it was never really chosen.

**How to use this file:** answer the 🔥 rows before Phase 1 starts. Everything else can be
answered the week it blocks. Record answers inline under each decision, with the date, and
change the status. Do not delete a decision once answered — the reasoning is the valuable
part, and it is what stops the same question being reopened in week 9.

| Status | Meaning |
|---|---|
| 🔥 **BLOCKING** | Work stops here until answered. |
| ⏳ **SCHEDULED** | Needed by the phase named; not urgent yet. |
| 🟡 **DEFAULTED** | Claude picked something to keep moving. Reversible now, expensive later. |

---

## 🔥 Answer these before Phase 1

### D1 — Does `+` mean union, or one-or-more?

**Status:** 🔥 BLOCKING · **Blocks:** Phase 1 B2, B3 · **Cost to reverse:** very high

This is the first question because it is the one that cannot be quietly changed later.

- In **Hopcroft–Ullman**, in Kozen, and in most Indian TOC syllabi, `+` is **union**:
  `a + b` means "a or b", and Kleene plus is written `a⁺` or not used at all.
- In **every programming regex dialect** — PCRE, RE2, Rust's `regex` — `+` is
  **one-or-more**, and union is `|`.

One grammar cannot have both. Whichever is chosen, the parser is written against it, every
saved `.kln` file and every shared URL encodes regexes in it, and the differential test
against Rust's `regex` crate (roadmap §3.2) compares against it.

| Option | For | Against |
|---|---|---|
| **`+` = union** | Matches the textbook and the exam. Students type what the lecture wrote. | Confuses anyone arriving from programming. Differential testing needs a translation layer. |
| **`+` = one-or-more**, union is `|` only | Matches every tool a student has used. Differential testing is direct. | The syllabus's `a + b` silently means something else — the worst failure mode, since it parses fine and produces a wrong machine. |
| **Accept both, `+` = union, `⁺` = plus** | Textbook-first with an escape hatch. | Two ways to say one thing; the palette gets confusing. |

**Claude's recommendation:** `+` = **union**, with `|` also accepted as a synonym for union,
and one-or-more available only as `⁺` (or not at all in v1). Kleene's whole positioning is
"the tool that matches your course" — a student pasting `a + b` from the lecture slides and
getting a wrong machine with no error is the single worst outcome available here.

> **Answer:** _(unanswered)_

---

### D2 — Are alphabet symbols single characters, or multi-character tokens?

**Status:** 🔥 BLOCKING · **Blocks:** Phase 1 A2, B1 · **Cost to reverse:** high

Single characters (`a`, `b`, `0`, `1`) make the lexer trivial and match nearly all
coursework. Multi-character tokens (`id`, `num`, `while`) make Kleene usable for lexer
design, which is the adjacent course.

Reversing this touches the lexer, the parser, the alphabet panel, inline edge editing, TikZ
label emission, and the `.kln` schema.

**Claude's recommendation:** single characters in v1, but represent `Symbol` as a `String`
rather than a `char` from the first commit, so the widening is a parser change later rather
than a data-model migration.

> **Answer:** _(unanswered)_

---

### D4 — How are subset-construction states named?

**Status:** 🔥 BLOCKING · **Blocks:** Phase 1 C3, D3 · **Cost to reverse:** low–medium

Options: literal set notation (`{q1,q3}`), sequential relabelling with a legend
(`A = {q1,q3}`), or set notation on the canvas with relabelling in exports.

Set notation is self-explanatory but unreadable once subsets grow past three states — and
subset construction's whole drama is subsets growing. Sequential labels stay readable and
match how the textbook table is usually written, but hide the provenance the `origin` field
exists to surface.

**Claude's recommendation:** sequential labels (`A`, `B`, `C`) as the visible label, with the
subset shown in a tooltip, in the transition table, and in the step reasoning. That is what
`origin` is for (roadmap §2.3), and it keeps the diagram legible at 12 states.

> **Answer:** _(unanswered)_

---

### D7 — Is the empty string `ε` or `λ`?

**Status:** 🔥 BLOCKING · **Blocks:** Phase 1 A3, B4 · **Cost to reverse:** low, but it is everywhere

Purely notational, trivially implemented, and wrong-looking to a student whose course uses
the other one. It appears on edges, in regexes, in step prose, in TikZ output, and in the
docs.

**Claude's recommendation:** `ε` as the default (roadmap uses it throughout), implemented as
a **display setting** rather than a constant, so switching is a preference rather than a
find-and-replace. Cheap now, annoying later.

> **Answer:** _(unanswered)_

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

### D10 — Cloudflare Pages account and DNS

**Status:** ⏳ **Phase 0 E4** — needed for the Phase 0 exit criterion · **Claude cannot do this**

Needs: a Cloudflare Pages project, an API token added to the repo as a secret
(`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`), and a DNS record for
`kleene.pranavmshukla.in`.

`deploy.yml` is written and committed regardless; it goes green the hour the secrets land.
Everything else in Phase 0 proceeds without it.

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
