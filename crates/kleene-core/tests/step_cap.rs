//! The trace cap (decision D18, Phase 3 G2).
//!
//! A pathological regular expression forces exponential blow-up in subset construction, and an
//! uncapped trace grows with it — measured at roughly 0.36 KB of JSON per step, so the tab
//! locks up before the diagram finishes drawing.
//!
//! Its own integration test rather than a unit test beside the cap, because what is being
//! asserted is a property of the *boundary types* — three of them, built by three different
//! modules — rather than of the function they all call. A cap that worked in `trace.rs` and was
//! forgotten in one of the three would pass every unit test in the file that defines it.

use kleene_core::convert::{determinize, elimination, minimization, to_regex::Order};
use kleene_core::regex::compile::{Compilation, compile};
use kleene_core::trace::STEP_CAP;
use kleene_core::{parse, thompson};

/// An expression whose DFA is exponential in the number of trailing symbols.
///
/// `(a+b)*a(a+b)(a+b)…` has to remember the last *n* symbols, which needs 2ⁿ states. Eight is
/// enough to blow past the cap and still finish in milliseconds.
const PATHOLOGICAL: &str = "(a+b)*a(a+b)(a+b)(a+b)(a+b)(a+b)(a+b)(a+b)";

#[test]
fn a_pathological_expression_does_not_produce_an_unbounded_trace() {
    let Some(Compilation::Parsed {
        nfa, dfa, minimal, ..
    }) = compile(PATHOLOGICAL)
    else {
        panic!("the expression should parse");
    };

    for (name, steps) in [
        ("nfa", nfa.steps.len()),
        ("dfa", dfa.steps.len()),
        ("minimal", minimal.steps.len()),
    ] {
        assert!(steps <= STEP_CAP, "{name} carried {steps} steps");
    }

    // The point of the cap: the *answer* is untouched. 2⁸ states plus the ones before them.
    assert!(
        dfa.automaton.state_count() > STEP_CAP / 4,
        "the machine was truncated, which is the one thing the cap must never do"
    );
}

#[test]
fn a_capped_trace_says_that_it_was_capped() {
    let Some(Compilation::Parsed { dfa, .. }) = compile(PATHOLOGICAL) else {
        panic!("parses");
    };

    assert_eq!(dfa.steps.len(), STEP_CAP);
    let last = dfa.steps.last().expect("a last step");
    assert!(
        last.detail.contains("not recorded"),
        "a truncated explanation that does not admit it is worse than a long one: {}",
        last.detail
    );
}

#[test]
fn an_ordinary_expression_is_left_alone() {
    // The cap must be invisible at every size anyone actually types.
    for input in ["(a+b)*abb", "a*b*", "(ab)*+b", "a"] {
        let Some(Compilation::Parsed { dfa, .. }) = compile(input) else {
            panic!("{input} parses");
        };
        assert!(dfa.steps.len() < STEP_CAP, "{input}");
        assert!(
            !dfa.steps.iter().any(|s| s.detail.contains("not recorded")),
            "{input} was capped and should not have been"
        );
    }
}

#[test]
fn minimization_keeps_its_splits_aligned_with_its_capped_steps() {
    // The coupling the cap has to respect: a view scrubbing to step n reads splits[n].
    let dfa = determinize(&thompson(&parse(PATHOLOGICAL).expect("parses")).result).result;
    let m = minimization(&dfa);

    assert!(m.steps.len() <= STEP_CAP);
    assert_eq!(m.splits.len(), m.steps.len());
}

#[test]
fn elimination_refuses_the_pathological_case_rather_than_capping_it() {
    // The cap does not apply here and could not help if it did. Elimination emits one step per
    // state, so a 257-state machine produces 259 steps — nowhere near the cap — while its
    // *expression* runs to megabytes. Measured: 33 states already costs 741ms and 177,197
    // characters, and every doubling is ~40× worse.
    //
    // Truncating an explanation leaves a correct machine. Truncating an expression leaves a
    // wrong answer that looks like a right one, so this refuses instead.
    let dfa = determinize(&thompson(&parse(PATHOLOGICAL).expect("parses")).result).result;
    let e = elimination(&dfa, Order::default());

    assert!(
        e.refused.is_some(),
        "a 257-state machine must not be attempted"
    );
    assert!(
        e.regex.is_empty(),
        "a refusal must not also carry an answer"
    );
}

#[test]
fn elimination_keeps_its_stages_aligned_within_the_limit() {
    let dfa = determinize(&thompson(&parse("(a+b)*abb").expect("parses")).result).result;
    let e = elimination(&dfa, Order::default());

    assert_eq!(e.refused, None);
    assert_eq!(e.stages.len(), e.steps.len());
    assert!(
        parse(&e.regex).is_ok(),
        "the answer must still be an expression"
    );
}
