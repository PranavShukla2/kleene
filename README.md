<div align="center">

# Kleene

**A browser-native automata theory workbench.**

Draw an automaton. Type a regular expression. Watch the conversion happen —
one subset-construction round at a time, with the reasoning attached to every step.

[kleene.pranavmshukla.in](https://kleene.pranavmshukla.in) · [Roadmap](docs/ROADMAP.md) · [Build plan](docs/plan/README.md)

</div>

---

## Status

**Phase 0 — de-risking the toolchain.** Not yet usable. See the
[phase plans](docs/plan/README.md) for what is being built and in what order,
and [LEFTOVERS.md](LEFTOVERS.md) for work deferred out of completed phases.

## What it is

Every CS department teaches formal languages, and nearly all of them point students
at JFLAP — a Java desktop app that needs a JRE, cannot share anything with a link,
and shows you results without showing you reasoning.

Kleene is the same subject, rebuilt around one idea: **every algorithm returns its
reasoning alongside its result.**

```rust
pub struct Traced<T> {
    pub result: T,
    pub steps: Vec<Step>,
}
```

`determinize()` does not return a DFA. It returns a DFA *and* the ordered list of
subset-construction rounds that produced it. The web UI renders `steps[i]` behind a
scrubber, the CLI prints them in verbose mode, and the docs generate examples from
them — one source of truth, three front ends.

## Planned for v1

| | |
|---|---|
| **Editor** | SVG canvas, drag states, draw transitions, undo/redo, auto-layout |
| **Conversions** | regex → ε-NFA → DFA → minimal DFA, each step-through-able |
| **Simulation** | Run a string, watch the configuration set move |
| **Export** | TikZ, SVG, PNG, Graphviz DOT |
| **Share** | The whole automaton in a URL fragment — no account, no server |
| **Import** | `.jff` files, so JFLAP users and course materials work on day one |
| **Offline** | Installable PWA, plus a ~6 MB Tauri desktop build |
| **CLI** | `kleene equiv student.kln reference.kln` — autograde 200 submissions |

Explicitly **not** in v1: pushdown automata, Turing machines, grammars, accounts,
collaborative editing.

## Repository layout

```
crates/kleene-core/   pure algorithms, zero I/O, zero pixels
crates/kleene-wasm/   thin wasm-bindgen wrapper
crates/kleene-cli/    clap binary
web/                  Vite + React + TypeScript
desktop/              Tauri v2 shell
docs/                 roadmap, phase plans, format specs
```

## Development

```sh
cargo test --workspace     # core algorithms + property tests
cd web && npm run dev      # web app against a locally built wasm bundle
```

## License

Dual-licensed under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option.
