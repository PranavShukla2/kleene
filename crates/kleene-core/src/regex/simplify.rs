//! Algebraic simplification of regular expressions.
//!
//! This is not a nicety. State elimination builds expressions by repeatedly substituting one
//! into another, and without simplification the output for a six-state DFA runs to hundreds of
//! characters — full of `∅` branches that match nothing and `ε` concatenations that do
//! nothing. A correct answer nobody can read is not an answer, so the feature is only usable
//! with this pass in front of it.
//!
//! ## The rules
//!
//! Every one is an identity of regular languages, applied bottom-up until nothing changes:
//!
//! | Rule | Why |
//! |---|---|
//! | `∅ + r → r` | The empty language contributes nothing to a union. |
//! | `∅r → ∅`, `r∅ → ∅` | No string can pass through something that matches nothing. |
//! | `εr → r`, `rε → r` | Concatenating the empty string changes nothing. |
//! | `r + r → r` | Union is idempotent. |
//! | `(r*)* → r*` | Repeating a repetition adds nothing. |
//! | `∅* → ε` | Zero repetitions of nothing is the empty string. |
//! | `ε* → ε` | Repeating the empty string gives the empty string. |
//! | `ε + r* → r*` | `r*` already contains the empty string. |
//!
//! Deliberately **not** included: distributing concatenation over union, reordering unions to
//! find more matches, or factoring common prefixes. Those find further reductions but can
//! rewrite an expression into something a student would not recognise as their own working —
//! and the goal here is a readable answer, not a canonical one.

use crate::regex::ast::Regex;

/// Simplify until no rule applies.
///
/// Guaranteed to preserve the language. The test suite checks that with the counterexample
/// engine rather than by inspection.
///
/// ```
/// use kleene_core::{parse, regex::simplify};
///
/// // The kind of expression state elimination actually produces.
/// let messy = parse("(∅ + a)(ε + ∅)").unwrap();
/// assert_eq!(simplify(&messy).to_string(), "a");
/// ```
pub fn simplify(regex: &Regex) -> Regex {
    let mut current = regex.clone();

    // Rules can expose each other — `∅r → ∅` may create a `∅ + s` that the union rule then
    // collapses — so this repeats to a fixed point rather than making a single pass.
    // Bounded because every rule strictly shrinks the tree except `∅* → ε` and `ε* → ε`,
    // which shrink it too.
    loop {
        let next = once(&current);
        if next == current {
            return current;
        }
        current = next;
    }
}

/// One bottom-up simplification pass.
fn once(regex: &Regex) -> Regex {
    match regex {
        Regex::Empty | Regex::Epsilon | Regex::Symbol(_) => regex.clone(),

        Regex::Star(inner) => match once(inner) {
            // Nothing repeated is the empty string; the empty string repeated is itself.
            Regex::Empty | Regex::Epsilon => Regex::Epsilon,
            // (r*)* and r* describe the same language.
            starred @ Regex::Star(_) => starred,
            other => Regex::star(other),
        },

        Regex::Concat(left, right) => match (once(left), once(right)) {
            // Anything concatenated with the empty language matches nothing at all.
            (Regex::Empty, _) | (_, Regex::Empty) => Regex::Empty,
            // The empty string is the identity for concatenation.
            (Regex::Epsilon, other) | (other, Regex::Epsilon) => other,
            (l, r) => Regex::concat(l, r),
        },

        Regex::Union(left, right) => match (once(left), once(right)) {
            // The empty language is the identity for union.
            (Regex::Empty, other) | (other, Regex::Empty) => other,

            (l, r) => {
                // Union is idempotent: writing a branch twice adds nothing.
                if l == r {
                    return l;
                }

                // r* already matches the empty string, so offering ε alongside it is
                // redundant. Common in state-elimination output, where the ε comes from
                // the added start edge.
                if let Regex::Epsilon = l
                    && matches!(r, Regex::Star(_))
                {
                    return r;
                }
                if let Regex::Epsilon = r
                    && matches!(l, Regex::Star(_))
                {
                    return l;
                }

                Regex::union(l, r)
            }
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::convert::determinize;
    use crate::counterexample::equivalent;
    use crate::regex::{parse, thompson::thompson};

    fn simplified(input: &str) -> String {
        simplify(&parse(input).expect("parses")).to_string()
    }

    #[test]
    fn the_empty_language_disappears_from_unions() {
        assert_eq!(simplified("∅+a"), "a");
        assert_eq!(simplified("a+∅"), "a");
    }

    #[test]
    fn the_empty_language_swallows_concatenations() {
        assert_eq!(simplified("∅a"), "∅");
        assert_eq!(simplified("a∅"), "∅");
        assert_eq!(simplified("a∅b"), "∅");
    }

    #[test]
    fn the_empty_string_vanishes_from_concatenations() {
        assert_eq!(simplified("εa"), "a");
        assert_eq!(simplified("aε"), "a");
        assert_eq!(simplified("εaε"), "a");
    }

    #[test]
    fn union_is_idempotent() {
        assert_eq!(simplified("a+a"), "a");
        assert_eq!(simplified("(ab)+(ab)"), "ab");
    }

    #[test]
    fn nested_stars_collapse() {
        assert_eq!(simplified("a**"), "a*");
        assert_eq!(simplified("(a*)*"), "a*");
        assert_eq!(simplified("(a**)*"), "a*");
    }

    #[test]
    fn starring_the_trivial_languages_gives_epsilon() {
        assert_eq!(simplified("∅*"), "ε");
        assert_eq!(simplified("ε*"), "ε");
    }

    #[test]
    fn epsilon_is_absorbed_by_a_neighbouring_star() {
        // Very common in state-elimination output, where the ε comes from the added
        // start edge.
        assert_eq!(simplified("ε+a*"), "a*");
        assert_eq!(simplified("a*+ε"), "a*");
    }

    #[test]
    fn rules_that_expose_other_rules_are_applied_to_a_fixed_point() {
        // `∅b → ∅` leaves `a + ∅`, which the union rule then collapses. A single pass
        // would stop after the first of those.
        assert_eq!(simplified("a+∅b"), "a");
        assert_eq!(simplified("(∅+ε)(a+∅)"), "a");
    }

    #[test]
    fn an_already_simple_expression_is_left_alone() {
        for input in ["a", "ab", "a+b", "a*", "(a+b)*abb", "ε", "∅"] {
            assert_eq!(simplified(input), parse(input).expect("parses").to_string());
        }
    }

    #[test]
    fn simplification_never_changes_the_language() {
        // The property that matters. Checked with the counterexample engine rather than by
        // inspection, because a simplification rule that is subtly wrong produces output
        // that still *looks* plausible.
        let cases = [
            "∅+a",
            "a∅",
            "εa",
            "a+a",
            "a**",
            "∅*",
            "ε+a*",
            "a+∅b",
            "(∅+ε)(a+∅)",
            "(a+b)*abb",
            "(ε+a)(b+∅)*",
            "a*(ε+b)*",
            "((a+ε)b*)*",
        ];

        for input in cases {
            let original = parse(input).expect("parses");
            let reduced = simplify(&original);

            let before = determinize(&thompson(&original).result).result;
            let after = determinize(&thompson(&reduced).result).result;

            assert!(
                equivalent(&before, &after),
                "{input} simplified to {reduced}, which is a different language"
            );
        }
    }

    #[test]
    fn simplification_is_idempotent() {
        for input in ["a+∅b", "(∅+ε)(a+∅)", "((a+ε)b*)*", "ε+a*"] {
            let once = simplify(&parse(input).expect("parses"));
            assert_eq!(simplify(&once), once, "{input} was not at a fixed point");
        }
    }

    #[test]
    fn simplification_never_makes_an_expression_bigger() {
        for input in ["a+∅b", "(∅+ε)(a+∅)", "(a+b)*abb", "a**", "ε+a*"] {
            let original = parse(input).expect("parses");
            assert!(
                simplify(&original).size() <= original.size(),
                "{input} grew"
            );
        }
    }
}
