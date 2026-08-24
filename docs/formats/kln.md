# The `.kln` format

Kleene's document format. A saved automaton, its layout, and its metadata, as JSON.

**Status: version 1, frozen 2026-08-24** (decision [D8](../plan/DECISIONS.md)).

From here, a change that removes a field or repurposes one bumps the version and needs a
migration path. **Adding an optional field does not** — old readers ignore it, new readers
default it — which is why the freeze is a much smaller commitment than it sounds. Provenance,
an author, a course code, a notation preference: all of those can still arrive without
breaking a single link.

---

## Example

```json
{
  "version": 1,
  "automaton": {
    "alphabet": ["a", "b"],
    "states": [
      { "id": 0, "label": "q0" },
      { "id": 1, "label": "q1" },
      { "id": 2, "label": "q2", "accepting": true }
    ],
    "start": 0,
    "transitions": [
      { "from": 0, "to": 1, "on": "a" },
      { "from": 0, "to": 0, "on": "b" },
      { "from": 1, "to": 1, "on": "a" },
      { "from": 1, "to": 2, "on": "b" },
      { "from": 2, "to": 1, "on": "a" },
      { "from": 2, "to": 0, "on": "b" }
    ]
  },
  "layout": {
    "0": { "x": 90, "y": 130 },
    "1": { "x": 186, "y": 130 },
    "2": { "x": 282, "y": 130 }
  },
  "meta": {
    "title": "Strings ending in ab"
  }
}
```

---

## Fields

### Top level

| Field | Type | Required | Meaning |
|---|---|---|---|
| `version` | integer | **yes** | Format version. See [Versioning](#versioning). |
| `automaton` | object | **yes** | The machine. |
| `layout` | object | no | Where states sit on screen. Omitted when empty. |
| `meta` | object | no | Title, description, date. Omitted when empty. |

### `automaton`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `alphabet` | array of string | **yes** | Σ, in a meaningful order — it fixes column order in transition tables and iteration order in traces. |
| `states` | array | **yes** | States **in order**. See [Why states are an array](#why-states-are-an-array). |
| `start` | integer | **yes** | Id of the start state. Must exist. |
| `transitions` | array | **yes** | See below. Order is preserved but carries no meaning. |

### A state

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | integer | **yes** | Unique within the machine. Referenced by `start` and by transitions. |
| `label` | string | **yes** | What the state is called on screen. Must be unique within the machine. |
| `accepting` | boolean | no | Defaults to `false`. |
| `origin` | array of integer | no | Which states of the *source* machine produced this one. |

`origin` is produced by subset construction and by minimization. It is what lets the UI answer
"where did this state come from?" — hovering a DFA state highlights the NFA states it stands
for.

**Kleene reads `origin` and does not write it**, decided at the freeze. It refers to ids in
whichever machine this one was derived from, and that machine is not in the file — so a saved
`origin` is a claim nothing can check. It was also expensive in the one place size matters:
22% of a five-state document, 28% of eleven, 34% of seventeen, and share links carry this
format through a URL fragment.

It still crosses the WebAssembly boundary, where the source machine *is* present. This is a
rule about documents, not about the shape of a machine.

Files that carry it — older ones, hand-written ones, ones from other tools — stay valid and
their `origin` is read. An `origin` of `[]` is not the same as an absent one: the empty subset
is the trap state.

### A transition

| Field | Type | Required | Meaning |
|---|---|---|---|
| `from` | integer | **yes** | Source state id. Must exist. |
| `to` | integer | **yes** | Target state id. Must exist. |
| `on` | string | no | Symbol read. **Absent means an ε-transition.** |

An absent `on` is an ε-transition rather than an error. That is the one piece of the format
worth reading twice, because `{"from": 0, "to": 1}` looks incomplete and is not.

Symbols must appear in `alphabet`. Multiple transitions may share a `(from, to)` pair — one
per symbol — and renderers collapse them into a single edge labelled `a, b`.

### Why states are an array

The obvious encoding is an object keyed by state id — `{"0": {…}, "2": {…}}` — and it is
wrong here, because **it cannot express order.**

Order would have to live in a *convention* about how keys are iterated, and the conventions
genuinely disagree: JSON defines object members as unordered, JavaScript iterates
integer-like keys in **ascending numeric order**, and Rust's `IndexMap` iterates in insertion
order. A machine whose ids are not allocated ascending would round-trip with its states
silently rearranged:

```text
in memory      [1, 9, 3]
after save     [1, 3, 9]   ← reordered, with no error anywhere
```

That matters here specifically, because trace reproducibility depends on iteration order. A
step-by-step explanation that comes out differently after a save is not an explanation.

An array carries order *in the data*: ordered in JSON, ordered in JavaScript, ordered in
Rust, with no convention to get wrong. It is also why one generated TypeScript type is
correct for both this format and the WebAssembly boundary, instead of being right for one and
quietly wrong for the other.

The id goes *inside* each state, rather than using `[id, state]` pairs, so the file stays
pleasant to read and to write by hand.

### `layout`

State id (as a string key) → `{ "x": number, "y": number }`, in the editor's coordinate space.

Layout is an object rather than an array because, unlike states, it carries no order — it is
a lookup from id to position, and a missing entry simply means "place this automatically".

States without an entry are positioned automatically, so a partial layout is valid; this is
what a file looks like after states are added to a machine loaded from elsewhere.

**Layout is deliberately outside `automaton`.** `kleene-core` does not know what a pixel is,
which is what lets one machine be rendered, exported to TikZ, and compared for equivalence
without any of those agreeing on a coordinate system. A *document*, though, is what a person
saved — losing their arrangement on every save would be unforgivable. So the format layers
presentation on top rather than folding it in.

### `meta`

| Field | Type | Meaning |
|---|---|---|
| `title` | string | Usually the language in words: *"Strings ending in ab"*. |
| `description` | string | When a title is not enough. |
| `created` | string | ISO-8601 date. |

---

## Versioning

`version` is checked **before** the rest of the document is parsed. A file from a newer
build produces *"This file was written by a newer version of Kleene"* rather than a parser
error about an unexpected field several levels down. That early check is the entire reason
the field exists.

- **Reading an older version:** supported. Fields added since are filled with defaults.
- **Reading a newer version:** refused, with a message saying to update.
- **What bumps the version:** removing a field, or changing what an existing one means.
  Adding an optional field does not — old readers ignore it and new readers default it.

## Validation on load

A document is refused if the machine is **malformed**: a transition to a state that does not
exist, a symbol outside the alphabet, a missing start state, two states sharing a label.

A document is **accepted** when the machine is merely odd — an unreachable state, no
accepting states, a missing transition. Those are normal in something someone is still
drawing, and refusing to open a work in progress would make the format useless as a working
file.

## Conventions

- **Encoding** is UTF-8. Symbols and labels may contain any character; `ε` and `∅` are
  ordinary characters here and carry no special meaning inside a label.
- **Order is explicit.** `states`, `alphabet` and `transitions` are arrays and their order is
  meaningful. `layout` is a lookup and carries none; its keys are written in ascending numeric
  order so a file does not reorder itself between saves.
- **Empty sections are omitted** rather than written as `{}` or `null`. Share links carry
  this format through a URL fragment (roadmap §2.6), where every byte counts.
- **Whitespace** is insignificant. Kleene writes indented JSON to a file and compact JSON
  into a share link.

## Related

- [`crates/kleene-core/src/io/json.rs`](../../crates/kleene-core/src/io/json.rs) — the implementation.
- [DECISIONS.md](../plan/DECISIONS.md) — D8, the format freeze.
- [phase-4.md](../plan/phase-4.md) — URL sharing, which encodes this format.
