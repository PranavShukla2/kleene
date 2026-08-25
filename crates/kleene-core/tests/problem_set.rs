//! The problem set, checked as a whole.
//!
//! A problem that cannot be solved is not hard, it is broken — and the person who discovers it
//! would otherwise be a student who assumed they were wrong. Every property here exists so
//! that discovery happens in CI instead.

use kleene_core::teach::{Tier, check, problem_set};
use kleene_core::{convert, regex};

/// The reference answer for a problem: its own target, compiled and minimized.
///
/// Minimized because a problem may state a budget, and the machine Thompson's construction
/// produces is nowhere near minimal — handing that back would fail a budget the problem is
/// perfectly able to meet. A student's answer need not be minimal; a *reference* must be.
fn reference(target: &str) -> kleene_core::Automaton {
    let ast = regex::parse(target).expect("the target parses");
    let dfa = convert::determinize(&regex::thompson(&ast).result).result;
    convert::minimize(&dfa).result
}

#[test]
fn every_target_parses() {
    for problem in problem_set() {
        assert!(
            regex::parse(&problem.spec.target).is_ok(),
            "{}: `{}` does not parse",
            problem.key,
            problem.spec.target
        );
    }
}

#[test]
fn every_problem_is_solvable_by_its_own_target() {
    // The tightest possible check on the set: compile the target, hand it back as an answer,
    // and require the checker to accept it. If this fails, the problem contradicts itself.
    for problem in problem_set() {
        let answer = reference(&problem.spec.target);
        let feedback = check(&problem.spec, &answer);
        assert!(
            feedback.solved,
            "{}: its own target does not solve it — {:?}",
            problem.key, feedback.failure
        );
    }
}

#[test]
fn every_budget_is_achievable() {
    // Task F1. A budget below the minimal machine's size makes a problem impossible, and it
    // is impossible in a way that looks exactly like being bad at the subject.
    for problem in problem_set() {
        let Some(budget) = problem.spec.budget else {
            continue;
        };
        let minimum = problem
            .spec
            .minimum_states()
            .expect("a parsing target has a minimum");
        assert!(
            budget >= minimum,
            "{}: budget {budget} but the smallest machine has {minimum} states",
            problem.key
        );
    }
}

#[test]
fn a_budget_that_is_stated_is_tight() {
    // A budget of 10 on a problem whose answer needs 3 teaches nothing and reads as an error.
    // Where a budget is given at all, it should be the real minimum.
    for problem in problem_set() {
        let Some(budget) = problem.spec.budget else {
            continue;
        };
        let minimum = problem.spec.minimum_states().expect("a minimum");
        assert_eq!(
            budget, minimum,
            "{}: a budget looser than the minimum is not a constraint",
            problem.key
        );
    }
}

#[test]
fn no_two_problems_are_the_same_language() {
    // Two prompts can describe one language without either being wrong. "The number of a's and
    // b's have the same parity" is exactly "even length", which is not obvious from either
    // sentence and made two problems out of one — caught here rather than by a student who
    // solved the same exercise twice and wondered why the second was easy.
    let problems = problem_set();
    for (i, left) in problems.iter().enumerate() {
        for right in problems.iter().skip(i + 1) {
            let a = reference(&left.spec.target);
            let b = reference(&right.spec.target);
            assert!(
                !kleene_core::counterexample::equivalent(&a, &b),
                "{} and {} describe the same language",
                left.key,
                right.key
            );
        }
    }
}

#[test]
fn keys_are_unique() {
    // Progress is stored against these, so a duplicate would silently merge two problems'
    // records into one.
    let mut keys: Vec<String> = problem_set().into_iter().map(|p| p.key).collect();
    let before = keys.len();
    keys.sort();
    keys.dedup();
    assert_eq!(keys.len(), before, "duplicate problem keys");
}

#[test]
fn the_set_is_ordered_by_tier() {
    // Difficulty order is the teaching. A pathological problem in third place sends a student
    // away believing the subject is beyond them.
    let rank = |tier: Tier| match tier {
        Tier::Introductory => 0,
        Tier::Standard => 1,
        Tier::Pathological => 2,
    };

    let ranks: Vec<u8> = problem_set().iter().map(|p| rank(p.tier)).collect();
    let mut sorted = ranks.clone();
    sorted.sort_unstable();
    assert_eq!(ranks, sorted, "the set is not in difficulty order");
}

#[test]
fn there_are_enough_to_be_a_set() {
    // Track C says "~20 problems". Fewer is a sample, not a set.
    assert!(problem_set().len() >= 20, "{}", problem_set().len());
}

#[test]
fn every_problem_says_what_it_is_teaching() {
    for problem in problem_set() {
        assert!(!problem.about.is_empty(), "{}: no note", problem.key);
        assert!(
            !problem.spec.prompt.is_empty(),
            "{}: no prompt",
            problem.key
        );
    }
}

#[test]
fn a_wrong_answer_to_any_problem_gets_a_counterexample() {
    // Never a bare "incorrect", checked across the whole set rather than on one example.
    let wrong = regex::parse("a").expect("parses");
    let wrong = convert::determinize(&regex::thompson(&wrong).result).result;

    for problem in problem_set() {
        let feedback = check(&problem.spec, &wrong);
        if feedback.solved {
            continue; // `a` really is the answer to nothing here, but the set may grow.
        }
        assert!(
            feedback.failure.is_some(),
            "{}: refused without saying why",
            problem.key
        );
    }
}
