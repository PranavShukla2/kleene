//! The ordered problem set (teaching layer Track C).
//!
//! Twenty problems in difficulty order, from a machine anyone can draw in a minute to one that
//! is genuinely hard to see. In the core rather than as static JSON in the web app, for the
//! same reason the example catalogue is: the CLI, the site and the test suite then read one
//! list, and a problem whose target does not parse fails `cargo test` rather than greeting a
//! student.
//!
//! ## The order is the teaching, and it is not sorted by state count
//!
//! Difficulty here means *how hard the insight is*, not how large the answer is. "Binary
//! numbers divisible by three" has three states and is one of the hardest problems in the set,
//! because the states have to be understood as remainders — nothing about drawing three circles
//! is the difficult part. Sorting by size would put it near the front and teach nobody
//! anything.
//!
//! ## What a tier means
//!
//! The same three the example gallery uses, and for continuity rather than novelty: someone who
//! has browsed the examples already knows what they mean.
//!
//! 🔴 **DECISION D14 stands.** These follow the shape of a standard course — Sipser chapter 1,
//! Hopcroft chapters 2–4 — rather than one department's actual syllabus. Pointing them at a
//! real one is a review, not a rebuild.

use crate::teach::ProblemSpec;

/// How hard a problem is to *see*.
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "generated/"))]
#[serde(rename_all = "kebab-case")]
pub enum Tier {
    /// Draw it directly from the description.
    Introductory,
    /// Needs a moment's thought about what the states have to remember.
    Standard,
    /// The states stand for something that is not obvious from the wording.
    Pathological,
}

/// One problem in the set.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "generated/"))]
pub struct SetProblem {
    /// Stable across releases, because progress is stored against it.
    ///
    /// Renaming one of these silently resets somebody's progress, so they are treated the same
    /// way the example keys are: chosen once, and left alone.
    pub key: String,
    /// How hard it is to see.
    pub tier: Tier,
    /// The spec a student actually solves.
    pub spec: ProblemSpec,
    /// What the problem is teaching, for the list view.
    pub about: String,
}

fn problem(
    key: &str,
    tier: Tier,
    prompt: &str,
    target: &str,
    about: &str,
    budget: Option<usize>,
) -> SetProblem {
    let mut spec = ProblemSpec::new(prompt, target);
    if let Some(limit) = budget {
        spec = spec.with_budget(limit);
    }
    SetProblem {
        key: key.to_string(),
        tier,
        spec,
        about: about.to_string(),
    }
}

/// The set, in the order it should be attempted.
pub fn problem_set() -> Vec<SetProblem> {
    use Tier::{Introductory, Pathological, Standard};

    vec![
        problem(
            "ends-with-ab",
            Introductory,
            "Strings over {a, b} that end in ab.",
            "(a + b)*ab",
            "A machine only has to remember how much of the pattern it has just seen.",
            None,
        ),
        problem(
            "starts-with-a",
            Introductory,
            "Strings over {a, b} that start with a.",
            "a(a + b)*",
            "The first symbol decides everything, so one state does all the work.",
            None,
        ),
        problem(
            "contains-aba",
            Introductory,
            "Strings over {a, b} containing aba somewhere.",
            "(a + b)*aba(a + b)*",
            "Once the pattern is found it cannot be un-found — that is a trap state doing something useful.",
            None,
        ),
        problem(
            "even-length",
            Introductory,
            "Strings over {a, b} of even length.",
            "((a + b)(a + b))*",
            "The alphabet is irrelevant here; only the count matters.",
            Some(2),
        ),
        problem(
            "even-as",
            Introductory,
            "Strings over {a, b} with an even number of a's.",
            "(b + ab*a)*",
            "Two states, one bit of memory: the parity of what has been read.",
            Some(2),
        ),
        problem(
            "no-ab",
            Standard,
            "Strings over {a, b} that never contain ab.",
            "b*a*",
            "Easier to describe as a shape than as a prohibition — every b comes before every a.",
            None,
        ),
        problem(
            "exactly-three",
            Standard,
            "Strings over {a, b} of length exactly three.",
            "(a + b)(a + b)(a + b)",
            "Counting to three needs four states, and then one more for everything longer.",
            None,
        ),
        problem(
            "at-most-two-as",
            Standard,
            "Strings over {a, b} with at most two a's.",
            "b*(a + ε)b*(a + ε)b*",
            "Counting up to a bound, then refusing. The state after the bound is the interesting one.",
            None,
        ),
        problem(
            "odd-as-even-bs",
            Standard,
            "Strings over {a, b} with an odd number of a's and an even number of b's.",
            // Derived from the four-state parity machine rather than written by hand. The
            // hand-written attempt described a two-state language, which the budget check
            // caught — see the note on `a_budget_that_is_stated_is_tight`.
            "(bb + ba(aa)*ab)*(a + ba(aa)*b)(b(aa)*b + (a + b(aa)*ab)(bb + ba(aa)*ab)*(a + ba(aa)*b))*",
            "Two independent bits of memory, which means four states — one per combination.",
            Some(4),
        ),
        problem(
            "third-from-start",
            Standard,
            "Strings over {a, b} whose third symbol is a.",
            "(a + b)(a + b)a(a + b)*",
            "Position from the *start* is easy; the same question about the end is not.",
            None,
        ),
        problem(
            "a-then-c",
            Standard,
            "Strings over {a, b, c} where every a is eventually followed by a c.",
            "(b + c + a(a + b)*c)*",
            "An obligation the machine has to carry until it is discharged.",
            None,
        ),
        problem(
            "even-as-and-bs",
            Standard,
            "Strings over {a, b} with an even number of a's and an even number of b's.",
            "(aa + bb + (ab + ba)(aa + bb)*(ab + ba))*",
            "The classic four-state parity square. Try to draw it before reading the expression.",
            Some(4),
        ),
        problem(
            "no-three-as",
            Standard,
            "Strings over {a, b} with no three consecutive a's.",
            "(b + ab + aab)*(ε + a + aa)",
            "The state counts how many a's in a row have just been seen, and resets on b.",
            Some(4),
        ),
        problem(
            "starts-and-ends-same",
            Standard,
            "Non-empty strings over {a, b} that start and end with the same symbol.",
            "a + b + a(a + b)*a + b(a + b)*b",
            "The machine must remember the first symbol for the whole string.",
            None,
        ),
        problem(
            "length-mod-three",
            Standard,
            "Strings over {a, b} whose length is a multiple of three.",
            "((a + b)(a + b)(a + b))*",
            "Counting modulo something is the idea the last few problems have been building to.",
            Some(3),
        ),
        problem(
            "fourth-from-end",
            Pathological,
            "Strings over {a, b} whose fourth symbol from the end is a.",
            "(a + b)*a(a + b)(a + b)(a + b)",
            "Trivial as an NFA and sixteen states as a DFA — the clearest case of what determinizing costs.",
            None,
        ),
        problem(
            "divisible-by-three",
            Pathological,
            "Binary strings that are numbers divisible by three, read most significant bit first.",
            "(0 + 1(01*0)*1)*",
            "Three states, and one of the hardest problems here: each state is a remainder.",
            Some(3),
        ),
        problem(
            "ones-mod-three",
            Pathological,
            "Binary strings in which the number of 1s is a multiple of three.",
            "(0 + 10*10*1)*",
            "Counting modulo three, but only on one of the two symbols — the 0s must be ignored without being forgotten.",
            Some(3),
        ),
        problem(
            "double-letter",
            Pathological,
            "Strings over {a, b} containing a doubled letter — aa or bb.",
            "(a + b)*(aa + bb)(a + b)*",
            "Two ways to succeed, and the machine has to track which one it is part-way through.",
            None,
        ),
        problem(
            "no-substring-aab",
            Pathological,
            "Strings over {a, b} that never contain aab.",
            "b*(ab*)*(ε + a)a*",
            "Prohibitions are harder than requirements: the machine must know how much of the forbidden pattern it has accumulated.",
            None,
        ),
    ]
}

/// One problem by key.
pub fn by_key(key: &str) -> Option<SetProblem> {
    problem_set().into_iter().find(|problem| problem.key == key)
}
