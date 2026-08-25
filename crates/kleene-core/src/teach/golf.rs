//! State-budget golf (teaching layer Track F).
//!
//! A language, a state bound, and the question "can you hit it". The scoring is the subject
//! itself: the target is the minimal machine's size, so the game is *minimization, played by
//! hand*, and getting better at it is getting better at the thing the course is teaching.
//!
//! ## Why there is no leaderboard
//!
//! Task F4, and roadmap §9.2 twice over. A leaderboard needs a server, which §9 forbids
//! outright — but the mechanic is ruled out anyway. Ranking students against each other on a
//! practice exercise rewards the ones who were already comfortable and tells everyone else
//! something they did not need to know. A personal best against the *minimum* is a target that
//! does not move and cannot be lost to somebody else's cleverness.
//!
//! ## What makes a hint a hint rather than an answer
//!
//! When a student is above the bound, the useful thing is not "you are two states over" but
//! *which two states could have been one, and the string that proves it*. That is exactly what
//! minimization computes on the way to its answer — the distinguishing witness from Phase 1
//! D2, doing a second job here.
//!
//! It stops short of merging them. Being told "q3 and q5 behave identically on every string —
//! `ab` is the shortest one you can check" is a thing to go and verify; being handed the
//! merged machine is the exercise done for you.

use serde::{Deserialize, Serialize};

use crate::automaton::{Automaton, StateId};
use crate::convert::{determinize, minimize, refine};

/// A pair of states that could have been one.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "generated/"))]
pub struct Mergeable {
    /// One of the pair.
    pub left: StateId,
    /// The other.
    pub right: StateId,
    /// Their labels, so a hint can name them the way the diagram does.
    pub left_label: String,
    /// The other's label.
    pub right_label: String,
}

/// How a machine scores against the smallest one for its language.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "generated/"))]
pub struct Score {
    /// States the machine uses.
    pub used: usize,
    /// The fewest any machine for this language can use.
    pub minimum: usize,
    /// `used == minimum`.
    pub optimal: bool,
    /// Pairs that could be merged, when there are any.
    ///
    /// Empty at the minimum, by definition — that is what minimal means.
    pub mergeable: Vec<Mergeable>,
}

/// Score a machine, and find what could still be merged.
///
/// Determinized first: merging is a question about a DFA, and the honest answer for an NFA is
/// about the DFA it denotes. A student who drew an NFA and is told its state count could be
/// halved would otherwise be told something false about the machine in front of them.
pub fn score(answer: &Automaton) -> Score {
    let dfa = if answer.determinism() == crate::automaton::Determinism::Dfa {
        answer.clone()
    } else {
        determinize(answer).result
    };

    let minimum = minimize(&dfa).result.state_count();
    let used = answer.state_count();

    Score {
        used,
        minimum,
        optimal: used == minimum,
        mergeable: mergeable_pairs(&dfa),
    }
}

/// Pairs of states no string tells apart.
///
/// Read out of the refinement rather than recomputed: minimization already decides, for every
/// pair, whether some string separates them. The pairs it never separated are exactly the ones
/// that can be merged.
fn mergeable_pairs(dfa: &Automaton) -> Vec<Mergeable> {
    let refined = refine(dfa).result;
    // Labels come from the refinement's own source, which is the reachable, completed machine
    // it actually ran on — not the caller's, which may have states it dropped.
    let label = |id: StateId| {
        refined
            .source
            .states
            .get(&id)
            .map(|state| state.label.clone())
            .unwrap_or_else(|| id.to_string())
    };

    let mut pairs = Vec::new();
    for block in refined.rounds.last().into_iter().flatten() {
        let members: Vec<StateId> = block.iter().copied().collect();
        for (index, &left) in members.iter().enumerate() {
            for &right in &members[index + 1..] {
                pairs.push(Mergeable {
                    left,
                    right,
                    left_label: label(left),
                    right_label: label(right),
                });
            }
        }
    }
    pairs
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::builder::AutomatonBuilder;

    /// Even number of a's, minimal: two states.
    fn minimal() -> Automaton {
        AutomatonBuilder::new(["a", "b"])
            .accepting("even")
            .state("odd")
            .start("even")
            .edge("even", "odd", "a")
            .edge("odd", "even", "a")
            .edge("even", "even", "b")
            .edge("odd", "odd", "b")
            .build()
    }

    /// The same language with a redundant state: `even2` behaves exactly like `even`.
    fn padded() -> Automaton {
        AutomatonBuilder::new(["a", "b"])
            .accepting("even")
            .state("odd")
            .accepting("even2")
            .start("even")
            .edge("even", "odd", "a")
            .edge("odd", "even2", "a")
            .edge("even2", "odd", "a")
            .edge("even", "even", "b")
            .edge("odd", "odd", "b")
            .edge("even2", "even2", "b")
            .build()
    }

    #[test]
    fn a_minimal_machine_scores_optimal() {
        let score = score(&minimal());
        assert!(score.optimal);
        assert_eq!(score.used, 2);
        assert_eq!(score.minimum, 2);
    }

    #[test]
    fn a_minimal_machine_has_nothing_left_to_merge() {
        // By definition — that is what minimal means, and a hint offered here would be wrong.
        assert!(score(&minimal()).mergeable.is_empty());
    }

    #[test]
    fn a_padded_machine_names_the_pair_that_could_be_one() {
        // F3. "You are one state over" is a score; "these two behave identically" is a thing
        // to go and check.
        let score = score(&padded());
        assert!(!score.optimal);
        assert_eq!(score.used, 3);
        assert_eq!(score.minimum, 2);

        let pair = score.mergeable.first().expect("a mergeable pair");
        let labels = [pair.left_label.as_str(), pair.right_label.as_str()];
        assert!(
            labels.contains(&"even") && labels.contains(&"even2"),
            "expected the two equivalent states, got {labels:?}"
        );
    }

    #[test]
    fn the_minimum_is_a_property_of_the_language_not_the_drawing() {
        // Both machines accept the same language, so both are scored against the same target.
        assert_eq!(score(&minimal()).minimum, score(&padded()).minimum);
    }

    #[test]
    fn an_nfa_is_scored_against_the_dfa_it_denotes() {
        // Merging is a question about a DFA. Telling someone their NFA's states could be
        // merged would be saying something false about the machine in front of them.
        let nfa = AutomatonBuilder::new(["a"])
            .state("q0")
            .accepting("q1")
            .start("q0")
            .edge("q0", "q0", "a")
            .edge("q0", "q1", "a")
            .build();

        let score = score(&nfa);
        assert!(score.minimum >= 1);
        assert_eq!(score.used, 2, "the count reported is the student's own");
    }
}
