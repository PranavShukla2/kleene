//! Small, real automata used by tests and by the app's first render.
//!
//! These are not fixtures invented to be convenient. Each one is a machine a student
//! actually meets in a first formal-languages course, which means a bug that shows up here
//! is a bug that would show up in front of a user.

use indexmap::IndexMap;

use crate::automaton::{Automaton, State, StateId, Transition};

/// Assemble an automaton from parts, keeping the example definitions readable.
fn build(
    alphabet: &[&str],
    states: &[(StateId, &str, bool)],
    start: StateId,
    transitions: Vec<Transition>,
) -> Automaton {
    let mut map = IndexMap::with_capacity(states.len());
    for &(id, label, accepting) in states {
        let s = State::new(label);
        map.insert(id, if accepting { s.accepting() } else { s });
    }

    Automaton {
        alphabet: alphabet.iter().map(|s| (*s).to_string()).collect(),
        states: map,
        start,
        transitions,
    }
}

/// Strings over `{a, b}` containing an even number of `a`s.
///
/// Two states, because two states is genuinely minimal here — the parity of the `a` count
/// is the entire state. Used as the end-to-end target for the editor (Phase 2).
pub fn even_number_of_as() -> Automaton {
    build(
        &["a", "b"],
        &[(0, "q0", true), (1, "q1", false)],
        0,
        vec![
            Transition::on(0, 1, "a"),
            Transition::on(1, 0, "a"),
            Transition::on(0, 0, "b"),
            Transition::on(1, 1, "b"),
        ],
    )
}

/// Strings over `{a, b}` ending in `ab`.
///
/// The first machine Kleene ever renders. Chosen over a simpler one because its geometry
/// exercises exactly the cases that make generated diagrams look broken: two self-loops
/// (`q0` on `b`, `q1` on `a`) and a bidirectional pair (`q1 ⇄ q2`). A renderer that handles
/// this correctly handles most of what it will meet.
pub fn ends_with_ab() -> Automaton {
    build(
        &["a", "b"],
        &[(0, "q0", false), (1, "q1", false), (2, "q2", true)],
        0,
        vec![
            Transition::on(0, 1, "a"),
            Transition::on(0, 0, "b"),
            Transition::on(1, 1, "a"),
            Transition::on(1, 2, "b"),
            Transition::on(2, 1, "a"),
            Transition::on(2, 0, "b"),
        ],
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::automaton::Determinism;

    #[test]
    fn examples_are_complete_dfas() {
        for a in [even_number_of_as(), ends_with_ab()] {
            assert_eq!(a.determinism(), Determinism::Dfa);
            assert!(a.is_complete());
        }
    }

    #[test]
    fn ends_with_ab_has_the_geometry_the_renderer_needs() {
        let a = ends_with_ab();
        let self_loops = a.transitions.iter().filter(|t| t.from == t.to).count();
        assert_eq!(self_loops, 2, "self-loop rendering must be exercised");

        let has_pair = a.transitions.iter().any(|t| t.from == 1 && t.to == 2)
            && a.transitions.iter().any(|t| t.from == 2 && t.to == 1);
        assert!(has_pair, "bidirectional edge routing must be exercised");
    }
}
