//! The shortest string on which two machines disagree.
//!
//! "Is this DFA correct?" is decidable, so a wrong answer should never be reported as merely
//! wrong. It should name the shortest string the machine gets wrong, and say which direction
//! it is wrong in — *"`abba` should be accepted, your machine rejects it"*.
//!
//! ## How it works
//!
//! Two pieces that already exist, assembled:
//!
//! 1. [`crate::ops::symmetric_difference`] builds a machine accepting
//!    exactly the strings the two disagree about.
//! 2. A breadth-first search from its start state to the nearest accepting state reads off a
//!    shortest such string.
//!
//! **Breadth-first, never depth-first.** The shortest disagreement is the entire value of the
//! feature: a fifty-character witness is nearly useless to a student who is already confused,
//! and DFS would cheerfully find one. This is the sort of thing that looks like an
//! implementation detail and is actually the requirement.
//!
//! ## Why the direction matters
//!
//! A bare string is a puzzle; a string plus a direction is a diagnosis. Knowing that `abba`
//! is the problem tells you where to look, but knowing your machine *rejects* a string it
//! should accept tells you which transition is missing.

use std::collections::{HashMap, VecDeque};

use serde::{Deserialize, Serialize};

use crate::automaton::{Automaton, StateId};
use crate::ops::symmetric_difference;

/// A string the two machines disagree about, and how.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Counterexample {
    /// The shortest string on which the two differ. May be empty — the empty string is a
    /// perfectly good counterexample when one machine accepts it and the other does not.
    pub input: String,
    /// Which side accepts it.
    pub accepted_by: Side,
}

/// Which of the two machines accepts the counterexample.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Side {
    /// Accepted by the first machine, rejected by the second.
    ///
    /// In grading terms, with the reference first: the string *should* be accepted and the
    /// submission rejects it.
    Left,
    /// Accepted by the second machine, rejected by the first.
    Right,
}

impl Counterexample {
    /// A sentence naming the string and the direction, phrased for a student.
    ///
    /// `reference` and `candidate` name the two machines — typically `"the expected
    /// language"` and `"your machine"`.
    pub fn explain(&self, reference: &str, candidate: &str) -> String {
        let shown = if self.input.is_empty() {
            "the empty string".to_string()
        } else {
            format!("`{}`", self.input)
        };

        match self.accepted_by {
            Side::Left => format!("{shown} is in {reference}, but {candidate} rejects it."),
            Side::Right => format!("{shown} is not in {reference}, but {candidate} accepts it."),
        }
    }
}

/// Find the shortest string the two machines disagree about.
///
/// Returns `None` exactly when they accept the same language — which is what makes this a
/// complete equivalence test as well as a diagnostic.
///
/// ```
/// use kleene_core::{parse, thompson, convert::determinize, counterexample::counterexample};
///
/// let dfa = |r: &str| determinize(&thompson(&parse(r).unwrap()).result).result;
///
/// // Same language, written two ways.
/// assert!(counterexample(&dfa("(a+b)*"), &dfa("(b+a)*")).is_none());
///
/// // Different languages: the shortest disagreement is a single `b`.
/// let found = counterexample(&dfa("a*"), &dfa("(a+b)*")).unwrap();
/// assert_eq!(found.input, "b");
/// ```
pub fn counterexample(left: &Automaton, right: &Automaton) -> Option<Counterexample> {
    let product = symmetric_difference(left, right).result;

    // Breadth-first from the start: the first accepting state reached is at minimum
    // distance, so the path to it spells a shortest disagreement.
    let mut came_from: HashMap<StateId, (StateId, String)> = HashMap::new();
    let mut seen = vec![product.start];
    let mut queue = VecDeque::from([product.start]);

    let accepting_at = |id: StateId| product.state(id).is_some_and(|s| s.accepting);

    let mut found = accepting_at(product.start).then_some(product.start);

    while found.is_none() {
        let Some(current) = queue.pop_front() else {
            break;
        };

        // Iterating the alphabet rather than the transition list keeps sibling edges in
        // alphabet order, so among equally short witnesses the answer is the stable,
        // predictable one rather than whichever edge happened to be inserted first.
        for symbol in &product.alphabet {
            let Some(next) = product.transitions_from(current, Some(symbol)).next() else {
                continue;
            };
            if seen.contains(&next.to) {
                continue;
            }

            seen.push(next.to);
            came_from.insert(next.to, (current, symbol.clone()));

            if accepting_at(next.to) {
                found = Some(next.to);
                break;
            }
            queue.push_back(next.to);
        }
    }

    let target = found?;

    // Walk the parent chain back to the start, then reverse.
    let mut symbols = Vec::new();
    let mut at = target;
    while let Some((previous, symbol)) = came_from.get(&at) {
        symbols.push(symbol.clone());
        at = *previous;
    }
    symbols.reverse();
    let input = symbols.concat();

    // The product says *that* they disagree; running the string says *which way*. Asking
    // the original machines rather than the product keeps this honest even if the product's
    // acceptance rule were ever changed.
    let accepted_by = if accepts(left, &input) {
        Side::Left
    } else {
        Side::Right
    };

    Some(Counterexample { input, accepted_by })
}

/// Whether two machines accept exactly the same language.
///
/// Implemented as "no counterexample exists", so the yes/no answer and the diagnostic can
/// never disagree with each other.
pub fn equivalent(left: &Automaton, right: &Automaton) -> bool {
    counterexample(left, right).is_none()
}

/// Run `input` and report acceptance.
///
/// Handles nondeterminism by tracking the set of possible states, so this is correct for any
/// finite automaton rather than only a complete DFA.
fn accepts(automaton: &Automaton, input: &str) -> bool {
    let closures = crate::convert::epsilon::Closures::compute(automaton);
    let mut current = closures.of_set([automaton.start]);

    for ch in input.chars() {
        let symbol = ch.to_string();
        let moved: Vec<StateId> = current
            .iter()
            .flat_map(|&id| automaton.transitions_from(id, Some(&symbol)))
            .map(|t| t.to)
            .collect();

        current = closures.of_set(moved);
        if current.is_empty() {
            return false;
        }
    }

    current
        .iter()
        .any(|&id| automaton.state(id).is_some_and(|s| s.accepting))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::builder::AutomatonBuilder;
    use crate::convert::subset::determinize;
    use crate::regex::{parse, thompson::thompson};

    fn dfa(regex: &str) -> Automaton {
        determinize(&thompson(&parse(regex).expect("parses")).result).result
    }

    #[test]
    fn identical_languages_have_no_counterexample() {
        assert!(counterexample(&dfa("(a+b)*abb"), &dfa("(a+b)*abb")).is_none());
    }

    #[test]
    fn the_same_language_written_differently_has_no_counterexample() {
        // The check that matters for grading: a student's machine need not look like the
        // reference, only behave like it.
        assert!(counterexample(&dfa("(a+b)*"), &dfa("(b+a)*")).is_none());
        assert!(counterexample(&dfa("a(ba)*"), &dfa("(ab)*a")).is_none());
    }

    #[test]
    fn a_returned_witness_really_does_separate_the_two() {
        // The property that keeps this honest in one direction: a witness that is not
        // actually a disagreement is a lie told to someone already confused.
        let pairs = [
            ("a*", "(a+b)*"),
            ("(a+b)*abb", "(a+b)*ab"),
            ("a", "b"),
            ("ε", "a*"),
            ("(a+b)*a", "a(a+b)*"),
        ];

        for (l, r) in pairs {
            let (left, right) = (dfa(l), dfa(r));
            let found = counterexample(&left, &right).expect("languages differ");
            assert_ne!(
                accepts(&left, &found.input),
                accepts(&right, &found.input),
                "{l} vs {r}: {:?} does not actually separate them",
                found.input
            );
        }
    }

    #[test]
    fn no_witness_is_withheld_when_one_exists() {
        // The other direction: returning None must mean the languages really are equal.
        // Brute-forced over every short string, which is what "really" can mean here.
        let (left, right) = (dfa("(a+b)*abb"), dfa("(a+b)*abb"));
        assert!(counterexample(&left, &right).is_none());

        for s in ["", "a", "b", "ab", "abb", "babb", "abab", "abbb"] {
            assert_eq!(accepts(&left, s), accepts(&right, s), "disagreed on {s:?}");
        }
    }

    #[test]
    fn the_witness_is_the_shortest_one() {
        // Breadth-first is the requirement, not an implementation detail: a long witness
        // is nearly useless to a confused student.
        let found = counterexample(&dfa("a*"), &dfa("(a+b)*")).expect("differ");
        assert_eq!(found.input, "b");

        // `abb` is the shortest string in (a+b)*abb; anything shorter is in neither.
        let found = counterexample(&dfa("∅"), &dfa("(a+b)*abb")).expect("differ");
        assert_eq!(found.input, "abb");
    }

    #[test]
    fn the_empty_string_is_a_valid_counterexample() {
        // ε is in a* and not in aa*, and nothing shorter exists to find.
        let found = counterexample(&dfa("a*"), &dfa("aa*")).expect("differ");
        assert_eq!(found.input, "");
        assert_eq!(found.accepted_by, Side::Left);
    }

    #[test]
    fn the_direction_says_which_side_accepts() {
        let found = counterexample(&dfa("(a+b)*"), &dfa("a*")).expect("differ");
        assert_eq!(
            found.accepted_by,
            Side::Left,
            "`b` is in (a+b)* and not in a*"
        );

        let flipped = counterexample(&dfa("a*"), &dfa("(a+b)*")).expect("differ");
        assert_eq!(flipped.accepted_by, Side::Right);
    }

    #[test]
    fn the_explanation_reads_as_a_diagnosis() {
        let found = counterexample(&dfa("(a+b)*abb"), &dfa("(a+b)*ab")).expect("differ");
        let sentence = found.explain("the expected language", "your machine");

        assert!(sentence.contains("your machine"), "{sentence}");
        assert!(
            sentence.contains("rejects it") || sentence.contains("accepts it"),
            "{sentence}"
        );
    }

    #[test]
    fn the_empty_string_is_described_in_words_not_backticks() {
        // An empty pair of backticks would read as a rendering bug.
        let found = counterexample(&dfa("a*"), &dfa("aa*")).expect("differ");
        let sentence = found.explain("the expected language", "your machine");
        assert!(sentence.contains("the empty string"), "{sentence}");
    }

    #[test]
    fn machines_over_different_alphabets_are_compared_properly() {
        // The right machine has never heard of `c`, so `c` is the disagreement.
        let found = counterexample(&dfa("(a+b+c)*"), &dfa("(a+b)*")).expect("differ");
        assert_eq!(found.input, "c");
        assert_eq!(found.accepted_by, Side::Left);
    }

    #[test]
    fn nfas_can_be_compared_without_determinizing_first() {
        let nfa = thompson(&parse("(a+b)*abb").expect("parses")).result;
        assert!(equivalent(&nfa, &dfa("(a+b)*abb")));
    }

    #[test]
    fn a_partial_machine_compares_correctly_against_a_complete_one() {
        // `q0` has no move on `b`, so `b` is rejected — the comparison must see that
        // rather than treating the missing transition as unknown.
        let partial = AutomatonBuilder::new(["a", "b"])
            .accepting("q0")
            .edge("q0", "q0", "a")
            .build();

        let found = counterexample(&dfa("(a+b)*"), &partial).expect("differ");
        assert_eq!(found.input, "b");
        assert_eq!(found.accepted_by, Side::Left);
    }

    #[test]
    fn equivalence_and_counterexample_never_disagree() {
        // They share an implementation for exactly this reason, but the guarantee is worth
        // asserting: a grader that says "wrong" and then cannot say why is worse than one
        // that says nothing.
        for (l, r) in [
            ("(a+b)*abb", "(a+b)*abb"),
            ("a*", "(a+b)*"),
            ("(ab)*", "(ab)*"),
            ("a+b", "b+a"),
            ("∅", "a"),
        ] {
            let (left, right) = (dfa(l), dfa(r));
            assert_eq!(
                equivalent(&left, &right),
                counterexample(&left, &right).is_none(),
                "{l} vs {r}"
            );
        }
    }

    #[test]
    fn a_witness_is_stable_across_runs() {
        // Alphabet-ordered exploration means the answer does not depend on transition
        // insertion order, which matters for snapshot tests and for a grader whose output
        // students compare with each other.
        let (left, right) = (dfa("(a+b)*"), dfa("∅"));
        let first = counterexample(&left, &right).expect("differ");
        for _ in 0..5 {
            assert_eq!(counterexample(&left, &right), Some(first.clone()));
        }
    }
}
