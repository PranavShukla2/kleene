//! Operations that combine languages: complement, union, intersection, difference.
//!
//! All of them except complement are one algorithm — the **product construction** — with a
//! different rule for deciding which pairs accept. Running two machines side by side on the
//! same input and asking a question about both answers is the whole idea, and writing it four
//! times would be four places for the same bug to hide.
//!
//! ## Why the alphabets have to be reconciled first
//!
//! Two machines being compared need not share an alphabet. If one knows about `c` and the
//! other does not, the second silently rejects every string containing `c` — which is
//! *correct*, but only once it has a state to reject in. Comparing them over the union of
//! their alphabets, with both completed, is what makes that rejection explicit rather than a
//! missing transition. Skipping this step is the classic way a difference operation comes out
//! subtly wrong.

use std::collections::VecDeque;

use indexmap::IndexMap;

use crate::automaton::{Automaton, State, StateId, Symbol, Transition};
use crate::convert::complete::complete;
use crate::convert::subset::determinize;
use crate::trace::{Step, StepKind, Traced};

/// Which language the product of two machines should describe.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Combine {
    /// Accepted by either.
    Union,
    /// Accepted by both.
    Intersection,
    /// Accepted by the first and not the second.
    Difference,
    /// Accepted by exactly one — the disagreement between them.
    SymmetricDifference,
}

impl Combine {
    /// Whether a product state accepts, given what each side thinks.
    fn accepts(self, left: bool, right: bool) -> bool {
        match self {
            Self::Union => left || right,
            Self::Intersection => left && right,
            Self::Difference => left && !right,
            Self::SymmetricDifference => left != right,
        }
    }

    fn describe(self) -> &'static str {
        match self {
            Self::Union => "accepted by either machine",
            Self::Intersection => "accepted by both machines",
            Self::Difference => "accepted by the first but not the second",
            Self::SymmetricDifference => "accepted by exactly one of the two",
        }
    }
}

/// Prepare a machine for pairing: deterministic, total, and over the given alphabet.
///
/// Kept separate because [`product`] needs it for both sides and the reasons are subtle
/// enough to be worth stating once.
fn normalize(automaton: &Automaton, alphabet: &[Symbol]) -> Automaton {
    let mut widened = automaton.clone();
    widened.alphabet = alphabet.to_vec();

    // Determinizing an already-deterministic machine is cheap and makes the caller's
    // contract "any finite automaton" rather than "a DFA, and it is your problem if not".
    let dfa = if widened.determinism() == crate::Determinism::Dfa {
        widened
    } else {
        determinize(&widened).result
    };

    complete(&dfa).result
}

/// The union of two alphabets, in a stable order.
fn merged_alphabet(left: &Automaton, right: &Automaton) -> Vec<Symbol> {
    let mut alphabet = left.alphabet.clone();
    for symbol in &right.alphabet {
        if !alphabet.contains(symbol) {
            alphabet.push(symbol.clone());
        }
    }
    alphabet
}

/// Run two machines in lockstep, accepting where `how` says to.
///
/// Only pairs actually reachable from the two start states are built. The full product would
/// be `|A| × |B|` states, most of them unreachable, and a diagram of it is unreadable.
///
/// ```
/// use kleene_core::{parse, thompson, convert::determinize, ops::{product, Combine}};
///
/// let evens = determinize(&thompson(&parse("(aa)*").unwrap()).result).result;
/// let odds  = determinize(&thompson(&parse("a(aa)*").unwrap()).result).result;
///
/// // No string has an even and an odd number of a's.
/// let both = product(&evens, &odds, Combine::Intersection).result;
/// assert!(both.states.values().all(|s| !s.accepting));
/// ```
pub fn product(left: &Automaton, right: &Automaton, how: Combine) -> Traced<Automaton> {
    let alphabet = merged_alphabet(left, right);
    let a = normalize(left, &alphabet);
    let b = normalize(right, &alphabet);

    let mut ids: IndexMap<(StateId, StateId), StateId> = IndexMap::new();
    let mut transitions = Vec::new();
    let mut queue = VecDeque::new();
    let mut steps = Vec::new();

    let start = (a.start, b.start);
    ids.insert(start, 0);
    queue.push_back(start);

    steps.push(Step::new(
        StepKind::Note,
        format!(
            "Running both machines together from ({}, {}). A pair accepts when the string is \
             {}.",
            label(&a, a.start),
            label(&b, b.start),
            how.describe(),
        ),
    ));

    while let Some((p, q)) = queue.pop_front() {
        let from = ids[&(p, q)];

        for symbol in &alphabet {
            // Both are complete, so both moves exist; `?`-style bail-out would be dead code.
            let (Some(pt), Some(qt)) = (
                a.transitions_from(p, Some(symbol)).next().map(|t| t.to),
                b.transitions_from(q, Some(symbol)).next().map(|t| t.to),
            ) else {
                continue;
            };

            // Cannot use `entry().or_insert_with()` here: the closure would need to read
            // `ids.len()` while `entry` holds a mutable borrow. Same shape as subset.rs.
            let to = match ids.get(&(pt, qt)) {
                Some(&existing) => existing,
                None => {
                    let id = ids.len() as StateId;
                    ids.insert((pt, qt), id);
                    queue.push_back((pt, qt));
                    id
                }
            };

            transitions.push(Transition::on(from, to, symbol.clone()));
        }
    }

    let mut states = IndexMap::with_capacity(ids.len());
    for (&(p, q), &id) in &ids {
        let left_accepts = a.state(p).is_some_and(|s| s.accepting);
        let right_accepts = b.state(q).is_some_and(|s| s.accepting);

        let mut state = State::new(format!("({}, {})", label(&a, p), label(&b, q)));
        state.accepting = how.accepts(left_accepts, right_accepts);
        states.insert(id, state);
    }

    let accepting = states.values().filter(|s| s.accepting).count();
    steps.push(Step::new(
        StepKind::Note,
        format!(
            "{} reachable pairs, {accepting} of them accepting. The full product would have \
             had {} — most pairs are never reached together.",
            states.len(),
            a.state_count() * b.state_count(),
        ),
    ));

    Traced::new(
        Automaton {
            alphabet,
            states,
            start: 0,
            transitions,
        },
        steps,
    )
}

fn label(automaton: &Automaton, id: StateId) -> String {
    automaton
        .state(id)
        .map_or_else(|| format!("#{id}"), |s| s.label.clone())
}

/// Strings accepted by either machine.
pub fn union(left: &Automaton, right: &Automaton) -> Traced<Automaton> {
    product(left, right, Combine::Union)
}

/// Strings accepted by both machines.
pub fn intersection(left: &Automaton, right: &Automaton) -> Traced<Automaton> {
    product(left, right, Combine::Intersection)
}

/// Strings accepted by the first machine but not the second.
pub fn difference(left: &Automaton, right: &Automaton) -> Traced<Automaton> {
    product(left, right, Combine::Difference)
}

/// Strings the two machines disagree about.
///
/// Empty exactly when the two accept the same language, which is what makes this the basis
/// of both equivalence checking and counterexample search.
pub fn symmetric_difference(left: &Automaton, right: &Automaton) -> Traced<Automaton> {
    product(left, right, Combine::SymmetricDifference)
}

/// Everything the machine rejects, and nothing it accepts.
///
/// Completion first is not optional. Swapping accepting and non-accepting states only works
/// when every string ends *somewhere*; on a partial machine, strings that fall off the edge
/// are rejected before the swap and still rejected after it, and the complement quietly
/// omits them.
///
/// ```
/// use kleene_core::{AutomatonBuilder, ops::complement};
///
/// // Accepts only `a`; `b` has no transition at all.
/// let only_a = AutomatonBuilder::new(["a", "b"])
///     .state("q0")
///     .accepting("q1")
///     .edge("q0", "q1", "a")
///     .build();
///
/// let rest = complement(&only_a).result;
/// // The trap state added by completion is accepting in the complement.
/// assert!(rest.states.values().filter(|s| s.accepting).count() >= 2);
/// ```
pub fn complement(automaton: &Automaton) -> Traced<Automaton> {
    let dfa = if automaton.determinism() == crate::Determinism::Dfa {
        automaton.clone()
    } else {
        determinize(automaton).result
    };

    let completed = complete(&dfa);
    let missing = completed.steps.len() > 1;
    let mut result = completed.result;

    for state in result.states.values_mut() {
        state.accepting = !state.accepting;
    }

    let mut steps = Vec::new();
    if missing {
        steps.push(Step::new(
            StepKind::Note,
            "Completed first: a string that falls off the edge of a partial machine is \
             rejected either way, so without a trap state those strings would be missing \
             from the complement.",
        ));
    }
    steps.push(Step::new(
        StepKind::Note,
        format!(
            "Swapped accepting and non-accepting: {} of {} states now accept.",
            result.states.values().filter(|s| s.accepting).count(),
            result.state_count(),
        ),
    ));

    Traced::new(result, steps)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::builder::AutomatonBuilder;
    use crate::regex::{parse, thompson::thompson};

    fn dfa(regex: &str) -> Automaton {
        determinize(&thompson(&parse(regex).expect("parses")).result).result
    }

    /// Run a string, reporting acceptance. Assumes a complete DFA.
    fn accepts(automaton: &Automaton, input: &str) -> bool {
        let mut at = automaton.start;
        for ch in input.chars() {
            match automaton.transitions_from(at, Some(&ch.to_string())).next() {
                Some(t) => at = t.to,
                None => return false,
            }
        }
        automaton.state(at).is_some_and(|s| s.accepting)
    }

    /// Every string over {a, b} up to a given length.
    fn strings_up_to(len: usize) -> Vec<String> {
        let mut all = vec![String::new()];
        let mut frontier = vec![String::new()];
        for _ in 0..len {
            let mut next = Vec::new();
            for s in &frontier {
                for c in ["a", "b"] {
                    next.push(format!("{s}{c}"));
                }
            }
            all.extend(next.clone());
            frontier = next;
        }
        all
    }

    #[test]
    fn union_accepts_what_either_accepts() {
        let (l, r) = (dfa("a*"), dfa("b*"));
        let u = union(&l, &r).result;
        for s in strings_up_to(4) {
            assert_eq!(
                accepts(&u, &s),
                accepts(&l, &s) || accepts(&r, &s),
                "union disagreed on {s:?}"
            );
        }
    }

    #[test]
    fn intersection_accepts_only_what_both_accept() {
        let (l, r) = (dfa("(a+b)*a"), dfa("a(a+b)*"));
        let i = intersection(&l, &r).result;
        for s in strings_up_to(4) {
            assert_eq!(
                accepts(&i, &s),
                accepts(&l, &s) && accepts(&r, &s),
                "intersection disagreed on {s:?}"
            );
        }
    }

    #[test]
    fn difference_removes_the_second_language() {
        let (l, r) = (dfa("(a+b)*"), dfa("(a+b)*a"));
        let d = difference(&l, &r).result;
        for s in strings_up_to(4) {
            assert_eq!(accepts(&d, &s), accepts(&l, &s) && !accepts(&r, &s));
        }
    }

    #[test]
    fn symmetric_difference_is_empty_for_equal_languages() {
        // The property that makes equivalence checking work.
        let sd = symmetric_difference(&dfa("(a+b)*abb"), &dfa("(a+b)*abb")).result;
        assert!(
            sd.states.values().all(|s| !s.accepting),
            "identical languages must disagree nowhere"
        );
    }

    #[test]
    fn symmetric_difference_is_non_empty_for_different_languages() {
        let sd = symmetric_difference(&dfa("(a+b)*abb"), &dfa("(a+b)*ab")).result;
        assert!(sd.states.values().any(|s| s.accepting));
    }

    #[test]
    fn complement_flips_membership_for_every_string() {
        let original = dfa("(a+b)*abb");
        let flipped = complement(&original).result;
        for s in strings_up_to(5) {
            assert_ne!(
                accepts(&original, &s),
                accepts(&flipped, &s),
                "complement agreed with the original on {s:?}"
            );
        }
    }

    #[test]
    fn complement_of_a_partial_machine_includes_the_fallen_off_strings() {
        // The reason completion comes first. `b` has no transition in the original, so it
        // is rejected; the complement must therefore accept it.
        let only_a = AutomatonBuilder::new(["a", "b"])
            .state("q0")
            .accepting("q1")
            .edge("q0", "q1", "a")
            .build();

        let flipped = complement(&only_a).result;
        assert!(
            accepts(&flipped, "b"),
            "a string that fell off the edge was lost"
        );
        assert!(!accepts(&flipped, "a"));
    }

    #[test]
    fn complementing_twice_returns_the_original_language() {
        let original = dfa("(a+b)*abb");
        let twice = complement(&complement(&original).result).result;
        for s in strings_up_to(5) {
            assert_eq!(accepts(&original, &s), accepts(&twice, &s));
        }
    }

    #[test]
    fn machines_over_different_alphabets_are_compared_over_the_union() {
        // The classic subtle bug: the right machine has never heard of `c`, so it rejects
        // every string containing one — which the difference must reflect.
        let left = dfa("(a+b+c)*");
        let right = dfa("(a+b)*");

        let d = difference(&left, &right).result;
        assert!(d.alphabet.contains(&"c".to_string()));
        assert!(
            accepts(&d, "c"),
            "`c` is in the left language and not the right"
        );
        assert!(
            !accepts(&d, "ab"),
            "`ab` is in both, so not in the difference"
        );
    }

    #[test]
    fn only_reachable_pairs_are_built() {
        // The full product of two 5-state machines is 25 states; almost none are reachable
        // together, and a 25-state diagram of a 6-state language is unreadable.
        let p = product(&dfa("(a+b)*abb"), &dfa("(a+b)*abb"), Combine::Union).result;
        assert!(p.state_count() < 25, "built {} states", p.state_count());
    }

    #[test]
    fn a_product_is_deterministic_and_complete() {
        let p = union(&dfa("a*"), &dfa("b*")).result;
        assert_eq!(p.determinism(), crate::Determinism::Dfa);
        assert!(p.is_complete());
        assert!(!p.validate().has_errors());
    }

    #[test]
    fn nfa_inputs_are_accepted_and_determinized_on_the_way_in() {
        // The contract is "any finite automaton", not "a DFA, and good luck otherwise".
        let nfa = thompson(&parse("a+b").expect("parses")).result;
        assert_ne!(nfa.determinism(), crate::Determinism::Dfa);

        let u = union(&nfa, &dfa("c")).result;
        assert_eq!(u.determinism(), crate::Determinism::Dfa);
    }
}
