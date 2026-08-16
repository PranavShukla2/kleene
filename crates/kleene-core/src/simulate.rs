//! Running a string through a machine, one symbol at a time.
//!
//! The trace here is the one users watch most, because it is the only algorithm in the engine
//! whose input they choose. So it records more than the answer: at every point it holds the
//! set of states currently possible, how much input has been consumed, and — the part that
//! actually teaches — *why* the run ended the way it did.
//!
//! ## Configuration sets, not backtracking
//!
//! An NFA is simulated by tracking every state it could be in at once, rather than trying one
//! path and backing up. Both give the same answer; only the first is honest about what
//! nondeterminism *is*. A student watching a backtracking animation learns that the machine
//! guesses and retries, which is precisely the misconception the subset construction exists to
//! dispel. Watching the set fan out and collapse is the same picture as subset construction,
//! which is the point.

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::automaton::{Automaton, StateId};
use crate::convert::epsilon::Closures;
use crate::trace::{Step, StepKind, Traced};

/// How a run ended.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Verdict {
    /// The whole input was read and at least one reachable state accepts.
    Accepted,
    /// The whole input was read, but no reachable state accepts.
    Rejected,
    /// The machine ran out of moves partway through — distinct from rejecting, because the
    /// remaining input was never even looked at.
    Stuck,
}

impl Verdict {
    /// Whether the string is in the language. `Stuck` counts as rejection.
    pub fn is_accepted(self) -> bool {
        self == Self::Accepted
    }
}

/// The machine's situation after reading some prefix of the input.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Configuration {
    /// Every state the machine could currently be in.
    pub states: BTreeSet<StateId>,
    /// How many symbols have been consumed.
    pub consumed: usize,
    /// The symbol that produced this configuration. `None` for the initial one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub read: Option<String>,
}

/// The full record of a run.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Run {
    /// The string that was run.
    pub input: String,
    /// One entry per point in the run, starting before any input is read.
    pub configurations: Vec<Configuration>,
    /// How it ended.
    pub verdict: Verdict,
}

impl Run {
    /// The states the machine finished in.
    pub fn final_states(&self) -> &BTreeSet<StateId> {
        static EMPTY: std::sync::LazyLock<BTreeSet<StateId>> =
            std::sync::LazyLock::new(BTreeSet::new);
        self.configurations.last().map_or(&EMPTY, |c| &c.states)
    }

    /// The part of the input already read at a given point in the run.
    ///
    /// The input tester shows this as a tape with a cursor, so it is computed here rather
    /// than in the frontend — the split point is a function of the run, not of the display.
    pub fn consumed_at(&self, index: usize) -> &str {
        let consumed = self.configurations.get(index).map_or(0, |c| c.consumed);
        let end = self
            .input
            .char_indices()
            .nth(consumed)
            .map_or(self.input.len(), |(i, _)| i);
        &self.input[..end]
    }

    /// The part of the input still to be read at a given point.
    pub fn remaining_at(&self, index: usize) -> &str {
        &self.input[self.consumed_at(index).len()..]
    }
}

/// Run `input` through `automaton`, recording every configuration along the way.
///
/// Works for DFAs, NFAs and ε-NFAs alike — a DFA is simply the case where every configuration
/// happens to hold one state.
///
/// ```
/// use kleene_core::{examples, simulate::simulate};
///
/// let dfa = examples::ends_with_ab();
/// assert!(simulate(&dfa, "aab").result.verdict.is_accepted());
/// assert!(!simulate(&dfa, "aba").result.verdict.is_accepted());
/// ```
pub fn simulate(automaton: &Automaton, input: &str) -> Traced<Run> {
    let closures = Closures::compute(automaton);
    let mut current = closures.of_set([automaton.start]);
    let mut configurations = vec![Configuration {
        states: current.clone(),
        consumed: 0,
        read: None,
    }];
    let mut steps = vec![
        Step::new(
            StepKind::Simulation,
            format!(
                "Start in {}.{}",
                render(&current, automaton),
                if automaton.has_epsilon() {
                    " ε-transitions are followed before reading anything, so the machine may \
                     already be in several states."
                } else {
                    ""
                }
            ),
        )
        .highlighting(current.iter().copied()),
    ];

    for (index, ch) in input.chars().enumerate() {
        let symbol = ch.to_string();

        // Unknown symbols are a distinct failure from "no move on a known symbol", and
        // saying which is the difference between a student checking their alphabet and
        // checking their transitions.
        if !automaton.alphabet.contains(&symbol) {
            steps.push(Step::new(
                StepKind::Simulation,
                format!(
                    "`{symbol}` is not in the alphabet {}, so the machine cannot read it.",
                    render_alphabet(automaton)
                ),
            ));
            return finish(input, configurations, Verdict::Stuck, steps);
        }

        let moved: Vec<StateId> = current
            .iter()
            .flat_map(|&id| automaton.transitions_from(id, Some(&symbol)))
            .map(|t| t.to)
            .collect();
        let next = closures.of_set(moved);

        if next.is_empty() {
            steps.push(
                Step::new(
                    StepKind::Simulation,
                    format!(
                        "Reading `{symbol}` from {} leads nowhere, so the machine is stuck \
                         with {} symbol{} still unread.",
                        render(&current, automaton),
                        input.chars().count() - index,
                        if input.chars().count() - index == 1 {
                            ""
                        } else {
                            "s"
                        },
                    ),
                )
                .highlighting(current.iter().copied()),
            );
            return finish(input, configurations, Verdict::Stuck, steps);
        }

        steps.push(
            Step::new(
                StepKind::Simulation,
                format!(
                    "Read `{symbol}`: {} → {}.",
                    render(&current, automaton),
                    render(&next, automaton),
                ),
            )
            .highlighting(next.iter().copied()),
        );

        current = next;
        configurations.push(Configuration {
            states: current.clone(),
            consumed: index + 1,
            read: Some(symbol),
        });
    }

    let accepting: BTreeSet<StateId> = current
        .iter()
        .copied()
        .filter(|&id| automaton.state(id).is_some_and(|s| s.accepting))
        .collect();

    let verdict = if accepting.is_empty() {
        Verdict::Rejected
    } else {
        Verdict::Accepted
    };

    steps.push(
        Step::new(
            StepKind::Simulation,
            if accepting.is_empty() {
                format!(
                    "Input exhausted in {}, none of which is accepting — rejected.",
                    render(&current, automaton)
                )
            } else {
                format!(
                    "Input exhausted in {}, and {} is accepting — accepted.",
                    render(&current, automaton),
                    render(&accepting, automaton),
                )
            },
        )
        .highlighting(current.iter().copied()),
    );

    finish(input, configurations, verdict, steps)
}

fn finish(
    input: &str,
    configurations: Vec<Configuration>,
    verdict: Verdict,
    steps: Vec<Step>,
) -> Traced<Run> {
    Traced::new(
        Run {
            input: input.to_string(),
            configurations,
            verdict,
        },
        steps,
    )
}

fn render(ids: &BTreeSet<StateId>, automaton: &Automaton) -> String {
    if ids.is_empty() {
        return "∅".to_string();
    }
    let inner = ids
        .iter()
        .map(|&id| {
            automaton
                .state(id)
                .map_or_else(|| format!("#{id}"), |s| s.label.clone())
        })
        .collect::<Vec<_>>()
        .join(", ");
    format!("{{{inner}}}")
}

fn render_alphabet(automaton: &Automaton) -> String {
    format!("{{{}}}", automaton.alphabet.join(", "))
}

/// Whether the machine accepts the string, without the trace.
pub fn accepts(automaton: &Automaton, input: &str) -> bool {
    simulate(automaton, input).result.verdict.is_accepted()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::builder::AutomatonBuilder;
    use crate::examples;
    use crate::regex::{parse, thompson::thompson};

    #[test]
    fn accepts_and_rejects_the_obvious_cases() {
        let dfa = examples::ends_with_ab();
        for s in ["ab", "aab", "bbab", "ababab"] {
            assert!(accepts(&dfa, s), "{s} should be accepted");
        }
        for s in ["", "a", "b", "aba", "abb"] {
            assert!(!accepts(&dfa, s), "{s} should be rejected");
        }
    }

    #[test]
    fn the_empty_string_is_accepted_when_the_start_state_accepts() {
        assert!(accepts(&examples::even_number_of_as(), ""));
    }

    #[test]
    fn a_configuration_is_recorded_per_symbol_plus_the_initial_one() {
        let run = simulate(&examples::ends_with_ab(), "aab").result;
        assert_eq!(run.configurations.len(), 4);
        assert_eq!(run.configurations[0].consumed, 0);
        assert_eq!(run.configurations[3].consumed, 3);
    }

    #[test]
    fn an_nfa_tracks_every_possible_state_at_once() {
        // The view that actually explains nondeterminism: the set fans out, rather than
        // the machine guessing and backtracking.
        let nfa = thompson(&parse("(a+b)*abb").expect("parses")).result;
        let run = simulate(&nfa, "aab").result;
        assert!(
            run.configurations.iter().any(|c| c.states.len() > 1),
            "an NFA run should pass through a multi-state configuration"
        );
    }

    #[test]
    fn epsilon_transitions_are_followed_before_reading_anything() {
        let nfa = thompson(&parse("a*").expect("parses")).result;
        let initial = &simulate(&nfa, "").result.configurations[0];
        assert!(
            initial.states.len() > 1,
            "the initial configuration must be ε-closed"
        );
    }

    #[test]
    fn getting_stuck_is_distinct_from_rejecting() {
        // Different diagnoses: rejection means the whole string was read and did not land
        // anywhere accepting; stuck means the machine ran out of moves partway.
        let partial = AutomatonBuilder::new(["a", "b"])
            .accepting("q0")
            .edge("q0", "q0", "a")
            .build();

        assert_eq!(simulate(&partial, "aab").result.verdict, Verdict::Stuck);
        assert_eq!(
            simulate(&examples::ends_with_ab(), "aba").result.verdict,
            Verdict::Rejected
        );
    }

    #[test]
    fn a_stuck_run_says_how_much_input_was_left_unread() {
        let partial = AutomatonBuilder::new(["a", "b"])
            .accepting("q0")
            .edge("q0", "q0", "a")
            .build();

        let t = simulate(&partial, "abbb");
        let last = t.steps.last().expect("has steps");
        assert!(last.detail.contains("stuck"), "{}", last.detail);
        assert!(last.detail.contains("3 symbols"), "{}", last.detail);
    }

    #[test]
    fn a_symbol_outside_the_alphabet_is_reported_as_such() {
        // Distinct from "no move on a known symbol": one sends you to check the alphabet,
        // the other to check your transitions.
        let t = simulate(&examples::ends_with_ab(), "axb");
        assert_eq!(t.result.verdict, Verdict::Stuck);
        assert!(
            t.steps
                .iter()
                .any(|s| s.detail.contains("not in the alphabet")),
            "the unknown symbol was not explained"
        );
    }

    #[test]
    fn stuck_counts_as_not_accepted() {
        let partial = AutomatonBuilder::new(["a", "b"])
            .accepting("q0")
            .edge("q0", "q0", "a")
            .build();
        assert!(!accepts(&partial, "b"));
    }

    #[test]
    fn the_tape_splits_at_the_right_point() {
        // The input tester renders this as consumed/remaining either side of a cursor.
        let run = simulate(&examples::ends_with_ab(), "aab").result;
        assert_eq!(run.consumed_at(0), "");
        assert_eq!(run.remaining_at(0), "aab");
        assert_eq!(run.consumed_at(2), "aa");
        assert_eq!(run.remaining_at(2), "b");
        assert_eq!(run.consumed_at(3), "aab");
        assert_eq!(run.remaining_at(3), "");
    }

    #[test]
    fn every_step_highlights_the_states_it_describes() {
        // Except the alphabet error, which is about a symbol rather than any state.
        let t = simulate(&examples::ends_with_ab(), "aab");
        assert!(t.steps.iter().all(|s| !s.highlight.is_empty()));
    }

    #[test]
    fn simulation_agrees_with_the_conversion_pipeline() {
        // The strongest check available here: an NFA and the DFA built from it must accept
        // exactly the same strings, and simulate is what answers "accept" for both.
        let nfa = thompson(&parse("(a+b)*abb").expect("parses")).result;
        let dfa = crate::convert::determinize(&nfa).result;
        let minimal = crate::convert::minimize(&dfa).result;

        for s in ["", "a", "abb", "aabb", "babb", "abba", "bbbabb", "abab"] {
            let expected = accepts(&nfa, s);
            assert_eq!(accepts(&dfa, s), expected, "DFA disagreed on {s:?}");
            assert_eq!(
                accepts(&minimal, s),
                expected,
                "minimal DFA disagreed on {s:?}"
            );
        }
    }

    #[test]
    fn the_final_configuration_is_reachable_from_the_run() {
        let run = simulate(&examples::ends_with_ab(), "aab").result;
        assert!(!run.final_states().is_empty());
    }
}
