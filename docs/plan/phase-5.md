# Phase 5 — Ship v1

**Weeks 11–12 · ~20 hrs**

> **Exit criterion:** v1.0.0 tagged and public.

## Goal

Turn a working tool into a shipped product. The roadmap is blunt that build time is maybe
20% of whether this succeeds (§6) — this phase is most of the other 80%, and it is the
phase student projects skip.

**Do not add features this phase.** Anything discovered now goes to
[LEFTOVERS.md](../../LEFTOVERS.md) or a GitHub issue, not into the release. The failure mode
here is not shipping something imperfect; it is not shipping.

---

## Work breakdown

### Track A — PWA and offline

- [ ] **A1.** `vite-plugin-pwa` with a manifest, icons, and theme colors from
      design-system §2.
- [ ] **A2.** Service worker precaching the app shell, the `.wasm`, the font subsets, and
      the examples. The whole app is static assets plus one `.wasm`, which makes this a
      genuinely good PWA candidate rather than a checkbox (roadmap §2.5).
- [ ] **A3.** Verify true offline: load, airplane mode, hard refresh, everything still works.
      Including wasm — an app that loads offline but cannot convert anything is worse than
      an honest error.
- [ ] **A4.** Install prompt, shown at a sensible moment rather than on first paint.
- [ ] **A5.** Update flow — a non-intrusive "a new version is available, reload" prompt.
      A stale service worker serving last month's build is the classic PWA failure.

### Track B — Desktop (Tauri v2)

- [ ] **B1.** Tauri shell reusing the exact same `dist/` (roadmap §2.5).
- [ ] **B2.** Native file open/save for `.kln` and `.jff`, and OS file-association for `.kln`.
- [ ] **B3.** Builds for `x86_64-linux`, `aarch64-darwin`, `x86_64-windows`.
- [ ] **B4.** Verify the ~6 MB bundle claim and record the real number. The JFLAP comparison
      is only worth making if the figure is true.
- [ ] **B5.** 🔴 **DECISION D15** — code signing. Unsigned macOS builds show a scary
      Gatekeeper warning and unsigned Windows builds trip SmartScreen; certificates cost real
      money annually. Shipping unsigned with clear install instructions is a legitimate
      choice for v1, but it must be a choice, not a surprise.

### Track C — Examples

- [ ] **C1.** ~20 curated automata, one click to load (roadmap §5).
      🔴 **DECISION D14** — the list should track a real syllabus, not be invented.
- [ ] **C2.** Each carries a title and a one-line description of its language.
- [ ] **C3.** Cover the pedagogically important cases: an NFA whose subset construction
      blows up, a DFA that minimizes dramatically, one needing a trap state, one with ε-
      transitions worth tracing.
- [ ] **C4.** Examples double as fixtures — they run in CI, so a broken example is caught by
      a test rather than by a user.
- [ ] **C5.** A **gallery**, not a dropdown (roadmap §2.8). Each example is a card carrying its
      title, the language it accepts, what it demonstrates, and a difficulty tier. Browsable
      without an account, one click into the editor.
- [ ] **C6.** Tiers are honest and few — *introductory · standard · pathological*. Three levels
      a student can self-select into. "Advanced" as a label for "we ran out of adjectives"
      teaches nothing; **pathological** names the actual reason a machine is on the list, which
      is that it breaks the intuition the earlier ones build.
- [ ] **C7.** Filter by what an example *demonstrates* — ε-transitions, subset blow-up, a trap
      state, dramatic minimization — rather than only by tier. Someone arrives at a gallery
      looking for the thing they are stuck on, not for a difficulty.

### Track D — Documentation site

- [ ] **D1.** Astro Starlight at `/docs` (roadmap §2.2).
- [ ] **D2.** Getting started, with a working automaton on screen immediately.
- [ ] **D3.** An algorithms section, one page each, **generated from the `Traced` output** —
      the same steps the UI renders. Three consumers of one source of truth is the
      architecture's whole claim; this is where it gets demonstrated in public.
- [ ] **D4.** CLI reference.
- [ ] **D5.** `.kln` format spec (from Phase 4 D2).
- [ ] **D6.** A `/jflap-alternative` page — honest comparison, `.jff` import front and centre
      (roadmap §6.1). Honest means naming what JFLAP does better.
- [ ] **D7.** Tool landing pages, each a working tool with input prefilled, not a blog post
      (roadmap §6.1): `/tools/nfa-to-dfa`, `/tools/regex-to-nfa`, `/tools/dfa-minimizer`,
      `/tools/dfa-to-regex`, `/tools/dfa-to-latex`.

### Track E — Landing page

> **The shell was built early**, in Phase 2 Track K, so that everything after it could be seen
> and checked rather than described. This track no longer creates a page — it finishes one.
> Every feature named there carries the phase it lands in, so the work here is largely
> *removing markers as they come true*, and a marker still standing at v1 is a bug.

- [ ] **E1.** A **working automaton already on screen** — no signup, no upload, no video
      (roadmap §5). The demo is the landing page.
- [ ] **E2.** The step-through as the hero interaction. It is the hook (roadmap §6.3).
- [ ] **E3.** The JFLAP comparison table from roadmap §1.3.
- [ ] **E4.** Fast: no render-blocking fonts, wasm loaded after first paint. The landing page
      must not wait on a 400 KB wasm module to show something.
- [ ] **E5.** Open Graph and Twitter cards — shared links are the distribution mechanism, so
      the preview image matters more than usual.
- [ ] **E6.** A **first-run tour** inside the editor: skippable, dismissed permanently, and
      short (roadmap §2.8). Kleene's gestures are discoverable but not obvious — dragging from
      a state's *rim* draws a transition, not from its centre — and a tool that needs the
      shortcut sheet read before the first success has already lost most of its audience.

      Deliberately scheduled *here* rather than in Phase 2. A tour is documentation with a
      shorter feedback loop: writing it against gestures that are still moving means rewriting
      it, and a tour that describes a gesture the editor no longer has is worse than none.
- [ ] **E7.** The account-free path states what it lacks, plainly, once (roadmap §2.8). Not a
      nag — a line saying work stays in this browser and is not synced. When §9's teaching
      layer lands this is the sentence that keeps the signed-out mode honest instead of
      quietly worse.

### Track F — Release engineering

- [ ] **F1.** `release.yml` — cross-compile the CLI for three targets, build Tauri bundles,
      attach to a GitHub Release (roadmap §4).
- [ ] **F2.** Publish `kleene-core` to crates.io. 🔴 **DECISION D17** — name availability
      and the crates.io account are Pranav's.
- [ ] **F3.** `cargo dist` or equivalent for installers.
- [ ] **F4.** Changelog, generated from the commit history — which is why commits have been
      written to read as a build log from the first one.
- [ ] **F5.** Tag `v1.0.0`.

### Track G — Project hygiene

- [ ] **G1.** `CONTRIBUTING.md` — how to build, test, and what the architecture rules are.
- [ ] **G2.** Issue and PR templates.
- [ ] **G3.** Open issues for the v1.4 exclusions (PDA, TM, CFG) so the mental loop closes
      (roadmap §7) and users have somewhere to put the request.
- [ ] **G4.** `SECURITY.md`, `CODE_OF_CONDUCT.md`.
- [ ] **G5.** README with a screenshot or GIF of the step-through.
- [ ] **G6.** Confirm license headers and the dual-license note.

### Track H — Analytics

- [ ] **H1.** Umami or Plausible — cookieless, no banner, nothing to defend (roadmap §6.4).
      🔴 **DECISION D11** — Umami self-hosted (free, needs a host) vs Plausible (paid,
      zero maintenance).
- [ ] **H2.** Track: unique visitors, tool pages by referrer, TikZ exports, share links
      created, GitHub stars, known faculty adoptions.
- [ ] **H3.** These numbers exist because *"3,000 students used this last semester"* is a
      resume line and *"I built an automata tool"* is not (roadmap §6.4).

### Track I — Launch

- [ ] **I1.** Email Dr. Paras Jain first (roadmap §6.2) — a tool using his terminology and
      his method, with a shared link that works in one click.
- [ ] **I2.** Find TOC course pages linking to JFLAP; email those instructors. Lead with
      TikZ export and the autograder, not the feature list.
- [ ] **I3.** Show HN, with the step-through subset construction as the hook.
- [ ] **I4.** r/compsci, r/ProgrammingLanguages, r/rust.
- [ ] **I5.** `awesome-compilers`, `awesome-wasm`, `awesome-rust` PRs.
- [ ] **I6.** Blog post: *"Property-testing an automata library, or: how regex → DFA → regex
      found my bugs"*.
- [ ] **I7.** Do **not** use "JFLAP" in the product name or domain (roadmap §7). Comparison
      pages are normal; trading on the name is not.

---

## Definition of done

- [ ] Installable and fully functional offline.
- [ ] Desktop builds exist for three platforms and have been launched at least once each.
- [ ] ~20 examples load in one click and are covered by CI.
- [ ] Docs cover getting started, algorithms, CLI, and the format.
- [ ] The landing page shows a working automaton with no interaction required.
- [ ] The example gallery is browsable without an account, and every card opens in one click.
- [ ] A first-time visitor reaches their first working automaton without opening the docs.
- [ ] `v1.0.0` tagged; CLI binaries and desktop bundles attached to the release.
- [ ] `kleene-core` published to crates.io.
- [ ] At least the first launch email has been sent. A shipped tool nobody was told about
      is not shipped.

## Known risks for this phase

| Risk | Mitigation |
|---|---|
| **Feature creep in the final week** | No features. Everything found goes to LEFTOVERS or an issue. The failure mode is not shipping something imperfect — it is not shipping. |
| Service worker serves a stale build | A5's update prompt, tested by deploying twice. |
| Unsigned binaries look like malware | D15 is a real decision with a real cost. Whichever way it goes, install instructions must set expectations. |
| Launch lands with nobody watching | §6 is a plan, not a hope. I1 and I2 are the ones that matter; HN is a lottery ticket. |
| Docs go stale immediately | D3's generated algorithm pages come from `Traced` output, so they cannot drift from the implementation. |

## After v1

Nothing in this document continues into v1.1. See [teaching-layer.md](teaching-layer.md),
and re-read roadmap §1.4 before agreeing to anything.
