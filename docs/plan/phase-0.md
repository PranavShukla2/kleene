# Phase 0 — De-risk the toolchain

**Week 1 · ~10 hrs**

> **Exit criterion:** a URL you can send someone that renders a DFA.

## Goal

Prove the whole vertical slice works — Rust compiles to wasm, wasm loads in React,
React renders an automaton, and the result is deployed at a public URL — before a single
algorithm is written. Everything built here is skeleton, not throwaway.

The roadmap says "ugly is fine". **This plan disagrees**, on one specific point: the SVG
renderer built here is the one Phase 2 extends, and its visual language is what every
screenshot of this project will show for the next three months. The *scope* stays tiny
(one hardcoded DFA, no interaction). The *quality bar* does not drop. See
[design-system.md](design-system.md), which is written as part of this phase precisely so
Phase 2 has something to conform to instead of inventing under time pressure.

## Work breakdown

### Track A — Rust workspace

- [ ] **A1.** `Cargo.toml` workspace root, `resolver = "3"`, shared `[workspace.package]`
      metadata (version, edition, license, repository) and a `[workspace.dependencies]`
      table so crate versions are declared once.
- [ ] **A2.** `crates/kleene-core` — library crate. One placeholder module and one real
      test so CI has something to run. `#![forbid(unsafe_code)]`, `#![warn(missing_docs)]`.
- [ ] **A3.** `crates/kleene-wasm` — `cdylib` + `rlib`, depends on core, `wasm-bindgen`.
- [ ] **A4.** `crates/kleene-cli` — binary crate, `clap` derive, `--version` works.
- [ ] **A5.** `rust-toolchain.toml` pinning the toolchain and components
      (`rustfmt`, `clippy`) so CI and local agree exactly.
- [ ] **A6.** `rustfmt.toml` + `clippy.toml`; `cargo fmt --check` and
      `cargo clippy -- -D warnings` both pass on an empty workspace.

### Track B — The FFI seam

This is the genuinely risky part and the reason Phase 0 exists. Do it before anything else
that looks more fun.

- [ ] **B1.** `kleene-wasm` exports one trivial function and one function that returns a
      **struct serialized to JS**, not just a number — the number case proves nothing about
      the boundary that matters. Use `serde-wasm-bindgen`, not `JSON.stringify` round-trips.
- [ ] **B2.** `wasm-pack build --target web` produces a `pkg/` that Vite can import.
- [ ] **B3.** A typed loader module in `web/src/wasm/` that initialises the module exactly
      once, is safe to call from multiple components, and surfaces a real error state
      rather than a hung promise if the `.wasm` fails to fetch.
- [ ] **B4.** Hand-written `.d.ts` ambient types are **not** acceptable — the types
      `wasm-pack` generates must be the ones the app consumes, so the FFI stays honest.
- [ ] **B5.** A React component calls into wasm on mount and displays the returned struct.
      Prove the round trip visibly, then delete the debug UI (keep the loader).

  🟡 **ASSUMPTION** — `wasm-pack` is not installed on this machine. It will be installed
  via `cargo install wasm-pack`. If the build turns out to be slow enough to be annoying,
  the fallback is `wasm-bindgen-cli` driven from a small build script.

### Track C — Web app shell

- [ ] **C1.** Vite + React + TypeScript, `strict: true`, path aliases configured.
- [ ] **C2.** Tailwind with the Kleene theme tokens from [design-system.md](design-system.md)
      — violet primary `#6D5EF8` / `#8B7CFF`, cyan secondary `#22D3EE`, JetBrains Mono for
      state labels and the regex input, the full light/dark token pair. Tokens go in CSS
      custom properties, referenced by Tailwind, so the desktop build and the docs site can
      consume the same palette. (The roadmap's original `#0D9488` teal is superseded.)
- [ ] **C3.** App shell: header, a content area, and nothing else. No routing yet.
- [ ] **C4.** Dark mode wired to `prefers-color-scheme` (system-following is the default
      for first-time visitors) with a manual override that persists to `localStorage`.
      Doing this now costs an hour; retrofitting it costs a day.
- [ ] **C5.** ESLint + Prettier, matching the Rust side's zero-warnings policy.

### Track D — The renderer (skeleton, but good)

- [ ] **D1.** `web/src/canvas/` — an SVG `<AutomatonView>` taking `{ automaton, layout }`
      and rendering it. Pure and presentational; no editing, no state.
- [ ] **D2.** State rendering: circle, label in JetBrains Mono, double-ring for accepting,
      start arrow. Get the accepting double-ring inset and the start-arrow geometry right
      here — they are the two details that make a diagram look hand-made vs generated.
- [ ] **D3.** Transition rendering: straight edges with a proper arrowhead marker, and a
      label placed off the midpoint along the edge normal so it never sits on the line.
- [ ] **D4.** Self-loop rendering. 🔵 **LEFTOVER CANDIDATE** — a single `loop above` case
      is enough for Phase 0; the free-space-aware version (`above/below/left/right`) is
      Phase 2 work and is explicitly deferred.
- [ ] **D5.** Hardcoded "even number of a's" 3-state DFA rendering correctly at both
      themes and at 2 viewport widths.

### Track E — CI/CD

- [ ] **E1.** `.github/workflows/ci.yml` — `fmt` → `clippy` → `test --workspace` →
      `wasm-pack build` → size check → `vitest`. Playwright is added in Phase 2 when
      there is an interaction worth testing.
- [ ] **E2.** Rust and npm caching, so CI runs in under three minutes. A slow CI is a CI
      you stop waiting for.
- [ ] **E3.** wasm size budget script — fail above **400 KB gzipped**, and *print the
      current size on every run* so the trend is visible before it becomes a problem.
- [ ] **E4.** `deploy.yml` — build web, deploy to Cloudflare Pages on push to `main`.
- [ ] **E5.** Branch protection on `main` requiring CI green.

  🔴 **DECISION D10** — Cloudflare Pages project + API token, and the DNS record for
  `kleene.pranavmshukla.in`. This needs Pranav's Cloudflare account; Claude cannot create
  it. Until the token exists as a repo secret, `deploy.yml` is written but will fail.

## Definition of done

- [ ] `cargo test --workspace` green, `cargo clippy -- -D warnings` clean.
- [ ] `wasm-pack build` succeeds and the artifact is under budget.
- [ ] `npm run build` in `web/` succeeds with zero TypeScript errors.
- [ ] CI is green on a PR, not just locally.
- [ ] A public URL renders the 3-state DFA, in both light and dark mode.
- [ ] Any deferred item is written into [LEFTOVERS.md](../../LEFTOVERS.md) with a reason.

## Known risks for this phase

| Risk | Mitigation being applied |
|---|---|
| wasm loading in Vite is fiddly | Exactly why this is Phase 0 and not Phase 3. `vite-plugin-wasm` if the default `?init` import path fights back. |
| Cloudflare account not ready | Deploy step is written and committed regardless; it goes green the hour the token lands. Everything else in the phase proceeds. |
| "Ugly is fine" becomes permanent | The design system is written *this phase*, before the editor exists. Phase 2 conforms rather than invents. |
| Toolchain drift between machine and CI | `rust-toolchain.toml` pins it. Non-negotiable. |

## Hooks for later phases

Cheap things done now so later phases are not blocked. None of these add v1 scope.

- **`Traced<T>` is defined in Phase 0**, not Phase 1, even though nothing produces steps
  yet. It is the shape of the library (roadmap §2.1) and every algorithm is written
  against it from its first line.
- **The `origin` field exists on `State` from the first commit.** It is
  three lines and retrofitting it is painful (roadmap §2.3).
- **Design tokens live in CSS custom properties**, so the Tauri shell, the docs site, and
  (later) Arena and Classroom all read the same palette without a second source of truth.
