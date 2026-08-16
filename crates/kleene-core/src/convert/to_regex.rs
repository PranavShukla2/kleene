//! DFA → regular expression, by state elimination.
//!
//! The direction of the pipeline nobody tools well. Every course teaches it, usually as a
//! sequence of increasingly crowded diagrams, and the thing that makes it hard to follow is
//! that the labels stop being symbols and start being expressions.
//!
//! ## The method
//!
//! Treat the machine as a **GNFA** — a machine whose edges carry regular expressions rather
//! than single symbols. Add a fresh start and a fresh accept state so that the start has no
//! incoming edges and the accept has no outgoing ones, then remove the original states one at
//! a time. Removing `q` means rerouting every path that went *through* it:
//!
//! ```text
//!   new(p → r)  =  old(p → r)  +  old(p → q) · old(q → q)* · old(q → r)
//! ```
//!
//! The `old(q → q)*` in the middle is the self-loop — every number of trips around it, before
//! carrying on. When only the two added states remain, the edge between them is the answer.
//!
//! ## Order matters, but not for correctness
//!
//! Any elimination order yields an equivalent expression, and they can differ in length by an
//! order of magnitude. See [`Order`] — this is decision **D6**.

use std::collections::HashMap;

use crate::automaton::{Automaton, StateId};
use crate::convert::prune::prune;
use crate::regex::ast::Regex;
use crate::regex::simplify::simplify;
use crate::trace::{Step, StepKind, Traced};

/// Which state to eliminate next.
///
/// Correctness is unaffected; readability of the result is affected a great deal. This is
/// decision **D6**, and both options exist so answering it is a matter of choosing a default
/// rather than writing more code.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Order {
    /// Remove the state whose (incoming × outgoing) edge count is smallest.
    ///
    /// Each elimination creates one new edge per (incoming, outgoing) pair, so this removes
    /// the state that will add the least. Usually produces markedly shorter expressions.
    #[default]
    FewestEdges,
    /// Remove states in id order, as worked examples usually do.
    ///
    /// Slower to converge and often longer output, but it matches a student's hand-working
    /// line for line, which is worth more than brevity when checking your own answer.
    Textbook,
}

/// A GNFA edge label: `None` means no edge at all, which is different from an ε edge.
type Label = Option<Regex>;

/// Combine two possible edges into one.
fn either(left: Label, right: Label) -> Label {
    match (left, right) {
        (None, r) => r,
        (l, None) => l,
        (Some(l), Some(r)) => Some(Regex::union(l, r)),
    }
}

/// Concatenate labels, where a missing edge makes the whole path impossible.
fn then(left: &Label, right: &Label) -> Label {
    match (left, right) {
        (Some(l), Some(r)) => Some(Regex::concat(l.clone(), r.clone())),
        _ => None,
    }
}

/// Convert a machine to a regular expression describing the same language.
///
/// ```
/// use kleene_core::{examples, convert::to_regex, counterexample::equivalent};
/// use kleene_core::{parse, thompson, convert::determinize};
///
/// let dfa = examples::even_number_of_as();
/// let regex = to_regex(&dfa).result;
///
/// // The expression describes exactly the language it came from.
/// let rebuilt = determinize(&thompson(&parse(&regex.to_string()).unwrap()).result).result;
/// assert!(equivalent(&dfa, &rebuilt));
/// ```
pub fn to_regex(automaton: &Automaton) -> Traced<Regex> {
    to_regex_with(automaton, Order::default())
}

/// Convert to a regular expression, choosing the elimination order.
pub fn to_regex_with(automaton: &Automaton, order: Order) -> Traced<Regex> {
    // Dead and unreachable states contribute nothing but produce large ∅-laden fragments
    // that simplification then has to grind away. Removing them first is both faster and
    // produces a far more readable trace.
    let machine = prune(automaton).result;
    let mut steps = Vec::new();

    // Two fresh states, so the start has nothing incoming and the accept nothing outgoing.
    // Without that, the final edge would be tangled with the machine's own loops.
    let ids: Vec<StateId> = machine.states.keys().copied().collect();
    let source = u32::MAX - 1;
    let sink = u32::MAX;

    let mut edges: HashMap<(StateId, StateId), Regex> = HashMap::new();
    for t in &machine.transitions {
        let label =
            t.on.as_ref()
                .map_or(Regex::Epsilon, |s| Regex::symbol(s.clone()));
        let slot = edges.remove(&(t.from, t.to));
        edges.insert(
            (t.from, t.to),
            match slot {
                Some(existing) => Regex::union(existing, label),
                None => label,
            },
        );
    }

    edges.insert((source, machine.start), Regex::Epsilon);
    for (&id, state) in &machine.states {
        if state.accepting {
            let slot = edges.remove(&(id, sink));
            edges.insert(
                (id, sink),
                match slot {
                    Some(existing) => Regex::union(existing, Regex::Epsilon),
                    None => Regex::Epsilon,
                },
            );
        }
    }

    steps.push(Step::new(
        StepKind::StateElimination,
        format!(
            "Added a fresh start and accept state, so the start has no incoming edges and the \
             accept none outgoing. {} original state{} to eliminate.",
            ids.len(),
            if ids.len() == 1 { "" } else { "s" },
        ),
    ));

    let mut remaining = ids;

    while !remaining.is_empty() {
        let index = choose(&remaining, &edges, order);
        let victim = remaining.remove(index);

        // Everything that leads in, and everything that leads out, excluding the self-loop.
        let incoming: Vec<StateId> = remaining
            .iter()
            .chain(std::iter::once(&source))
            .copied()
            .filter(|&p| edges.contains_key(&(p, victim)))
            .collect();
        let outgoing: Vec<StateId> = remaining
            .iter()
            .chain(std::iter::once(&sink))
            .copied()
            .filter(|&r| edges.contains_key(&(victim, r)))
            .collect();

        let loop_part = edges
            .get(&(victim, victim))
            .map(|r| Regex::star(r.clone()))
            .map(|r| simplify(&r));

        for &p in &incoming {
            for &r in &outgoing {
                let through = then(
                    &then(
                        &edges.get(&(p, victim)).cloned(),
                        &loop_part.clone().or(Some(Regex::Epsilon)),
                    ),
                    &edges.get(&(victim, r)).cloned(),
                );

                if let Some(new_label) = either(edges.get(&(p, r)).cloned(), through) {
                    edges.insert((p, r), simplify(&new_label));
                }
            }
        }

        edges.retain(|&(from, to), _| from != victim && to != victim);

        steps.push(
            Step::new(
                StepKind::StateElimination,
                format!(
                    "Eliminate {}: every path through it is rerouted, {} edge{} relabelled. \
                     {} state{} left.",
                    label(&machine, victim),
                    incoming.len() * outgoing.len(),
                    if incoming.len() * outgoing.len() == 1 {
                        ""
                    } else {
                        "s"
                    },
                    remaining.len(),
                    if remaining.len() == 1 { "" } else { "s" },
                ),
            )
            .highlighting([victim]),
        );
    }

    // Whatever is left between the two added states is the answer. Nothing left means no
    // path from start to accept at all — the empty language.
    let result = simplify(&edges.remove(&(source, sink)).unwrap_or(Regex::Empty));

    steps.push(Step::new(
        StepKind::StateElimination,
        format!("Only the added states remain; the edge between them is the answer: {result}"),
    ));

    Traced::new(result, steps)
}

/// Pick the index of the next state to eliminate.
fn choose(
    remaining: &[StateId],
    edges: &HashMap<(StateId, StateId), Regex>,
    order: Order,
) -> usize {
    match order {
        Order::Textbook => 0,
        Order::FewestEdges => {
            // Eliminating a state creates one edge per (incoming, outgoing) pair, so the
            // cheapest victim is the one with the smallest product. Ties break on id, which
            // keeps the output stable across runs.
            remaining
                .iter()
                .enumerate()
                .min_by_key(|(_, id)| {
                    let id = **id;
                    let incoming = edges
                        .keys()
                        .filter(|&&(from, to)| to == id && from != id)
                        .count();
                    let outgoing = edges
                        .keys()
                        .filter(|&&(from, to)| from == id && to != id)
                        .count();
                    (incoming * outgoing, id)
                })
                .map_or(0, |(i, _)| i)
        }
    }
}

fn label(automaton: &Automaton, id: StateId) -> String {
    automaton
        .state(id)
        .map_or_else(|| format!("#{id}"), |s| s.label.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::convert::subset::determinize;
    use crate::counterexample::equivalent;
    use crate::examples;
    use crate::regex::{parse, thompson::thompson};

    fn dfa(regex: &str) -> Automaton {
        determinize(&thompson(&parse(regex).expect("parses")).result).result
    }

    /// Rebuild a machine from an expression, for comparing languages.
    fn machine_of(regex: &Regex) -> Automaton {
        determinize(&thompson(&parse(&regex.to_string()).expect("re-parses")).result).result
    }

    #[test]
    fn the_round_trip_preserves_the_language() {
        // The strong one. regex → DFA → regex → DFA must describe the same language, and
        // it exercises every part of the pipeline at once. The roadmap calls this out as
        // the test most likely to find real bugs, and it is why to_regex is written last.
        for input in [
            "a",
            "ab",
            "a+b",
            "a*",
            "(a+b)*",
            "(a+b)*abb",
            "a*b*",
            "(ab)*",
            "a(ba)*",
            "(a+b)*a(a+b)",
            "ε",
        ] {
            let original = dfa(input);
            let expression = to_regex(&original).result;
            let rebuilt = machine_of(&expression);

            assert!(
                equivalent(&original, &rebuilt),
                "{input} became {expression}, which is a different language"
            );
        }
    }

    #[test]
    fn the_round_trip_holds_for_hand_built_machines_too() {
        for machine in [examples::even_number_of_as(), examples::ends_with_ab()] {
            let expression = to_regex(&machine).result;
            assert!(
                equivalent(&machine, &machine_of(&expression)),
                "hand-built machine became {expression}"
            );
        }
    }

    #[test]
    fn both_elimination_orders_describe_the_same_language() {
        // D6 changes the shape of the answer, never its meaning.
        for input in ["(a+b)*abb", "a(ba)*", "a*b*"] {
            let machine = dfa(input);
            let fewest = to_regex_with(&machine, Order::FewestEdges).result;
            let textbook = to_regex_with(&machine, Order::Textbook).result;

            assert!(
                equivalent(&machine_of(&fewest), &machine_of(&textbook)),
                "{input}: {fewest} and {textbook} disagree"
            );
        }
    }

    #[test]
    fn the_output_is_small_enough_to_read() {
        // Without simplification this is where state elimination becomes useless: correct
        // output that nobody can read is not an answer.
        let expression = to_regex(&dfa("(a+b)*abb")).result.to_string();
        assert!(
            expression.len() < 80,
            "expression is {} characters: {expression}",
            expression.len()
        );
    }

    #[test]
    fn the_empty_language_converts_to_the_empty_language() {
        let expression = to_regex(&dfa("∅")).result;
        assert_eq!(expression, Regex::Empty);
    }

    #[test]
    fn a_machine_accepting_only_the_empty_string_gives_epsilon() {
        let machine = dfa("ε");
        let expression = to_regex(&machine).result;
        assert!(equivalent(&machine, &machine_of(&expression)));
    }

    #[test]
    fn every_elimination_is_narrated() {
        let machine = dfa("(a+b)*abb");
        let t = to_regex(&machine);
        let eliminations = t
            .steps
            .iter()
            .filter(|s| s.detail.starts_with("Eliminate"))
            .count();
        assert_eq!(eliminations, machine.state_count());
    }

    #[test]
    fn the_trace_ends_with_the_answer() {
        let t = to_regex(&dfa("ab"));
        let last = t.steps.last().expect("has steps");
        assert!(
            last.detail.contains(&t.result.to_string()),
            "{}",
            last.detail
        );
    }

    #[test]
    fn self_loops_become_starred_sections() {
        // The part of the rule people forget: paths through a state may go round its own
        // loop any number of times first.
        let expression = to_regex(&dfa("a*b")).result.to_string();
        assert!(expression.contains('*'), "expected a star in {expression}");
    }
}
