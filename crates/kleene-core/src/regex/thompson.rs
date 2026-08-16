//! Thompson's construction: a regular expression becomes an ε-NFA.
//!
//! This is the first algorithm in the engine to produce a [`Traced`], and it is the first
//! real test of whether that design holds up. The rule it establishes for everything after
//! it: the *reasoning* is built as the algorithm runs, from what the algorithm actually did,
//! never reconstructed afterwards by inspecting the result.
//!
//! ## Why Thompson rather than something smaller
//!
//! Thompson produces more states than necessary — `a` alone becomes two states joined by an
//! edge, where one state would do. That is not a flaw to optimise away: the extra states are
//! what make the construction *compositional*, and the compositionality is what makes it
//! teachable. Every fragment has exactly one entry and one exit, so the rules for union,
//! concatenation and star are the same three pictures every time, at every depth.
//!
//! Minimization comes later in the pipeline and is where the redundancy is meant to go.

use crate::automaton::{Automaton, State, StateId, Transition};
use crate::regex::ast::Regex;
use crate::trace::{Step, StepKind, Traced};

/// A partially built machine: one entry, one exit, and the edges built so far.
///
/// The single-entry/single-exit invariant is the whole reason the construction composes.
/// Every rule below takes fragments and returns a fragment, and none of them needs to know
/// how the pieces it was handed were built.
struct Fragment {
    start: StateId,
    accept: StateId,
}

struct Builder {
    states: Vec<State>,
    transitions: Vec<Transition>,
    steps: Vec<Step>,
}

impl Builder {
    fn new() -> Self {
        Self {
            states: Vec::new(),
            transitions: Vec::new(),
            steps: Vec::new(),
        }
    }

    fn fresh(&mut self) -> StateId {
        let id = self.states.len() as StateId;
        self.states.push(State::new(format!("q{id}")));
        id
    }

    fn connect(&mut self, from: StateId, to: StateId, on: Option<&str>) {
        self.transitions.push(match on {
            Some(symbol) => Transition::on(from, to, symbol),
            None => Transition::epsilon(from, to),
        });
    }

    fn note(&mut self, detail: impl Into<String>, states: impl IntoIterator<Item = StateId>) {
        self.steps
            .push(Step::new(StepKind::Note, detail).highlighting(states));
    }

    /// Build a fragment for one node, recording why.
    ///
    /// Steps are emitted *after* the sub-fragments are built, so the trace reads
    /// bottom-up — the order in which the pieces genuinely came into existence, which is
    /// also the order a lecturer draws them.
    fn build(&mut self, regex: &Regex) -> Fragment {
        match regex {
            // `∅` accepts nothing, so its fragment has no path from entry to exit at all.
            // The two states are still created, because every fragment must have both for
            // the composition rules to apply uniformly.
            Regex::Empty => {
                let (start, accept) = (self.fresh(), self.fresh());
                self.note(
                    format!(
                        "∅ accepts nothing, so q{start} and q{accept} are left unconnected — \
                         there is no way to get from one to the other."
                    ),
                    [start, accept],
                );
                Fragment { start, accept }
            }

            Regex::Epsilon => {
                let (start, accept) = (self.fresh(), self.fresh());
                self.connect(start, accept, None);
                self.note(
                    format!(
                        "ε accepts the empty string, so q{start} reaches q{accept} \
                         without reading any input."
                    ),
                    [start, accept],
                );
                Fragment { start, accept }
            }

            Regex::Symbol(symbol) => {
                let (start, accept) = (self.fresh(), self.fresh());
                self.connect(start, accept, Some(symbol));
                self.note(
                    format!("Reading `{symbol}` moves from q{start} to q{accept}."),
                    [start, accept],
                );
                Fragment { start, accept }
            }

            // Concatenation joins exit to entry with an ε-transition rather than merging
            // the two states. Merging would work here, but it would make this rule
            // structurally different from the others, and the point of Thompson is that
            // every rule looks the same.
            Regex::Concat(left, right) => {
                let l = self.build(left);
                let r = self.build(right);
                self.connect(l.accept, r.start, None);
                self.note(
                    format!(
                        "Concatenation: once the first part finishes at q{}, the second part \
                         begins at q{} without reading anything.",
                        l.accept, r.start
                    ),
                    [l.accept, r.start],
                );
                Fragment {
                    start: l.start,
                    accept: r.accept,
                }
            }

            Regex::Union(left, right) => {
                let l = self.build(left);
                let r = self.build(right);
                let (start, accept) = (self.fresh(), self.fresh());

                self.connect(start, l.start, None);
                self.connect(start, r.start, None);
                self.connect(l.accept, accept, None);
                self.connect(r.accept, accept, None);

                self.note(
                    format!(
                        "Union: q{start} can take either branch without reading input, and \
                         both branches rejoin at q{accept}. This choice is the \
                         nondeterminism."
                    ),
                    [start, accept, l.start, r.start],
                );
                Fragment { start, accept }
            }

            Regex::Star(inner) => {
                let f = self.build(inner);
                let (start, accept) = (self.fresh(), self.fresh());

                self.connect(start, f.start, None); // enter the loop
                self.connect(f.accept, accept, None); // leave after at least one pass
                self.connect(f.accept, f.start, None); // go round again
                self.connect(start, accept, None); // skip it entirely — the zero case

                self.note(
                    format!(
                        "Star: q{} loops back to q{} to repeat, and q{start} also reaches \
                         q{accept} directly — that last edge is what allows zero repetitions.",
                        f.accept, f.start
                    ),
                    [start, accept, f.start, f.accept],
                );
                Fragment { start, accept }
            }
        }
    }
}

/// Build an ε-NFA from a regular expression, with the reasoning that produced it.
///
/// ```
/// use kleene_core::{parse, regex::thompson};
///
/// let traced = thompson(&parse("a+b").unwrap());
/// assert!(traced.result.has_epsilon());
///
/// // One step per AST node — `a`, `b`, and the union — plus a closing summary.
/// assert_eq!(traced.steps.len(), 4);
/// ```
pub fn thompson(regex: &Regex) -> Traced<Automaton> {
    let mut builder = Builder::new();
    let fragment = builder.build(regex);

    let mut states = indexmap::IndexMap::with_capacity(builder.states.len());
    for (i, state) in builder.states.into_iter().enumerate() {
        states.insert(i as StateId, state);
    }

    // Exactly one accepting state, always. Thompson's output is defined that way, and
    // subset construction downstream is simpler to explain when the accepting set is a
    // single element rather than an arbitrary subset.
    if let Some(accept) = states.get_mut(&fragment.accept) {
        accept.accepting = true;
    }

    let automaton = Automaton {
        alphabet: regex.alphabet(),
        states,
        start: fragment.start,
        transitions: builder.transitions,
    };

    let mut steps = builder.steps;
    steps.push(Step::new(
        StepKind::Note,
        format!(
            "Done: {} states, starting at q{} and accepting at q{}.",
            automaton.state_count(),
            automaton.start,
            fragment.accept
        ),
    ));

    Traced::new(automaton, steps)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::automaton::Determinism;
    use crate::regex::parse;

    fn build(input: &str) -> Traced<Automaton> {
        thompson(&parse(input).expect("parses"))
    }

    #[test]
    fn a_single_symbol_makes_two_states_and_one_edge() {
        let t = build("a");
        assert_eq!(t.result.state_count(), 2);
        assert_eq!(t.result.transitions.len(), 1);
        assert_eq!(t.result.start, 0);
        assert!(t.result.state(1).expect("q1").accepting);
    }

    #[test]
    fn there_is_exactly_one_accepting_state() {
        // Thompson's defining property, and what keeps subset construction explainable.
        for input in ["a", "ab", "a+b", "a*", "(a+b)*abb"] {
            let t = build(input);
            let accepting = t.result.states.values().filter(|s| s.accepting).count();
            assert_eq!(
                accepting, 1,
                "{input} produced {accepting} accepting states"
            );
        }
    }

    #[test]
    fn union_introduces_nondeterminism() {
        let t = build("a+b");
        assert_eq!(t.result.determinism(), Determinism::EpsilonNfa);
    }

    #[test]
    fn star_can_be_skipped_entirely() {
        // The zero-repetitions edge is the one people forget to draw. Without it the
        // machine cannot accept the empty string.
        let t = build("a*");
        let start = t.result.start;
        let accept = *t
            .result
            .states
            .iter()
            .find(|(_, s)| s.accepting)
            .expect("has an accepting state")
            .0;

        assert!(
            t.result
                .transitions
                .iter()
                .any(|tr| tr.from == start && tr.to == accept && tr.is_epsilon()),
            "star must have a direct skip edge for zero repetitions"
        );
    }

    #[test]
    fn star_loops_back() {
        let t = build("a*");
        // Some ε-transition must go backwards, or the loop cannot repeat.
        assert!(
            t.result
                .transitions
                .iter()
                .any(|tr| tr.is_epsilon() && tr.to < tr.from)
        );
    }

    #[test]
    fn the_alphabet_comes_from_the_expression() {
        assert_eq!(build("a(b+c)").result.alphabet, ["a", "b", "c"]);
    }

    #[test]
    fn the_empty_language_has_no_path_from_start_to_accept() {
        let t = build("∅");
        assert_eq!(t.result.state_count(), 2);
        assert_eq!(
            t.result.transitions.len(),
            0,
            "∅ must be unreachable end to end"
        );
    }

    #[test]
    fn every_construction_step_is_recorded() {
        // The architectural claim: reasoning is produced by the algorithm, not
        // reconstructed from its output. One step per AST node, plus the summary.
        let regex = parse("(a+b)*").expect("parses");
        let t = thompson(&regex);
        assert_eq!(
            t.steps.len(),
            regex.size() + 1,
            "one step per node, plus a summary"
        );
    }

    #[test]
    fn steps_are_in_the_order_the_pieces_were_built() {
        // Bottom-up: the symbols exist before the union that joins them, which is also the
        // order a lecturer draws it on the board.
        let t = build("a+b");
        assert!(t.steps[0].detail.contains('a'), "{}", t.steps[0].detail);
        assert!(t.steps[1].detail.contains('b'), "{}", t.steps[1].detail);
        assert!(t.steps[2].detail.contains("Union"), "{}", t.steps[2].detail);
    }

    #[test]
    fn steps_highlight_the_states_they_talk_about() {
        // Phase 3 lights these up while scrubbing; a step with no states is not renderable.
        let t = build("a+b");
        assert!(t.steps.iter().take(3).all(|s| !s.highlight.is_empty()));
    }

    #[test]
    fn the_result_is_always_a_valid_automaton() {
        for input in ["a", "ab", "a+b", "a*", "(a+b)*abb", "∅", "ε", "a**"] {
            let report = build(input).result.validate();
            assert!(!report.has_errors(), "{input}: {:?}", report.problems);
        }
    }
}
