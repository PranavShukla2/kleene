# kleene-core

The algorithm core of [Kleene](https://github.com/PranavShukla2/kleene), an automata theory
workbench.

Pure algorithms. Zero I/O, zero geometry — this crate does not know what a pixel is.

## The one design decision

**Every algorithm returns its reasoning alongside its result.**

```rust
pub struct Traced<T> {
    pub result: T,
    pub steps: Vec<Step>,
}
```

`determinize()` does not return a DFA. It returns a DFA *and* the ordered list of
subset-construction rounds that produced it — each with the subset being expanded, the
symbol read, the resulting ε-closure, and whether the target subset was new or already seen.

This is not a debugging aid bolted on for a UI. It is the shape of the library, and it is
why one implementation can serve a browser step-through, a CLI `--verbose` mode, and
generated documentation without any of them re-deriving the explanation.

## Status

Early. See the [build plan](https://github.com/PranavShukla2/kleene/tree/main/docs/plan).

## License

MIT or Apache-2.0, at your option.
