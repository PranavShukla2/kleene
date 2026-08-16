# The `.kln` format

Kleene's document format. A saved automaton, its layout, and its metadata, as JSON.

**Status: version 1, not yet frozen.** The freeze happens in Phase 4 (decision
[D8](../plan/DECISIONS.md)), which is the last point it can change without a migration path —
after the first shared link exists in the wild, every change has to keep old links working.

---

## Example

```json
{
  "version": 1,
  "automaton": {
    "alphabet": ["a", "b"],
    "states": {
      "0": { "label": "q0" },
      "1": { "label": "q1" },
      "2": { "label": "q2", "accepting": true }
    },
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
| `states` | object | **yes** | State id (as a string key) → state. |
| `start` | integer | **yes** | Id of the start state. Must exist. |
| `transitions` | array | **yes** | See below. Order is preserved but carries no meaning. |

### A state

| Field | Type | Required | Meaning |
|---|---|---|---|
| `label` | string | **yes** | What the state is called on screen. Must be unique within the machine. |
| `accepting` | boolean | no | Defaults to `false`. |
| `origin` | array of integer | no | Which states of the *source* machine produced this one. |

`origin` is written by subset construction and by minimization. It is what lets the UI answer
"where did this state come from?" — hovering a DFA state highlights the NFA states it stands
for. It refers to ids in whichever machine this one was derived from, so it is only meaningful
alongside that machine; a document read on its own may safely ignore it.

An `origin` of `[]` is not the same as an absent one: the empty subset is the trap state.

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

### `layout`

State id (as a string key) → `{ "x": number, "y": number }`, in the editor's coordinate space.

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
- **Key order** is stable: `layout` keys are written in ascending numeric order, so a file
  does not reorder itself between saves and produce noise in version control.
- **Empty sections are omitted** rather than written as `{}` or `null`. Share links carry
  this format through a URL fragment (roadmap §2.6), where every byte counts.
- **Whitespace** is insignificant. Kleene writes indented JSON to a file and compact JSON
  into a share link.

## Related

- [`crates/kleene-core/src/io/json.rs`](../../crates/kleene-core/src/io/json.rs) — the implementation.
- [DECISIONS.md](../plan/DECISIONS.md) — D8, the format freeze.
- [phase-4.md](../plan/phase-4.md) — URL sharing, which encodes this format.
