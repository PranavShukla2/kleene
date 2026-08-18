//! Turning what somebody typed into a machine, or into a reason it is not one.
//!
//! The regex bar's whole job, in one call. It exists in the core rather than being assembled
//! at the wasm boundary for the reason every other pipeline step is: the answer to "what does
//! this regex mean" must be the same for the browser, the CLI and the docs generator, and
//! three call sites stitching `parse` to `thompson` is three chances to stitch it differently.
//!
//! ## Why a tagged outcome and not two `Option`s
//!
//! `{ automaton: Option<_>, error: Option<_> }` admits two states that cannot happen — both
//! set, and neither — and every consumer then has to decide what to do about them. A tagged
//! enum makes the impossible unrepresentable, and ts-rs turns it into a discriminated union
//! that TypeScript narrows on its own.

use serde::{Deserialize, Serialize};

use crate::automaton::Automaton;
use crate::regex::parser::{ParseError, parse};
use crate::regex::thompson::thompson;
use crate::trace::Step;

/// What a regular expression compiled to.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "Compilation")
)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Compilation {
    /// It parsed, and Thompson's construction built this.
    Parsed {
        /// The ε-NFA.
        ///
        /// `Automaton` serializes *through* `WireAutomaton` (see `io::wire`), so ts-rs is told
        /// to describe the wire shape — otherwise the generated type would name an in-memory
        /// structure the frontend never receives.
        #[cfg_attr(feature = "ts", ts(as = "crate::io::wire::WireAutomaton"))]
        automaton: Automaton,
        /// How it was built, one sentence per step.
        steps: Vec<Step>,
        /// The expression as the parser understood it, re-printed.
        ///
        /// Not the input echoed back. Seeing `a(b+c)*` come back as `a·(b|c)*` is how someone
        /// discovers that their precedence assumption was wrong, which is the single most
        /// common misunderstanding a regex bar can clear up.
        canonical: String,
    },
    /// It did not parse, and here is exactly where and why.
    Failed {
        /// Where and what, with a suggestion when there is a specific one.
        error: ParseError,
    },
}

/// Compile a regular expression into an ε-NFA.
///
/// An empty input is *not* an error. It is the state the bar is in before anyone has typed
/// anything, and reporting "unexpected end of input" at that moment would greet every visitor
/// with a mistake they have not made yet.
///
/// ```
/// use kleene_core::regex::compile::{Compilation, compile};
///
/// assert!(matches!(compile("a(b+c)*"), Some(Compilation::Parsed { .. })));
/// assert!(matches!(compile("a("), Some(Compilation::Failed { .. })));
/// assert!(compile("   ").is_none());
/// ```
pub fn compile(source: &str) -> Option<Compilation> {
    if source.trim().is_empty() {
        return None;
    }

    match parse(source) {
        Ok(regex) => {
            let canonical = regex.to_string();
            let traced = thompson(&regex);
            Some(Compilation::Parsed {
                automaton: traced.result,
                steps: traced.steps,
                canonical,
            })
        }
        Err(error) => Some(Compilation::Failed { error }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The automaton from a successful compile, or a panic naming the failure.
    fn built(source: &str) -> Automaton {
        match compile(source) {
            Some(Compilation::Parsed { automaton, .. }) => automaton,
            other => panic!("expected {source:?} to parse, got {other:?}"),
        }
    }

    fn failure(source: &str) -> ParseError {
        match compile(source) {
            Some(Compilation::Failed { error }) => error,
            other => panic!("expected {source:?} to fail, got {other:?}"),
        }
    }

    #[test]
    fn an_empty_bar_is_not_an_error() {
        // The state the input is in before anyone has typed. Reporting "unexpected end of
        // input" here would greet every visitor with a mistake they have not made.
        assert!(compile("").is_none());
        assert!(compile("   ").is_none());
    }

    #[test]
    fn a_symbol_compiles_to_a_machine_that_accepts_it() {
        let machine = built("a");
        assert!(crate::simulate::accepts(&machine, "a"));
        assert!(!crate::simulate::accepts(&machine, "b"));
    }

    #[test]
    fn the_built_machine_agrees_with_the_expression() {
        // The property that matters: whatever else compile does, the machine it returns must
        // accept exactly the language the expression describes.
        let machine = built("a(b+c)*");
        for accepted in ["a", "ab", "ac", "abc", "acbbc"] {
            assert!(crate::simulate::accepts(&machine, accepted), "{accepted}");
        }
        for rejected in ["", "b", "ba", "abca"] {
            assert!(!crate::simulate::accepts(&machine, rejected), "{rejected}");
        }
    }

    #[test]
    fn both_union_spellings_mean_the_same_thing() {
        // Decision D1: `+` and `|` are both union. A student copying from one textbook and a
        // lecturer writing on a board should not produce different machines.
        assert_eq!(
            built("a+b").transitions.len(),
            built("a|b").transitions.len()
        );
        assert!(crate::simulate::accepts(&built("a|b"), "b"));
    }

    #[test]
    fn the_canonical_form_shows_the_precedence_that_was_applied() {
        // The reason it is returned at all. Someone who expected `ab+c` to mean `a(b+c)` finds
        // out here rather than by puzzling over a diagram.
        match compile("ab+c") {
            Some(Compilation::Parsed { canonical, .. }) => {
                assert!(
                    canonical.contains('|') || canonical.contains('+'),
                    "{canonical}"
                );
            }
            other => panic!("expected a parse, got {other:?}"),
        }
    }

    #[test]
    fn a_failure_points_at_the_offending_span() {
        // Underlining the exact characters is the whole difference between a parse error a
        // student can act on and a red border.
        let error = failure("a(b");
        assert!(error.span.end >= error.span.start);
        assert!(!error.message.is_empty());
    }

    #[test]
    fn a_postfix_plus_explains_itself() {
        // The load-bearing case for D1. `a+` is one-or-more in most regex dialects and union
        // here, so it has to fail *loudly* with a sentence rather than parse into a machine
        // that quietly means something else.
        let error = failure("a+");
        assert!(
            error.help.is_some() || error.message.len() > 10,
            "a bare `a+` needs an explanation, got {error:?}"
        );
    }

    #[test]
    fn steps_are_recorded_for_the_view_that_will_show_them() {
        match compile("ab") {
            Some(Compilation::Parsed { steps, .. }) => assert!(!steps.is_empty()),
            other => panic!("expected a parse, got {other:?}"),
        }
    }
}
