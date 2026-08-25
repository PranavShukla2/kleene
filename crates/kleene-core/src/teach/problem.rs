//! What a problem *is*, and what it means to have solved it.
//!
//! A `ProblemSpec` is the thing a lecturer hands out and a student opens. It carries the
//! target language, an optional state budget, and a prompt in words — and, critically, it
//! carries them in a form that fits in a URL, because the alternative is an account system.
//!
//! ## The whole design constraint, restated
//!
//! There is no server. A problem link is not a row in a database that a student is granted
//! access to; it is the problem itself, encoded. That has one consequence worth stating out
//! loud rather than discovering: **the answer travels with the question.** Anyone who opens a
//! link can read the target language out of it.
//!
//! That is not a flaw to be patched, it is a property to be honest about. Teaching-layer B5
//! requires the UI to say so plainly, and `kleene grade` exists so that anything actually
//! being marked runs against a reference the student never had.
//!
//! ## Why the target is a regular expression rather than an automaton
//!
//! A reference automaton would make the link enormous and would also leak a *particular*
//! solution, which is exactly the thing a student should be constructing. An expression names
//! the language without naming a machine for it — and since the checker compares languages
//! rather than shapes, any correct machine passes.

use serde::{Deserialize, Serialize};

use crate::automaton::Automaton;
use crate::convert::{determinize, minimize};
use crate::counterexample::{Counterexample, Side, counterexample};
use crate::regex::parse;

/// The format version, frozen from the first release.
///
/// A link handed out in September must still open in November (task A4). Every future change
/// either keeps this number and stays backward-compatible, or raises it and provides a
/// migration — the same contract `.kln` documents make.
pub const SPEC_VERSION: u32 = 1;

/// A problem, as it travels.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "generated/"))]
pub struct ProblemSpec {
    /// Frozen at [`SPEC_VERSION`].
    pub version: u32,
    /// What to build, in words. Shown to the student; never checked against.
    pub prompt: String,
    /// The target language, as a regular expression in Kleene's textbook syntax.
    pub target: String,
    /// The largest number of states an accepted answer may use.
    ///
    /// Optional because most problems are about the language and not about compactness. When
    /// present it is checked *after* the language, so a student is never told their machine is
    /// too big when it is also wrong — two failures reported at once is one failure explained.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub budget: Option<usize>,
    /// The alphabet the answer must be over, when the problem restricts it.
    ///
    /// A machine over `{a, b, c}` that happens to accept the right language over `{a, b}` is
    /// usually a misunderstanding rather than a clever answer, and saying so early is kinder
    /// than letting it pass.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alphabet: Option<Vec<String>>,
}

impl ProblemSpec {
    /// A problem with only a prompt and a target.
    pub fn new(prompt: impl Into<String>, target: impl Into<String>) -> Self {
        Self {
            version: SPEC_VERSION,
            prompt: prompt.into(),
            target: target.into(),
            budget: None,
            alphabet: None,
        }
    }

    /// Require an answer to use at most `states`.
    #[must_use]
    pub fn with_budget(mut self, states: usize) -> Self {
        self.budget = Some(states);
        self
    }

    /// Require an answer to be over exactly this alphabet.
    #[must_use]
    pub fn with_alphabet(mut self, alphabet: Vec<String>) -> Self {
        self.alphabet = Some(alphabet);
        self
    }

    /// The smallest number of states any correct answer needs.
    ///
    /// Used to check that a budget is achievable before a problem is handed out (task F1): a
    /// challenge that cannot be solved is not hard, it is broken. `None` when the target does
    /// not parse.
    pub fn minimum_states(&self) -> Option<usize> {
        let ast = parse(&self.target).ok()?;
        let nfa = crate::regex::thompson(&ast).result;
        Some(minimize(&determinize(&nfa).result).result.state_count())
    }
}

/// Why an answer was not accepted.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "generated/"))]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Failure {
    /// The problem itself is malformed — its target does not parse.
    ///
    /// Reported rather than panicked on, because a spec arrives from a URL that anyone can
    /// edit, and a truncated link is a far more likely cause than a bad problem.
    BadProblem {
        /// What is wrong with it, in words a student can act on.
        detail: String,
    },
    /// The machine accepts the wrong language, and here is a string that proves it.
    WrongLanguage {
        /// The shortest string the two disagree on.
        input: String,
        /// True when the student's machine accepts it and the target does not.
        accepted_by_answer: bool,
    },
    /// Right language, too many states.
    OverBudget {
        /// States the answer used.
        used: usize,
        /// The most it was allowed.
        limit: usize,
    },
    /// Right language, wrong alphabet.
    WrongAlphabet {
        /// The alphabet the problem asked for.
        expected: Vec<String>,
        /// The alphabet the answer was built over.
        found: Vec<String>,
    },
}

/// The result of checking an answer.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "generated/"))]
pub struct Verdict {
    /// Whether the answer is accepted.
    pub solved: bool,
    /// Why not, when it is not.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub failure: Option<Failure>,
    /// States the answer used, for the budget indicator (task B2).
    pub states: usize,
    /// The fewest states any correct answer could use.
    ///
    /// Shown after a solve so "you used 6, it can be done in 4" is available without a second
    /// call — and so golf (task F2) has the number it is scoring against.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub minimum: Option<usize>,
}

/// Check a student's machine against a problem.
///
/// ## The order of the checks is the pedagogy
///
/// Language first, then alphabet, then budget — and it stops at the first failure. Reporting
/// "wrong language *and* three states over budget" is two problems presented at once, and a
/// student reading it has to guess which one to fix first. The answer is always the language.
///
/// Unlimited attempts and no score (task B4). This is practice; framing it as assessment
/// would be dishonest about what a client-side check can promise, and worse for learning.
pub fn check(spec: &ProblemSpec, answer: &Automaton) -> Verdict {
    let states = answer.state_count();

    let Ok(ast) = parse(&spec.target) else {
        return Verdict {
            solved: false,
            failure: Some(Failure::BadProblem {
                detail: format!(
                    "the problem's target expression `{}` does not parse",
                    spec.target
                ),
            }),
            states,
            minimum: None,
        };
    };

    let target = determinize(&crate::regex::thompson(&ast).result).result;
    let minimum = Some(minimize(&target).result.state_count());

    if let Some(found) = counterexample(answer, &target) {
        let Counterexample { input, accepted_by } = found;
        return Verdict {
            solved: false,
            failure: Some(Failure::WrongLanguage {
                input,
                accepted_by_answer: accepted_by == Side::Left,
            }),
            states,
            minimum,
        };
    }

    if let Some(expected) = &spec.alphabet {
        let found: Vec<String> = answer.alphabet.clone();
        if &found != expected {
            return Verdict {
                solved: false,
                failure: Some(Failure::WrongAlphabet {
                    expected: expected.clone(),
                    found,
                }),
                states,
                minimum,
            };
        }
    }

    if let Some(limit) = spec.budget {
        if states > limit {
            return Verdict {
                solved: false,
                failure: Some(Failure::OverBudget {
                    used: states,
                    limit,
                }),
                states,
                minimum,
            };
        }
    }

    Verdict {
        solved: true,
        failure: None,
        states,
        minimum,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::builder::AutomatonBuilder;

    /// Strings over {a, b} with an even number of a's. Two states, and minimal.
    fn even_as() -> Automaton {
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

    fn spec() -> ProblemSpec {
        ProblemSpec::new("An even number of a's.", "(b + ab*a)*")
    }

    #[test]
    fn a_correct_answer_is_accepted() {
        let verdict = check(&spec(), &even_as());
        assert!(verdict.solved, "{verdict:?}");
        assert!(verdict.failure.is_none());
    }

    #[test]
    fn any_correct_machine_passes_not_one_particular_shape() {
        // The reason the target is a language rather than a reference automaton. A student
        // who adds an unreachable state has still described the right language.
        let padded = AutomatonBuilder::new(["a", "b"])
            .accepting("even")
            .state("odd")
            .state("unused")
            .start("even")
            .edge("even", "odd", "a")
            .edge("odd", "even", "a")
            .edge("even", "even", "b")
            .edge("odd", "odd", "b")
            .build();

        assert!(check(&spec(), &padded).solved);
    }

    #[test]
    fn a_wrong_answer_names_the_string_that_proves_it() {
        // The pedagogical thesis of the whole project, applied to one button: never a bare
        // "incorrect".
        let odd_as = AutomatonBuilder::new(["a", "b"])
            .state("even")
            .accepting("odd")
            .start("even")
            .edge("even", "odd", "a")
            .edge("odd", "even", "a")
            .edge("even", "even", "b")
            .edge("odd", "odd", "b")
            .build();

        let verdict = check(&spec(), &odd_as);
        assert!(!verdict.solved);
        match verdict.failure {
            Some(Failure::WrongLanguage { input, .. }) => {
                // The shortest disagreement, which is the one a student can check by hand.
                assert!(
                    input.chars().count() <= 1,
                    "expected a short witness, got {input:?}"
                );
            }
            other => panic!("expected a wrong-language failure, got {other:?}"),
        }
    }

    #[test]
    fn the_direction_of_the_disagreement_is_reported() {
        // "Your machine accepts `a` and it should not" and "your machine rejects `a` and it
        // should not" are different mistakes, and a student cannot tell which from a string
        // alone.
        let everything = AutomatonBuilder::new(["a", "b"])
            .accepting("q")
            .start("q")
            .edge("q", "q", "a")
            .edge("q", "q", "b")
            .build();

        match check(&spec(), &everything).failure {
            Some(Failure::WrongLanguage {
                accepted_by_answer, ..
            }) => {
                assert!(
                    accepted_by_answer,
                    "the answer over-accepts, so it is the acceptor"
                );
            }
            other => panic!("expected a wrong-language failure, got {other:?}"),
        }
    }

    #[test]
    fn the_language_is_checked_before_the_budget() {
        // Two failures reported at once is one failure explained. A student told "wrong, and
        // also too big" has to guess which to fix, and the answer is always the language.
        let wrong_and_large = AutomatonBuilder::new(["a", "b"])
            .accepting("q0")
            .state("q1")
            .state("q2")
            .state("q3")
            .start("q0")
            .edge("q0", "q1", "a")
            .edge("q1", "q2", "a")
            .edge("q2", "q3", "a")
            .build();

        let verdict = check(&spec().with_budget(2), &wrong_and_large);
        assert!(matches!(
            verdict.failure,
            Some(Failure::WrongLanguage { .. })
        ));
    }

    #[test]
    fn a_right_answer_over_budget_is_told_only_that() {
        let padded = AutomatonBuilder::new(["a", "b"])
            .accepting("even")
            .state("odd")
            .state("spare")
            .start("even")
            .edge("even", "odd", "a")
            .edge("odd", "even", "a")
            .edge("even", "even", "b")
            .edge("odd", "odd", "b")
            .build();

        let verdict = check(&spec().with_budget(2), &padded);
        assert_eq!(
            verdict.failure,
            Some(Failure::OverBudget { used: 3, limit: 2 })
        );
    }

    #[test]
    fn the_minimum_is_reported_so_golf_has_a_target() {
        let verdict = check(&spec(), &even_as());
        assert_eq!(verdict.minimum, Some(2));
        assert_eq!(verdict.states, 2);
    }

    #[test]
    fn a_budget_can_be_checked_against_the_language_before_anyone_is_given_it() {
        // Task F1: a challenge that cannot be solved is not hard, it is broken.
        assert_eq!(spec().minimum_states(), Some(2));
        assert!(spec().with_budget(1).minimum_states().unwrap() > 1);
    }

    #[test]
    fn a_broken_problem_says_so_rather_than_failing_the_student() {
        // A spec arrives from a URL anyone can edit, and a truncated link is far more likely
        // than a bad problem. Either way this is not the student's mistake to be told about.
        let broken = ProblemSpec::new("Nonsense.", "a+");
        let verdict = check(&broken, &even_as());
        assert!(matches!(verdict.failure, Some(Failure::BadProblem { .. })));
    }

    #[test]
    fn a_wrong_alphabet_is_its_own_failure() {
        let over_abc = AutomatonBuilder::new(["a", "b", "c"])
            .accepting("even")
            .state("odd")
            .start("even")
            .edge("even", "odd", "a")
            .edge("odd", "even", "a")
            .edge("even", "even", "b")
            .edge("odd", "odd", "b")
            .build();

        let spec = spec().with_alphabet(vec!["a".into(), "b".into()]);
        assert!(matches!(
            check(&spec, &over_abc).failure,
            Some(Failure::WrongAlphabet { .. })
        ));
    }

    #[test]
    fn the_version_is_frozen() {
        // A link handed out in September must still open in November (task A4).
        assert_eq!(ProblemSpec::new("p", "a").version, 1);
    }
}
