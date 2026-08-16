//! The semantic model: states, transitions, and the alphabet.
//!
//! Geometry lives deliberately **outside** this module. Nothing here knows what a pixel is
//! — positions belong to the document format, not to the machine. That separation is what
//! lets the same [`Automaton`] be rendered in a browser, printed by the CLI, and emitted as
//! TikZ without any of them disagreeing about what the machine actually is.

use std::collections::BTreeSet;

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

/// Identifies a state within one automaton.
pub type StateId = u32;

/// One symbol of the alphabet.
///
/// A `String` rather than a `char` on purpose. v1 only ever puts single characters in here,
/// but representing it as a string from the first commit means widening to multi-character
/// tokens later (`id`, `num`, `while`) is a parser change rather than a migration of every
/// saved document. See decision D2.
pub type Symbol = String;

/// A finite automaton — deterministic or not, with or without ε-transitions.
///
/// One type covers all three cases rather than three types, because the interesting
/// operations *move between* them. A DFA is not a different kind of object from the NFA it
/// was built from; it is the same object with a property that happens to hold.
///
/// Serializes through [`WireAutomaton`](crate::io::wire::WireAutomaton) rather than
/// directly. The in-memory shape is chosen for working with a machine — `IndexMap` gives
/// O(1) lookup while preserving order — and the wire shape is chosen for writing one down
/// unambiguously. Keeping them separate is what lets states be an ordered array on disk
/// without giving up id lookup in memory.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(into = "crate::io::wire::WireAutomaton", from = "crate::io::wire::WireAutomaton")]
pub struct Automaton {
    /// The input alphabet, Σ. Order is meaningful — it fixes column order in transition
    /// tables and iteration order in traces.
    pub alphabet: Vec<Symbol>,
    /// States, in insertion order.
    ///
    /// `IndexMap` rather than `HashMap` is a correctness requirement, not a preference.
    /// `HashMap` iteration order varies between runs, which would make traces
    /// non-reproducible and snapshot tests flaky — and a step-by-step explanation that
    /// comes out in a different order each time is not an explanation.
    pub states: IndexMap<StateId, State>,
    /// The start state.
    pub start: StateId,
    /// Transitions, in insertion order.
    pub transitions: Vec<Transition>,
}

/// A single state.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct State {
    /// What the state is called on screen: `q0`, `A`, `{q1,q3}`.
    pub label: String,
    /// Whether the state is accepting.
    ///
    /// Omitted from serialized output when false, and defaulted when absent. Most states
    /// in most machines are non-accepting, so writing `"accepting": false` on every one of
    /// them is pure waste inside a share link — and a format that *requires* the field
    /// makes a hand-written `.kln` file needlessly fussy to produce.
    #[serde(default, skip_serializing_if = "is_false")]
    pub accepting: bool,
    /// Provenance: which states of the *source* machine produced this one.
    ///
    /// Populated by subset construction and by minimization. This is what lets the UI
    /// answer "where did this DFA state come from?" by highlighting `{q1, q3, q4}` in the
    /// NFA pane when you hover it.
    ///
    /// It is three lines and it exists from the first commit because retrofitting it means
    /// re-deriving provenance that the algorithm already knew and threw away.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<BTreeSet<StateId>>,
}

impl State {
    /// A non-accepting state with no recorded provenance.
    pub fn new(label: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            accepting: false,
            origin: None,
        }
    }

    /// Mark this state as accepting.
    #[must_use]
    pub fn accepting(mut self) -> Self {
        self.accepting = true;
        self
    }

    /// Record which source states produced this one.
    #[must_use]
    pub fn from_origin(mut self, origin: impl IntoIterator<Item = StateId>) -> Self {
        self.origin = Some(origin.into_iter().collect());
        self
    }
}

fn is_false(value: &bool) -> bool {
    !*value
}

/// A transition from one state to another, on a symbol or on ε.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export, export_to = "generated/"))]
pub struct Transition {
    /// Source state.
    pub from: StateId,
    /// Target state.
    pub to: StateId,
    /// The symbol read. `None` is an ε-transition.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub on: Option<Symbol>,
}

impl Transition {
    /// A transition on a symbol.
    pub fn on(from: StateId, to: StateId, symbol: impl Into<Symbol>) -> Self {
        Self {
            from,
            to,
            on: Some(symbol.into()),
        }
    }

    /// An ε-transition.
    pub fn epsilon(from: StateId, to: StateId) -> Self {
        Self { from, to, on: None }
    }

    /// Whether this is an ε-transition.
    pub fn is_epsilon(&self) -> bool {
        self.on.is_none()
    }
}

impl Automaton {
    /// How many states the machine has.
    pub fn state_count(&self) -> usize {
        self.states.len()
    }

    /// Whether any transition is an ε-transition.
    pub fn has_epsilon(&self) -> bool {
        self.transitions.iter().any(Transition::is_epsilon)
    }

    /// Look up a state.
    pub fn state(&self, id: StateId) -> Option<&State> {
        self.states.get(&id)
    }

    /// Every transition leaving `from` on `symbol`.
    pub fn transitions_from(
        &self,
        from: StateId,
        symbol: Option<&str>,
    ) -> impl Iterator<Item = &Transition> {
        self.transitions
            .iter()
            .filter(move |t| t.from == from && t.on.as_deref() == symbol)
    }

    /// Classify the machine as an ε-NFA, an NFA, or a DFA.
    ///
    /// Recomputed rather than stored, because it is a property of the transitions and a
    /// stored copy would go stale on the next edit. The editor shows this live, which
    /// teaches the distinction for free every time an edit changes it.
    pub fn determinism(&self) -> Determinism {
        if self.has_epsilon() {
            return Determinism::EpsilonNfa;
        }

        let mut seen = BTreeSet::new();
        for t in &self.transitions {
            // A repeated (state, symbol) pair means two choices on one input: not a DFA.
            if !seen.insert((t.from, t.on.clone())) {
                return Determinism::Nfa;
            }
        }
        Determinism::Dfa
    }

    /// Whether every state has a transition for every symbol in Σ.
    ///
    /// Completeness is required before complement, and is also the thing courses disagree
    /// about drawing — hence surfacing it rather than silently completing.
    pub fn is_complete(&self) -> bool {
        self.states.keys().all(|&id| {
            self.alphabet
                .iter()
                .all(|sym| self.transitions_from(id, Some(sym)).next().is_some())
        })
    }
}

/// How deterministic a machine is.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Determinism {
    /// Has ε-transitions.
    EpsilonNfa,
    /// No ε-transitions, but some state has two moves on one symbol.
    Nfa,
    /// At most one move per (state, symbol).
    Dfa,
}

impl Determinism {
    /// The badge text shown in the editor.
    pub fn label(self) -> &'static str {
        match self {
            Self::EpsilonNfa => "ε-NFA",
            Self::Nfa => "NFA",
            Self::Dfa => "DFA",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::examples;

    #[test]
    fn ends_with_ab_is_a_complete_dfa() {
        let a = examples::ends_with_ab();
        assert_eq!(a.determinism(), Determinism::Dfa);
        assert!(a.is_complete(), "every state must move on every symbol");
        assert_eq!(a.state_count(), 3);
    }

    #[test]
    fn two_moves_on_one_symbol_is_an_nfa() {
        let mut a = examples::ends_with_ab();
        // q0 already moves to q1 on `a`; a second choice on the same symbol is what
        // nondeterminism is.
        a.transitions.push(Transition::on(0, 2, "a"));
        assert_eq!(a.determinism(), Determinism::Nfa);
    }

    #[test]
    fn an_epsilon_transition_outranks_nondeterminism() {
        let mut a = examples::ends_with_ab();
        a.transitions.push(Transition::epsilon(0, 1));
        assert_eq!(a.determinism(), Determinism::EpsilonNfa);
    }

    #[test]
    fn origin_survives_a_json_round_trip() {
        // The UI's hover-highlight depends on this surviving the FFI boundary.
        let s = State::new("A").from_origin([1, 3, 4]);
        let back: State = serde_json::from_str(&serde_json::to_string(&s).unwrap()).unwrap();
        assert_eq!(back.origin, Some(BTreeSet::from([1, 3, 4])));
    }

    #[test]
    fn a_non_accepting_state_omits_the_flag_and_reads_back() {
        // Most states in most machines are non-accepting, so writing the flag on every one
        // is waste inside a share link. Found by writing the format spec against the real
        // output rather than against the intended output.
        let json = serde_json::to_string(&State::new("q0")).unwrap();
        assert!(!json.contains("accepting"), "{json}");

        let back: State = serde_json::from_str(&json).unwrap();
        assert!(!back.accepting);
    }

    #[test]
    fn an_accepting_state_still_writes_the_flag() {
        let json = serde_json::to_string(&State::new("q0").accepting()).unwrap();
        assert!(json.contains("\"accepting\":true"), "{json}");
    }

    #[test]
    fn absent_origin_is_omitted_from_json() {
        let json = serde_json::to_string(&State::new("q0")).unwrap();
        assert!(
            !json.contains("origin"),
            "null origin wastes share-link bytes: {json}"
        );
    }
}
