//! Graphviz DOT export.
//!
//! The lingua franca for graphs: `dot -Tpng`, `dot -Tsvg`, and every tool that reads a graph
//! reads this. Cheap to produce and it makes Kleene composable with pipelines it will never
//! know about.
//!
//! ## Conventions
//!
//! The drawing conventions of the subject, written the way Graphviz expects them:
//!
//! - `rankdir=LR` — automata read left to right; the default top-down layout looks wrong.
//! - Accepting states are `doublecircle`, everything else `circle`.
//! - The start arrow comes from an invisible point, because DOT has no notion of one.
//! - Transitions between the same pair collapse to one edge labelled `a, b`.

use std::collections::BTreeMap;

use crate::automaton::{Automaton, StateId};
use crate::notation::Notation;

/// Escape a label for a DOT quoted string.
///
/// Graphviz treats a bare `"` as ending the string and a bare `\` as starting an escape, so
/// an unescaped state label named `q"0` silently produces a file that will not parse. The
/// editor lets people name states whatever they like, so this is reachable in practice
/// rather than theoretically.
fn escape(text: &str) -> String {
    text.replace('\\', r"\\").replace('"', "\\\"")
}

/// Render an automaton as a Graphviz DOT digraph.
///
/// ```
/// use kleene_core::{examples, io::to_dot};
///
/// let dot = to_dot(&examples::even_number_of_as());
/// assert!(dot.starts_with("digraph"));
/// assert!(dot.contains("rankdir=LR"));
/// ```
pub fn to_dot(automaton: &Automaton) -> String {
    to_dot_with(automaton, Notation::default())
}

/// Render as DOT, choosing how the empty string is written on ε-edges.
pub fn to_dot_with(automaton: &Automaton, notation: Notation) -> String {
    let mut out = String::from("digraph automaton {\n");
    out.push_str("  rankdir=LR;\n");
    out.push_str("  node [shape=circle, fontname=\"JetBrains Mono, monospace\"];\n");
    out.push_str("  edge [fontname=\"JetBrains Mono, monospace\"];\n\n");

    // DOT has no concept of a start marker, so the usual idiom is an edge from a node with
    // no shape and no label.
    out.push_str("  __start [shape=none, label=\"\", width=0, height=0];\n");

    for (&id, state) in &automaton.states {
        let shape = if state.accepting {
            ", shape=doublecircle"
        } else {
            ""
        };
        out.push_str(&format!(
            "  s{id} [label=\"{}\"{shape}];\n",
            escape(&state.label)
        ));
    }

    out.push_str(&format!("\n  __start -> s{};\n", automaton.start));

    // One edge per ordered pair, symbols gathered. Three transitions drawn as three
    // parallel arrows is the classic way a generated diagram looks broken, and Graphviz
    // will faithfully draw all three if asked.
    let mut grouped: BTreeMap<(StateId, StateId), Vec<String>> = BTreeMap::new();
    for t in &automaton.transitions {
        grouped
            .entry((t.from, t.to))
            .or_default()
            .push(notation.symbol(t.on.as_deref()).to_string());
    }

    for ((from, to), mut symbols) in grouped {
        // Sorted so the label does not depend on transition insertion order — the same
        // machine must always produce byte-identical DOT, or snapshot tests are useless.
        symbols.sort();
        symbols.dedup();
        out.push_str(&format!(
            "  s{from} -> s{to} [label=\"{}\"];\n",
            escape(&symbols.join(", "))
        ));
    }

    out.push_str("}\n");
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::builder::AutomatonBuilder;
    use crate::examples;
    use crate::regex::{parse, thompson::thompson};

    #[test]
    fn renders_the_ends_with_ab_dfa() {
        insta::assert_snapshot!(to_dot(&examples::ends_with_ab()));
    }

    #[test]
    fn renders_an_epsilon_nfa() {
        let nfa = thompson(&parse("a+b").expect("parses")).result;
        insta::assert_snapshot!(to_dot(&nfa));
    }

    #[test]
    fn accepting_states_are_double_circles() {
        let dot = to_dot(&examples::ends_with_ab());
        assert!(
            dot.contains("s2 [label=\"q2\", shape=doublecircle]"),
            "{dot}"
        );
        assert!(dot.contains("s0 [label=\"q0\"]"), "{dot}");
    }

    #[test]
    fn the_start_state_gets_an_arrow_from_nowhere() {
        let dot = to_dot(&examples::ends_with_ab());
        assert!(dot.contains("__start [shape=none"), "{dot}");
        assert!(dot.contains("__start -> s0;"), "{dot}");
    }

    #[test]
    fn parallel_transitions_collapse_into_one_labelled_edge() {
        // Three arrows between the same pair is how a generated diagram looks amateur, and
        // Graphviz will happily draw all three if asked to.
        let a = AutomatonBuilder::new(["a", "b", "c"])
            .state("q0")
            .accepting("q1")
            .edges("q0", "q1", ["c", "a", "b"])
            .build();

        let dot = to_dot(&a);

        // Counted rather than matched against specific ids: the builder numbers states in
        // declaration order, and pinning `s0 -> s1` would make this test about that
        // ordering rather than about edge collapsing.
        let edges = dot
            .lines()
            .filter(|line| line.contains("->") && !line.contains("__start"))
            .count();

        assert_eq!(edges, 1, "{dot}");
        assert!(dot.contains("label=\"a, b, c\""), "{dot}");
    }

    #[test]
    fn output_is_byte_identical_across_runs() {
        // Sorted symbols and a BTreeMap of edges, so snapshot tests are meaningful and a
        // saved file does not churn.
        let a = AutomatonBuilder::new(["a", "b"])
            .accepting("q1")
            .edges("q0", "q1", ["b", "a"])
            .edge("q1", "q0", "a")
            .build();
        assert_eq!(to_dot(&a), to_dot(&a));
    }

    #[test]
    fn epsilon_edges_follow_the_notation_setting() {
        let nfa = thompson(&parse("a*").expect("parses")).result;
        assert!(to_dot_with(&nfa, Notation::EPSILON).contains("ε"));
        assert!(to_dot_with(&nfa, Notation::LAMBDA).contains("λ"));
    }

    #[test]
    fn quotes_and_backslashes_in_labels_are_escaped() {
        // The editor lets people name states anything. An unescaped quote produces a file
        // Graphviz refuses to parse, which is a confusing failure a long way from its cause.
        let mut a = examples::ends_with_ab();
        a.states.get_mut(&0).expect("q0").label = r#"q"0\x"#.into();

        let dot = to_dot(&a);
        assert!(dot.contains(r#"label="q\"0\\x""#), "{dot}");
    }

    #[test]
    fn an_empty_alphabet_still_produces_a_valid_graph() {
        let a = AutomatonBuilder::new(Vec::<String>::new())
            .accepting("q0")
            .build();
        let dot = to_dot(&a);
        assert!(dot.starts_with("digraph automaton {"));
        assert!(dot.trim_end().ends_with('}'));
    }
}
