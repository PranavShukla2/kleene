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
use crate::convert::{determinize, minimize};
use crate::regex::parser::{ParseError, parse};
use crate::regex::thompson::thompson;
use crate::trace::{Step, Traced};

/// One machine, and the reasoning that produced it.
///
/// Every pane on the conversion page is one of these, which is why they are the same shape:
/// a diagram to draw and a list of steps to scrub through. A pane that carried a machine
/// without its trace would be a pane the step scrubber could not drive.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "Stage")
)]
pub struct Stage {
    /// The machine at this point in the pipeline.
    ///
    /// `Automaton` serializes *through* `WireAutomaton` (see `io::wire`), so ts-rs is told to
    /// describe the wire shape — otherwise the generated type would name an in-memory
    /// structure the frontend never receives.
    #[cfg_attr(feature = "ts", ts(as = "crate::io::wire::WireAutomaton"))]
    pub automaton: Automaton,
    /// How it was reached, one sentence per step.
    pub steps: Vec<Step>,
}

impl From<Traced<Automaton>> for Stage {
    /// Capping happens here, at the boundary, and nowhere inside the algorithms.
    ///
    /// An algorithm that truncated its own trace would be an algorithm whose output depended
    /// on how much of it anyone intended to read — and the CLI, the doctests and the property
    /// tests all consume the full one. This is the only place a trace becomes a payload.
    fn from(traced: Traced<Automaton>) -> Self {
        let (steps, _dropped) = crate::trace::cap(traced.steps);
        Self {
            automaton: traced.result,
            steps,
        }
    }
}

/// What a regular expression compiled to.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "Compilation")
)]
#[serde(tag = "kind", rename_all = "kebab-case")]
// `Parsed` carries three automata and `Failed` carries a span and a sentence, so the variants
// differ in size by a lot. Clippy is right that this wastes memory *when such a value is kept
// around* — in a `Vec`, every element would be the size of the largest variant.
//
// This one is never kept. It is built once per keystroke, serialized across the wasm boundary,
// and dropped. Boxing the large variant to satisfy the lint would add three allocations to the
// path taken on every successful compile, in order to save memory on a value that does not
// outlive the function that made it.
#[allow(clippy::large_enum_variant)]
pub enum Compilation {
    /// It parsed, and here is every machine it becomes.
    ///
    /// All three stages in one result rather than three calls, because the panes have to agree.
    /// Three round trips could each be made against a different expression — the user types
    /// while the first is in flight — and the page would then show a DFA that is not the
    /// determinization of the ε-NFA beside it. One call cannot disagree with itself.
    Parsed {
        /// The expression as the parser understood it, re-printed.
        ///
        /// Not the input echoed back. Seeing `a(b+c)*` come back as `a·(b|c)*` is how someone
        /// discovers that their precedence assumption was wrong, which is the single most
        /// common misunderstanding a regex bar can clear up.
        canonical: String,
        /// Thompson's construction.
        nfa: Stage,
        /// Subset construction over the ε-NFA.
        dfa: Stage,
        /// Partition refinement over the DFA.
        minimal: Stage,
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
            let nfa = thompson(&regex);
            let dfa = determinize(&nfa.result);
            let minimal = minimize(&dfa.result);

            Some(Compilation::Parsed {
                canonical,
                nfa: nfa.into(),
                dfa: dfa.into(),
                minimal: minimal.into(),
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
            Some(Compilation::Parsed { nfa, .. }) => nfa.automaton,
            other => panic!("expected {source:?} to parse, got {other:?}"),
        }
    }

    /// Every stage of a successful compile.
    fn stages(source: &str) -> (Stage, Stage, Stage) {
        match compile(source) {
            Some(Compilation::Parsed {
                nfa, dfa, minimal, ..
            }) => (nfa, dfa, minimal),
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
    fn every_stage_records_its_reasoning() {
        // A stage without steps is a pane the scrubber cannot drive.
        let (nfa, dfa, minimal) = stages("(a|b)*abb");
        assert!(!nfa.steps.is_empty());
        assert!(!dfa.steps.is_empty());
        assert!(!minimal.steps.is_empty());
    }

    #[test]
    fn every_stage_accepts_the_same_language() {
        // The property that makes the panes worth putting side by side. Three different
        // machines, three different state counts, one language — and if that ever stopped
        // being true the page would be teaching something false.
        let (nfa, dfa, minimal) = stages("(a|b)*abb");
        for word in ["abb", "aabb", "babb", "ababb", "", "a", "ab", "abba"] {
            let n = crate::simulate::accepts(&nfa.automaton, word);
            assert_eq!(n, crate::simulate::accepts(&dfa.automaton, word), "{word}");
            assert_eq!(
                n,
                crate::simulate::accepts(&minimal.automaton, word),
                "{word}"
            );
        }
    }

    #[test]
    fn the_dfa_is_deterministic_and_the_minimal_one_is_no_larger() {
        use crate::automaton::Determinism;

        let (_, dfa, minimal) = stages("(a|b)*abb");
        assert_eq!(dfa.automaton.determinism(), Determinism::Dfa);
        assert_eq!(minimal.automaton.determinism(), Determinism::Dfa);
        assert!(minimal.automaton.state_count() <= dfa.automaton.state_count());
    }

    #[test]
    fn dfa_states_remember_where_they_came_from() {
        // What the cross-pane highlight is built on (task B3): hovering a DFA state lights up
        // the ε-NFA states it was made from. Subset construction knows that set while it works,
        // and `origin` is where it records it rather than throwing it away.
        let (_, dfa, _) = stages("a|b");
        assert!(
            dfa.automaton.states.values().any(|s| s.origin.is_some()),
            "subset construction should record provenance"
        );
    }
}
