//! Small, real automata used by tests and by the app's first render.
//!
//! These are not fixtures invented to be convenient. Each one is a machine a student
//! actually meets in a first formal-languages course, which means a bug that shows up here
//! is a bug that would show up in front of a user.

use crate::automaton::Automaton;
use crate::builder::AutomatonBuilder;

/// Strings over `{a, b}` containing an even number of `a`s.
///
/// Two states, because two states is genuinely minimal here — the parity of the `a` count
/// is the entire state. Used as the end-to-end target for the editor (Phase 2).
pub fn even_number_of_as() -> Automaton {
    AutomatonBuilder::new(["a", "b"])
        .accepting("q0") // even so far, including zero
        .state("q1") // odd so far
        .edge("q0", "q1", "a")
        .edge("q1", "q0", "a")
        .edge("q0", "q0", "b")
        .edge("q1", "q1", "b")
        .build()
}

/// Strings over `{a, b}` ending in `ab`.
///
/// The first machine Kleene ever renders. Chosen over a simpler one because its geometry
/// exercises exactly the cases that make generated diagrams look broken: two self-loops
/// (`q0` on `b`, `q1` on `a`) and a bidirectional pair (`q1 ⇄ q2`). A renderer that handles
/// this correctly handles most of what it will meet.
pub fn ends_with_ab() -> Automaton {
    AutomatonBuilder::new(["a", "b"])
        .state("q0") // no useful suffix
        .state("q1") // last symbol was `a`
        .accepting("q2") // last two were `ab`
        .edge("q0", "q1", "a")
        .edge("q0", "q0", "b")
        .edge("q1", "q1", "a")
        .edge("q1", "q2", "b")
        .edge("q2", "q1", "a")
        .edge("q2", "q0", "b")
        .build()
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
