# The `kleene` command line

Everything the web app does, in a script. It exists for the two jobs a browser is bad at:
grading a stack of submissions, and generating figures for a document from a build.

```sh
cargo install --path crates/kleene-cli    # or grab a binary from the releases page
kleene --help
```

## Inputs

Most commands take one `INPUT`, which may be:

|                         |                                  |
| ----------------------- | -------------------------------- |
| a regular expression    | `kleene convert "(a\|b)*abb"`    |
| a path to a `.kln` file | `kleene convert machine.kln`     |
| `-`, for standard input | `echo "a*b" \| kleene convert -` |

Which one you meant is detected. An argument naming an existing file is read as `.kln`, one
matching a key from `kleene examples` loads that machine, and anything else is a regular
expression. Piped text is read as `.kln` if it starts with `{` and
as an expression otherwise — the two cannot collide, because `{` is reserved in Kleene's
expression syntax.

Pass `--from regex` or `--from kln` when you would rather say than be guessed at. It is worth
doing in a script: a filename that has stopped existing is a _baffling parse error_ under
detection and a clear "cannot read" under `--from kln`.

### Expression syntax

Textbook notation, not programming regex. `+` or `|` for union, juxtaposition for
concatenation, `*` for Kleene star, `ε` for the empty string and `∅` for the empty language.
`?`, `[...]`, `{n,m}`, `.` and escapes are deliberately not supported, and saying so is the
error message you get rather than a silently different language.

## Global options

| Flag                        | What it does                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `-v`, `--verbose`           | Print the reasoning the engine produced while doing the work — the same sentences the web app shows under its scrubber. |
| `--json`                    | Machine-readable output instead of prose. What you want in a script.                                                    |
| `--from <auto\|regex\|kln>` | How to read `INPUT`. Defaults to `auto`.                                                                                |

## Commands

### `convert` — between representations

```sh
kleene convert "(a|b)*abb" --to dfa      # Graphviz DOT on stdout (the default)
kleene convert "(a|b)*abb" --to min
kleene convert "(a|b)*abb" --to regex
kleene convert machine.kln  --to nfa
```

`--to` takes `nfa` (the ε-NFA as Thompson's construction built it, undeterminized), `dfa`,
`min` for the minimal DFA, or `regex` to go back the other way by state elimination. The
default is `dfa`.

Going all the way round is a useful thing to do to your own answer:

```console
$ kleene convert "(a|b)*abb" --to regex
b*aa*b((a + b(a + bb*a))a*b)*b
```

That is a different expression from the one that went in, and it describes the same language.
`equiv` will tell you so.

### `minimize` — merge states no string can tell apart

```sh
kleene minimize machine.kln
kleene minimize "(a|b)*abb" --verbose
```

With `--verbose`, every round names the string that caused the split:

```console
$ kleene minimize "(a|b)*abb" --verbose
  1. Round 0 — split by acceptance: {E} | {A, B, C, D}. Any accepting state and any
     non-accepting state are already told apart by the empty string.
  2. Round 1 — {A, B, C, D} splits into {A, B, C} and {D}. The string `b` is accepted
     from D but rejected from A, which is what tells them apart.
  ...
5 states → 4 states
```

### `run` — does this machine accept this string

```sh
kleene run machine.kln "aabb"
kleene run "(a|b)*abb" "" --verbose      # the empty string
```

**Exits 0 when the string is accepted and 1 when it is rejected**, so it works in a
conditional:

```sh
if kleene run machine.kln "$word" >/dev/null; then echo "in the language"; fi
```

`--verbose` prints the configuration set after every symbol, which is how you find _where_ a
machine went wrong rather than only that it did.

### `equiv` — do two machines accept the same language

```sh
kleene equiv reference.kln submission.kln
kleene equiv reference.kln submission.kln --counterexample
```

**Exits 0 when they agree and 1 when they do not.** This is the command the CLI was built
for. With `-c` it names the shortest string they differ on, and which side accepts it:

```console
$ kleene equiv "a*" "b*" -c
not equivalent
  `a` is in a*, but b* rejects it.
```

A shortest counterexample is worth more than a verdict: it is the difference between "wrong"
and a piece of feedback a student can act on.

#### Grading a directory

```sh
#!/usr/bin/env bash
# Report every submission that does not match the reference.
for file in submissions/*.kln; do
  if ! kleene equiv reference.kln "$file" -c 2>&1 | tail -n +2; then
    echo "  ↑ $(basename "$file")"
  fi
done
```

Both machines go through the same minimization before comparison, so a correct answer drawn
with the states in a different order, or with unreachable states left lying around, still
counts as correct. Equivalence is about the language, not the drawing.

### `export` — write a machine out

```sh
kleene export machine.kln --format kln    # round-trip, keeping layout and title
kleene export machine.kln --format dot    # Graphviz
kleene export machine.kln --format tikz   # LaTeX, for a document
```

`--format tikz` is the one that closes the loop for anyone setting a problem sheet:

```sh
kleene export machine.kln --format tikz > figure.tex
```

A `.kln` file exports with the arrangement you made in the editor — that is the whole promise
of this export. A machine built from a regular expression has never been arranged, so it gets
a row, walked from the start state so the picture reads left to right. If you want better than
a row, open it in the editor and drag.

The output names the two packages it needs in a comment at the top, because the commonest way
this fails is a correct picture that will not compile in the document it was pasted into.

### `examples` — the built-in catalogue

```sh
kleene examples
kleene examples --json
```

The same twenty machines the gallery shows. Every one is a test fixture, so they are
guaranteed to be machines that work.

```console
$ kleene examples
even_number_of_as     2 states  DFA
ends_with_ab          3 states  DFA
...
```

Any command takes a key wherever it takes an input:

```sh
kleene run ends_with_ab "aab"
kleene export even_number_of_as --format tikz > figure.tex
kleene equiv even_number_of_as submission.kln -c
```

That last one is the quickest possible exercise: set one of the built-ins as the answer and
grade against it without writing a reference file.

## JSON output

`--json` replaces the prose with a structure, on every command:

```console
$ kleene equiv "a*" "b*" -c --json
{
  "candidate": "b*",
  "counterexample": {
    "accepted_by": "left",
    "input": "a"
  },
  "equivalent": false,
  "reference": "a*"
}
```

Exit codes are unchanged by `--json`, so a script can use whichever is more convenient.

## Exit codes

| Code | Meaning                                                                                            |
| ---- | -------------------------------------------------------------------------------------------------- |
| `0`  | Success — and for `run` and `equiv`, the affirmative answer.                                       |
| `1`  | The negative answer: the string was rejected, or the machines differ.                              |
| `2`  | Something was wrong with the input — a file that will not read, an expression that will not parse. |

`run` and `equiv` deliberately conflate "worked" with "yes", because that is what makes them
usable in a shell conditional without parsing their output. A genuine error is a `2`, so a
script can tell a wrong answer from a broken one.

## See also

- [The `.kln` format](formats/kln.md) — the file this reads and writes.
- [CONTRIBUTING.md](../CONTRIBUTING.md) — building from source.
