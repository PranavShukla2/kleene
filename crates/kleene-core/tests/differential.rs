//! Differential testing against Rust's `regex` crate.
//!
//! Every other test in this repository checks Kleene against Kleene. The property suite is
//! strong, but a misunderstanding baked into both the parser and the simulator would satisfy
//! all of it — the pipeline would be beautifully self-consistent and wrong. This file is the
//! only check that compares against something written by someone else.
//!
//! ## The shared subset
//!
//! `regex` is a production engine with a much larger syntax, and Kleene deliberately uses
//! textbook notation (decision D1: `+` means union). So expressions are generated in Kleene's
//! AST and *translated* into `regex` syntax rather than shared as text:
//!
//! | Kleene | `regex` |
//! |---|---|
//! | `a` | `a` |
//! | `rs` | `rs` |
//! | `r + s` | `(?:r\|s)` |
//! | `r*` | `(?:r)*` |
//! | `ε` | the empty pattern |
//! | `∅` | `[^\s\S]` — a class nothing can match |
//!
//! The pattern is anchored, because `regex` searches by default and Kleene decides
//! membership. Comparing an unanchored search against a membership test would make this
//! file agree loudly about nothing.

use kleene_core::convert::{determinize, minimize};
use kleene_core::regex::{Regex, thompson::thompson};
use kleene_core::simulate::accepts;

use proptest::prelude::*;

const ALPHABET: [&str; 3] = ["a", "b", "c"];

/// Expressions over the subset both engines can express.
fn arb_regex() -> impl Strategy<Value = Regex> {
    let leaf = prop_oneof![
        8 => (0..ALPHABET.len()).prop_map(|i| Regex::symbol(ALPHABET[i])),
        1 => Just(Regex::Epsilon),
        1 => Just(Regex::Empty),
    ];

    leaf.prop_recursive(4, 24, 3, |inner| {
        prop_oneof![
            3 => (inner.clone(), inner.clone()).prop_map(|(l, r)| Regex::concat(l, r)),
            3 => (inner.clone(), inner.clone()).prop_map(|(l, r)| Regex::union(l, r)),
            2 => inner.prop_map(Regex::star),
        ]
    })
}

fn arb_string() -> impl Strategy<Value = String> {
    proptest::collection::vec(0..ALPHABET.len(), 0..8)
        .prop_map(|indices| indices.into_iter().map(|i| ALPHABET[i]).collect())
}

/// Translate a Kleene expression into `regex` crate syntax.
///
/// Non-capturing groups everywhere, so precedence is explicit rather than trusted to two
/// engines agreeing about it — which is exactly the thing under test and cannot be assumed
/// while testing it.
fn translate(regex: &Regex) -> String {
    match regex {
        // A class that matches no character at all. `regex` has no literal empty-language
        // syntax, and this is the standard way to spell it.
        Regex::Empty => r"[^\s\S]".to_string(),
        Regex::Epsilon => String::new(),
        Regex::Symbol(s) => regex_syntax::escape(s),
        Regex::Concat(l, r) => format!("(?:{})(?:{})", translate(l), translate(r)),
        Regex::Union(l, r) => format!("(?:{}|{})", translate(l), translate(r)),
        Regex::Star(inner) => format!("(?:{})*", translate(inner)),
    }
}

/// Compile a Kleene expression with the `regex` crate, anchored for membership.
fn oracle(expression: &Regex) -> regex::Regex {
    let pattern = format!("^(?:{})$", translate(expression));
    regex::Regex::new(&pattern).unwrap_or_else(|e| panic!("{expression} → {pattern}: {e}"))
}

proptest! {
    #![proptest_config(ProptestConfig {
        cases: 256,
        failure_persistence: Some(Box::new(
            proptest::test_runner::FileFailurePersistence::WithSource("regressions")
        )),
        ..ProptestConfig::default()
    })]

    /// Kleene and the `regex` crate agree about membership.
    ///
    /// The one test in the repository that could catch a misconception shared by Kleene's
    /// parser and its simulator, which every self-consistent test would miss.
    #[test]
    fn kleene_agrees_with_the_regex_crate(expression in arb_regex(), input in arb_string()) {
        let nfa = thompson(&expression).result;
        let theirs = oracle(&expression).is_match(&input);

        prop_assert_eq!(
            accepts(&nfa, &input),
            theirs,
            "{} on {:?}: kleene says {}, regex says {}",
            expression, input, accepts(&nfa, &input), theirs
        );
    }

    /// The agreement survives the whole conversion pipeline.
    ///
    /// Determinization and minimization must not drift away from an independent
    /// implementation any more than they drift from Kleene's own NFA.
    #[test]
    fn the_pipeline_agrees_with_the_regex_crate(
        expression in arb_regex(),
        input in arb_string(),
    ) {
        let nfa = thompson(&expression).result;
        let dfa = determinize(&nfa).result;
        let minimal = minimize(&dfa).result;

        let theirs = oracle(&expression).is_match(&input);

        prop_assert_eq!(accepts(&dfa, &input), theirs, "DFA drifted on {:?}", input);
        prop_assert_eq!(accepts(&minimal, &input), theirs, "minimal drifted on {:?}", input);
    }
}

#[test]
fn the_translation_is_faithful_on_known_cases() {
    // The translation itself is code, so it gets its own check. If it were wrong, the
    // differential tests would compare Kleene against the wrong thing and agree anyway.
    let cases: [(Regex, &str, bool); 8] = [
        (Regex::symbol("a"), "a", true),
        (Regex::symbol("a"), "b", false),
        (Regex::Epsilon, "", true),
        (Regex::Epsilon, "a", false),
        (Regex::Empty, "", false),
        (Regex::star(Regex::symbol("a")), "aaa", true),
        (
            Regex::union(Regex::symbol("a"), Regex::symbol("b")),
            "b",
            true,
        ),
        (
            Regex::concat(Regex::symbol("a"), Regex::symbol("b")),
            "ab",
            true,
        ),
    ];

    for (expression, input, expected) in cases {
        assert_eq!(
            oracle(&expression).is_match(input),
            expected,
            "oracle disagreed: {expression} on {input:?}"
        );
        assert_eq!(
            accepts(&thompson(&expression).result, input),
            expected,
            "kleene disagreed: {expression} on {input:?}"
        );
    }
}

#[test]
fn the_oracle_is_anchored() {
    // `regex` searches by default. An unanchored oracle would call `ab` a match for the
    // expression `b`, and this whole file would agree loudly about nothing.
    assert!(!oracle(&Regex::symbol("b")).is_match("ab"));
    assert!(oracle(&Regex::symbol("b")).is_match("b"));
}
