//! How an automaton is written down.
//!
//! The in-memory model and the serialized shape are deliberately different types, because
//! they are answering different questions. [`Automaton`] is optimised for *working with* a
//! machine — `IndexMap` gives O(1) lookup by id while preserving insertion order. This module
//! is optimised for *writing one down* unambiguously.
//!
//! ## Why states are an array and not an object
//!
//! The obvious encoding is an object keyed by state id:
//!
//! ```jsonc
//! "states": { "0": { "label": "q0" }, "2": { "label": "q2" } }
//! ```
//!
//! It cannot express order. Order would have to live in a *convention* about how keys are
//! iterated — and the conventions genuinely differ: `IndexMap` iterates in insertion order,
//! a JavaScript object iterates integer-like keys in **ascending numeric order**, and JSON
//! itself defines object members as unordered. So a machine whose ids are not allocated
//! ascending round-trips with its state order silently changed.
//!
//! That matters here specifically because trace reproducibility depends on iteration order
//! (see [`Automaton::states`]). A step-by-step explanation that comes out differently after a
//! save is not an explanation.
//!
//! An array carries order *in the data*. It is ordered in JSON, ordered in JavaScript, and
//! ordered in Rust, with no convention to get wrong — so one generated TypeScript type is
//! correct across both the `.kln` format and the wasm boundary, rather than being correct for
//! one and quietly wrong for the other.
//!
//! Putting the id inside each state, rather than using `[id, state]` pairs, keeps a
//! hand-written `.kln` file pleasant to read and to produce.

use std::collections::BTreeSet;

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use crate::automaton::{Automaton, State, StateId, Symbol, Transition};

/// A state as it appears in a file, carrying its own id.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "State")
)]
pub struct WireState {
    /// The state's id, unique within the machine.
    pub id: StateId,
    /// What the state is called on screen.
    pub label: String,
    /// Whether the state is accepting. Omitted when false.
    #[serde(default, skip_serializing_if = "is_false")]
    pub accepting: bool,
    /// Which states of the source machine produced this one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub origin: Option<BTreeSet<StateId>>,
}

fn is_false(value: &bool) -> bool {
    !*value
}

/// An automaton as it appears in a file.
///
/// [`Automaton`] serializes and deserializes *through* this type, so every format — `.kln`,
/// the wasm boundary, a share link — sees the same shape.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "Automaton")
)]
pub struct WireAutomaton {
    /// The input alphabet, Σ.
    pub alphabet: Vec<Symbol>,
    /// States, in order.
    pub states: Vec<WireState>,
    /// Id of the start state.
    pub start: StateId,
    /// Transitions.
    pub transitions: Vec<Transition>,
}

impl From<Automaton> for WireAutomaton {
    fn from(automaton: Automaton) -> Self {
        Self {
            alphabet: automaton.alphabet,
            states: automaton
                .states
                .into_iter()
                .map(|(id, state)| WireState {
                    id,
                    label: state.label,
                    accepting: state.accepting,
                    origin: state.origin,
                })
                .collect(),
            start: automaton.start,
            transitions: automaton.transitions,
        }
    }
}

impl From<WireAutomaton> for Automaton {
    fn from(wire: WireAutomaton) -> Self {
        let mut states = IndexMap::with_capacity(wire.states.len());

        // Array order becomes insertion order, which is the whole point of the encoding.
        // A duplicate id overwrites rather than erroring — `validate()` reports it as a
        // structural problem, and reading a file should surface every fault at once rather
        // than stopping at the first.
        for state in wire.states {
            states.insert(
                state.id,
                State {
                    label: state.label,
                    accepting: state.accepting,
                    origin: state.origin,
                },
            );
        }

        Self {
            alphabet: wire.alphabet,
            states,
            start: wire.start,
            transitions: wire.transitions,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::builder::AutomatonBuilder;
    use crate::examples;

    #[test]
    fn a_machine_survives_the_round_trip() {
        let before = examples::ends_with_ab();
        let after: Automaton = WireAutomaton::from(before.clone()).into();
        assert_eq!(after, before);
    }

    #[test]
    fn state_order_survives_ids_that_are_not_ascending() {
        // The case an object-keyed encoding gets wrong. JavaScript iterates integer-like
        // keys in ascending numeric order, so `{"5":…,"1":…}` would come back as 1 then 5 —
        // silently reordering the machine and, with it, every trace derived from it.
        let mut automaton = AutomatonBuilder::new(["a"]).build();
        automaton.states.insert(5, State::new("first"));
        automaton.states.insert(1, State::new("second"));
        automaton.start = 5;

        let wire = WireAutomaton::from(automaton.clone());
        assert_eq!(wire.states.iter().map(|s| s.id).collect::<Vec<_>>(), [5, 1]);

        let back: Automaton = wire.into();
        assert_eq!(back.states.keys().copied().collect::<Vec<_>>(), [5, 1]);
    }

    #[test]
    fn json_shows_states_as_an_array_with_ids_inside() {
        let json = serde_json::to_string(&examples::even_number_of_as()).expect("serializes");
        assert!(json.contains(r#""states":[{"id":0"#), "{json}");
    }

    #[test]
    fn a_non_accepting_state_omits_the_flag() {
        // Most states in most machines are non-accepting, and a share link pays for every
        // byte of `"accepting":false`.
        let json = serde_json::to_string(&examples::ends_with_ab()).expect("serializes");
        assert!(!json.contains("\"accepting\":false"), "{json}");
        assert!(json.contains("\"accepting\":true"), "{json}");
    }

    #[test]
    fn automaton_serializes_through_the_wire_type() {
        // The point of the serde attributes: nothing else in the codebase has to know the
        // wire shape exists.
        let before = examples::ends_with_ab();
        let text = serde_json::to_string(&before).expect("serializes");
        let after: Automaton = serde_json::from_str(&text).expect("deserializes");
        assert_eq!(after, before);
    }
}
