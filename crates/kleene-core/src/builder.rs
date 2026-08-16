//! A readable way to construct automata.
//!
//! This exists because of how much depends on it. Every test in the engine builds a machine
//! by hand, every example is written this way, and every bug report will be reduced to one.
//! If constructing a 4-state DFA takes twenty lines of `IndexMap` bookkeeping, tests get
//! written grudgingly and stay shallow — so the ergonomics here are a correctness concern
//! at one remove.
//!
//! ```
//! use kleene_core::builder::AutomatonBuilder;
//!
//! // Strings over {a, b} with an even number of a's.
//! let dfa = AutomatonBuilder::new(["a", "b"])
//!     .state("q0")
//!     .accepting("q1")
//!     .start("q0")
//!     .edge("q0", "q1", "a")
//!     .edge("q1", "q0", "a")
//!     .edge("q0", "q0", "b")
//!     .edge("q1", "q1", "b")
//!     .build();
//!
//! assert_eq!(dfa.state_count(), 2);
//! ```

use indexmap::IndexMap;

use crate::automaton::{Automaton, State, StateId, Symbol, Transition};

/// Builds an [`Automaton`] from labels rather than ids.
///
/// States are referred to by label throughout, and ids are assigned in insertion order.
/// Referring to a state that has not been declared creates it, which keeps small examples
/// short — a transition mentioning a state is evidence enough that it exists.
#[derive(Clone, Debug, Default)]
pub struct AutomatonBuilder {
    alphabet: Vec<Symbol>,
    labels: Vec<String>,
    accepting: Vec<bool>,
    origins: Vec<Option<Vec<StateId>>>,
    start: Option<StateId>,
    transitions: Vec<Transition>,
}

impl AutomatonBuilder {
    /// Start building over the given alphabet.
    pub fn new<S: Into<Symbol>>(alphabet: impl IntoIterator<Item = S>) -> Self {
        Self {
            alphabet: alphabet.into_iter().map(Into::into).collect(),
            ..Self::default()
        }
    }

    /// Find a state by label, creating it if it is new.
    fn intern(&mut self, label: &str) -> StateId {
        if let Some(i) = self.labels.iter().position(|l| l == label) {
            return i as StateId;
        }
        self.labels.push(label.to_string());
        self.accepting.push(false);
        self.origins.push(None);
        (self.labels.len() - 1) as StateId
    }

    /// Declare a state.
    #[must_use]
    pub fn state(mut self, label: &str) -> Self {
        self.intern(label);
        self
    }

    /// Declare an accepting state.
    #[must_use]
    pub fn accepting(mut self, label: &str) -> Self {
        let id = self.intern(label);
        self.accepting[id as usize] = true;
        self
    }

    /// Set the start state. Defaults to the first state declared.
    #[must_use]
    pub fn start(mut self, label: &str) -> Self {
        let id = self.intern(label);
        self.start = Some(id);
        self
    }

    /// Record which source states produced this one, for subset construction and minimization.
    #[must_use]
    pub fn origin(mut self, label: &str, origin: impl IntoIterator<Item = StateId>) -> Self {
        let id = self.intern(label);
        self.origins[id as usize] = Some(origin.into_iter().collect());
        self
    }

    /// Add a transition on a symbol.
    #[must_use]
    pub fn edge(mut self, from: &str, to: &str, on: &str) -> Self {
        let (from, to) = (self.intern(from), self.intern(to));
        self.transitions.push(Transition::on(from, to, on));
        self
    }

    /// Add a transition on several symbols at once.
    ///
    /// `edges("q0", "q0", ["a", "b"])` reads better than two `edge` calls and is how a
    /// self-loop over most of the alphabet usually wants to be written.
    #[must_use]
    pub fn edges<'a>(
        mut self,
        from: &str,
        to: &str,
        on: impl IntoIterator<Item = &'a str>,
    ) -> Self {
        let (from, to) = (self.intern(from), self.intern(to));
        for symbol in on {
            self.transitions.push(Transition::on(from, to, symbol));
        }
        self
    }

    /// Add an ε-transition.
    #[must_use]
    pub fn epsilon(mut self, from: &str, to: &str) -> Self {
        let (from, to) = (self.intern(from), self.intern(to));
        self.transitions.push(Transition::epsilon(from, to));
        self
    }

    /// Finish, defaulting the start state to the first one declared.
    pub fn build(self) -> Automaton {
        let mut states = IndexMap::with_capacity(self.labels.len());

        for (i, label) in self.labels.iter().enumerate() {
            let mut state = State::new(label);
            state.accepting = self.accepting[i];
            if let Some(origin) = &self.origins[i] {
                state.origin = Some(origin.iter().copied().collect());
            }
            states.insert(i as StateId, state);
        }

        Automaton {
            alphabet: self.alphabet,
            states,
            start: self.start.unwrap_or(0),
            transitions: self.transitions,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::automaton::Determinism;

    #[test]
    fn builds_a_four_state_dfa_in_a_handful_of_lines() {
        // The ergonomic target from the plan: a real machine, readable at a glance.
        let dfa = AutomatonBuilder::new(["a", "b"])
            .start("q0")
            .edge("q0", "q1", "a")
            .edge("q1", "q2", "b")
            .edge("q2", "q3", "a")
            .accepting("q3")
            .build();

        assert_eq!(dfa.state_count(), 4);
        assert_eq!(dfa.start, 0);
        assert!(dfa.state(3).expect("q3 exists").accepting);
    }

    #[test]
    fn a_transition_declares_the_states_it_mentions() {
        let a = AutomatonBuilder::new(["a"]).edge("p", "q", "a").build();
        assert_eq!(a.state_count(), 2);
        assert_eq!(a.state(0).expect("p exists").label, "p");
    }

    #[test]
    fn labels_are_interned_rather_than_duplicated() {
        // Mentioning q0 four times must not produce four states.
        let a = AutomatonBuilder::new(["a"])
            .state("q0")
            .edge("q0", "q0", "a")
            .accepting("q0")
            .start("q0")
            .build();
        assert_eq!(a.state_count(), 1);
    }

    #[test]
    fn start_defaults_to_the_first_state_declared() {
        let a = AutomatonBuilder::new(["a"])
            .state("first")
            .state("second")
            .build();
        assert_eq!(a.start, 0);
    }

    #[test]
    fn ids_follow_declaration_order() {
        // Traces and snapshot tests depend on this being stable, not incidental.
        let a = AutomatonBuilder::new(["a"])
            .state("x")
            .state("y")
            .state("z")
            .build();
        let labels: Vec<_> = a.states.values().map(|s| s.label.as_str()).collect();
        assert_eq!(labels, ["x", "y", "z"]);
    }

    #[test]
    fn epsilon_edges_make_an_epsilon_nfa() {
        let a = AutomatonBuilder::new(["a"]).epsilon("q0", "q1").build();
        assert_eq!(a.determinism(), Determinism::EpsilonNfa);
    }

    #[test]
    fn edges_adds_one_transition_per_symbol() {
        let a = AutomatonBuilder::new(["a", "b", "c"])
            .edges("q0", "q0", ["a", "b", "c"])
            .build();
        assert_eq!(a.transitions.len(), 3);
    }

    #[test]
    fn origin_round_trips_through_the_builder() {
        let a = AutomatonBuilder::new(["a"]).origin("A", [1, 3, 4]).build();
        let origin = a
            .state(0)
            .expect("A exists")
            .origin
            .as_ref()
            .expect("origin set");
        assert_eq!(origin.iter().copied().collect::<Vec<_>>(), [1, 3, 4]);
    }
}
