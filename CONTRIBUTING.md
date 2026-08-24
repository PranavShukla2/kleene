# Contributing to Kleene

Thanks for looking. This file is the short version of how the project is built and what it
will and won't accept — enough that you can get a change landed without reading the roadmap.

If something here is wrong or out of date, that's a bug worth reporting on its own.

## Getting it running

You need [Rust](https://rustup.rs) (the version is pinned in `rust-toolchain.toml`; rustup
reads it automatically), [Node 24+](https://nodejs.org), and
[`wasm-pack`](https://rustwasm.github.io/wasm-pack/installer/).

```sh
git clone https://github.com/PranavShukla2/kleene
cd kleene
cargo test --workspace          # the engine, no toolchain beyond Rust needed

cd web
npm install
npm run dev                     # builds the wasm, then serves the app
```

`npm run dev` compiles the Rust to WebAssembly first, so the first run is slow and every
one after it is not. If you are only changing the web app, `npx vite` skips that step and
uses whatever wasm you last built.

## Before you open a pull request

```sh
./scripts/check.sh
```

That runs everything CI runs, in the order CI runs it: `cargo fmt`, `clippy` with warnings
denied, the Rust tests, a check that the generated TypeScript is not stale, the wasm size
budget, then eslint, prettier, `tsc` and the web tests.

It exists because CI once went red for four commits without anyone noticing — local
verification was thorough but partial, and one command that runs the whole gate is harder to
do half of. Run it rather than assembling the pieces yourself.

The end-to-end tests are separate because they build the app and drive a real browser:

```sh
cd web && npx playwright test
```

## How the project is laid out

```
crates/kleene-core     the algorithms. no I/O, no geometry, no wasm.
crates/kleene-wasm     the boundary. serialisation and nothing else.
crates/kleene-cli      the terminal front end.
web/                   the React app.
docs/plan/             what is being built, in what order, and why.
```

## The rules that are not negotiable

Four things hold this design together. A change that breaks one of them will be sent back
even if it is otherwise good, so it is worth knowing them before you start.

**1. Every algorithm returns its reasoning.**

```rust
pub struct Traced<T> {
    pub result: T,
    pub steps: Vec<Step>,
}
```

`determinize()` does not return a DFA. It returns a DFA _and_ the ordered subset-construction
rounds that produced it. This is the whole point of the project: one implementation serves the
browser step-through, the CLI's verbose mode and the generated docs, with no second copy of the
explanation to drift out of sync. A new conversion that returns a bare result — with the
explanation written separately for the UI — is the thing this codebase exists to avoid.

**2. `kleene-core` does not know what a pixel is.**

No I/O, no layout, no coordinates, no `wasm-bindgen`. It compiles and tests as a plain Rust
library on any target. Geometry lives in the web app; the boundary lives in `kleene-wasm`.

**3. There is no backend.**

Everything runs in the browser. No accounts, no server, no telemetry in the hot path. A
student's work is a file they hold and a link they can paste. Features that need a server are
not small versions of features that don't — they are a different product, and this one is
deliberately not it.

**4. The wasm bundle has a budget.**

400 KB gzipped, checked in CI by `scripts/check-wasm-size.mjs`. A student on a bad connection
in a lab is the user this protects. If a dependency pushes past it, the dependency needs to
justify itself.

## Generated files

The TypeScript types in `web/src/model/generated/` are produced from the Rust types by
`ts-rs` and **committed**, so the web build never needs a Rust toolchain. If you change a type
that crosses the boundary, run:

```sh
./scripts/generate-types.sh
```

and commit the result. CI diffs these files and fails if they are stale.

## Commits

Commit messages are written to read as a build log — what changed, and why it needed to.
Present tense, a real subject line, and a body when the _why_ is not obvious from the diff.
Small commits are preferred over large ones; one logical change each.

Please don't add AI-assistant trailers (`Co-Authored-By: Claude`, `Generated with …`) to
commits or pull requests.

## Tests

New algorithms want three kinds of test, and the existing ones are the pattern to copy:

- **Unit tests**, in the same file, for the cases you thought about.
- **Property tests** (`proptest`) for the ones you didn't. The pipeline closes on itself —
  `regex → ε-NFA → DFA → minimal DFA → regex` — so most invariants can be stated as _the
  language is unchanged_, and `counterexample` will name the shortest string that disagrees.
- **A differential test** against Rust's `regex` crate where the semantics overlap. This is
  what found the real bugs.

For the web app: Vitest for logic, Playwright for anything a user does with a pointer.

## What is in scope

Regular languages, in full: automata, regular expressions, the conversions between them, and
the reasoning behind each one.

Pushdown automata, Turing machines and context-free grammars are **out of scope for v1** and
tracked as issues rather than declined outright. They are a larger subject that deserves more
than a corner of this one.

## Reporting things

- **A bug** — the machine you had, what you expected, and what happened. A share link is the
  fastest possible bug report; the button is in the editor.
- **A security issue** — see [SECURITY.md](SECURITY.md). Please don't open a public issue.
- **A conduct issue** — see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Licence

Dual-licensed under [MIT](LICENSE-MIT) or [Apache 2.0](LICENSE-APACHE), at your option — the
Rust ecosystem's convention. Contributions are accepted under the same terms.
