//! Property tests over the whole engine.
//!
//! These generate random regular expressions and assert invariants that must hold across
//! every representation. Hand-written tests check the cases you thought of; these check the
//! ones you did not, and the roadmap (§3.1) is right that they find real bugs.
//!
//! ## The generator matters more than the assertions
//!
//! A strategy that mostly emits single symbols passes every property here while testing
//! nothing — the machines are all two states and the interesting paths never execute. So the
//! generator is itself asserted (see `the_generator_produces_real_structure`), which is the
//! only way to know these tests are doing work.

use kleene_core::convert::{determinize, minimize, to_regex};
use kleene_core::counterexample::{counterexample, equivalent};
use kleene_core::regex::{Regex, parse, thompson::thompson};
use kleene_core::simulate::accepts;
use kleene_core::{Automaton, convert};

use proptest::prelude::*;

/// The alphabet random expressions are built over.
///
/// Three symbols, not twenty-six. A large alphabet spreads the probability of any two
/// expressions interacting so thin that subset construction never has to merge anything —
/// small alphabets produce the collisions that make the interesting code run.
const ALPHABET: [&str; 3] = ["a", "b", "c"];

/// Random regular expressions with real structure.
fn arb_regex() -> impl Strategy<Value = Regex> {
    let leaf = prop_oneof![
        // Symbols dominate deliberately: an expression that is mostly ∅ collapses to ∅
        // under simplification and tests nothing downstream.
        8 => (0..ALPHABET.len()).prop_map(|i| Regex::symbol(ALPHABET[i])),
        1 => Just(Regex::Epsilon),
        1 => Just(Regex::Empty),
    ];

    leaf.prop_recursive(
        4,  // nesting depth
        24, // total nodes, roughly
        3,  // children per level
        |inner| {
            prop_oneof![
                3 => (inner.clone(), inner.clone())
                    .prop_map(|(l, r)| Regex::concat(l, r)),
                3 => (inner.clone(), inner.clone())
                    .prop_map(|(l, r)| Regex::union(l, r)),
                2 => inner.prop_map(Regex::star),
            ]
        },
    )
}

/// Random strings over the same alphabet, including the empty string.
fn arb_string() -> impl Strategy<Value = String> {
    proptest::collection::vec(0..ALPHABET.len(), 0..8)
        .prop_map(|indices| indices.into_iter().map(|i| ALPHABET[i]).collect())
}

/// Build the ε-NFA, DFA and minimal DFA for an expression.
fn pipeline(regex: &Regex) -> (Automaton, Automaton, Automaton) {
    let nfa = thompson(regex).result;
    let dfa = determinize(&nfa).result;
    let minimal = minimize(&dfa).result;
    (nfa, dfa, minimal)
}

proptest! {
    // 256 by default so a normal `cargo test` stays fast. CI runs this file with
    // PROPTEST_CASES=10000, which is the figure the roadmap asks for.
    #![proptest_config(ProptestConfig {
        cases: 256,
        failure_persistence: Some(Box::new(
            proptest::test_runner::FileFailurePersistence::WithSource("regressions")
        )),
        ..ProptestConfig::default()
    })]

    /// Every representation of a language accepts exactly the same strings.
    ///
    /// The core invariant of the whole pipeline: converting a machine must never change
    /// what it accepts.
    #[test]
    fn all_representations_agree(regex in arb_regex(), input in arb_string()) {
        let (nfa, dfa, minimal) = pipeline(&regex);

        let expected = accepts(&nfa, &input);
        prop_assert_eq!(accepts(&dfa, &input), expected, "DFA disagreed on {:?}", input);
        prop_assert_eq!(accepts(&minimal, &input), expected, "minimal disagreed on {:?}", input);
    }

    /// Minimizing an already-minimal machine changes nothing.
    #[test]
    fn minimization_is_idempotent(regex in arb_regex()) {
        let (_, dfa, minimal) = pipeline(&regex);
        let twice = minimize(&minimal).result;

        prop_assert_eq!(twice.state_count(), minimal.state_count());
        prop_assert!(equivalent(&minimal, &twice));
        prop_assert!(equivalent(&dfa, &minimal), "minimization changed the language");
    }

    /// The minimal machine is never larger than the one it came from.
    #[test]
    fn minimization_never_grows_the_machine(regex in arb_regex()) {
        let (_, dfa, minimal) = pipeline(&regex);
        // Completion can add a trap state, so the bound is the completed machine's size.
        let completed = convert::complete(&dfa).result;
        prop_assert!(
            minimal.state_count() <= completed.state_count(),
            "{} states became {}",
            completed.state_count(),
            minimal.state_count()
        );
    }

    /// regex → DFA → regex → DFA describes the same language.
    ///
    /// The roadmap calls this the strong one, and it is: it exercises the parser, Thompson
    /// construction, subset construction, minimization, state elimination and
    /// simplification in a single assertion, and a fault in any of them shows up here.
    #[test]
    fn roundtrip_through_regex(regex in arb_regex()) {
        let (_, dfa, minimal) = pipeline(&regex);

        let expression = to_regex(&minimal).result;
        let reparsed = parse(&expression.to_string())
            .map_err(|e| TestCaseError::fail(format!("{expression} did not re-parse: {e}")))?;
        let (_, rebuilt, _) = pipeline(&reparsed);

        prop_assert!(
            equivalent(&dfa, &rebuilt),
            "{regex} became {expression}, which is a different language"
        );
    }

    /// Simplification preserves the language.
    #[test]
    fn simplification_preserves_the_language(regex in arb_regex()) {
        let reduced = kleene_core::regex::simplify(&regex);
        let (_, before, _) = pipeline(&regex);
        let (_, after, _) = pipeline(&reduced);

        prop_assert!(equivalent(&before, &after), "{regex} simplified to {reduced}");
        prop_assert!(reduced.size() <= regex.size(), "simplification grew {regex}");
    }

    /// A counterexample is always a genuine disagreement, and never withheld.
    ///
    /// Both directions matter and fail differently. A fabricated witness is a lie told to
    /// a student who is already confused; a withheld one turns "correct" into a claim the
    /// tool cannot back up.
    #[test]
    fn counterexample_is_always_a_real_witness(left in arb_regex(), right in arb_regex()) {
        let (_, a, _) = pipeline(&left);
        let (_, b, _) = pipeline(&right);

        match counterexample(&a, &b) {
            Some(found) => prop_assert_ne!(
                accepts(&a, &found.input),
                accepts(&b, &found.input),
                "{:?} does not separate {} and {}", found.input, left, right
            ),
            None => prop_assert!(
                equivalent(&a, &b),
                "no counterexample offered for languages that differ"
            ),
        }
    }

    /// A machine is always equivalent to itself, whatever it looks like.
    #[test]
    fn every_machine_equals_itself(regex in arb_regex()) {
        let (nfa, dfa, minimal) = pipeline(&regex);
        prop_assert!(equivalent(&nfa, &dfa), "determinization changed the language");
        prop_assert!(equivalent(&dfa, &minimal), "minimization changed the language");
        prop_assert!(equivalent(&nfa, &minimal));
    }

    /// Union, intersection and difference agree with membership.
    #[test]
    fn set_operations_match_their_definitions(
        left in arb_regex(),
        right in arb_regex(),
        input in arb_string(),
    ) {
        let (_, a, _) = pipeline(&left);
        let (_, b, _) = pipeline(&right);

        let (in_a, in_b) = (accepts(&a, &input), accepts(&b, &input));

        prop_assert_eq!(accepts(&kleene_core::union(&a, &b).result, &input), in_a || in_b);
        prop_assert_eq!(
            accepts(&kleene_core::intersection(&a, &b).result, &input),
            in_a && in_b
        );
        prop_assert_eq!(
            accepts(&kleene_core::difference(&a, &b).result, &input),
            in_a && !in_b
        );
    }

    /// Complement flips membership for every string **over the machine's alphabet**.
    ///
    /// The qualifier is the whole subtlety, and this property found it. Complement is
    /// relative to Σ*, and a machine built from a regex only knows the symbols that regex
    /// mentions — so for the expression `a`, the string `b` is in neither the language nor
    /// its complement, and asserting a flip there is simply wrong.
    ///
    /// Widening Σ first is what a user does when they declare an alphabet in the editor,
    /// and it makes the property meaningful rather than vacuous.
    #[test]
    fn complement_flips_membership(regex in arb_regex(), input in arb_string()) {
        let (_, mut dfa, _) = pipeline(&regex);
        dfa.alphabet = ALPHABET.iter().map(|s| (*s).to_string()).collect();

        let flipped = kleene_core::complement(&dfa).result;
        prop_assert_ne!(accepts(&flipped, &input), accepts(&dfa, &input));
    }

    /// A symbol outside the alphabet belongs to neither a language nor its complement.
    ///
    /// The other half of the finding above, asserted directly so the reasoning is not lost
    /// the next time someone reads the property and thinks it is missing a case.
    #[test]
    fn a_symbol_outside_the_alphabet_is_in_neither_language(regex in arb_regex()) {
        let (_, dfa, _) = pipeline(&regex);
        prop_assume!(!dfa.alphabet.iter().any(|s| s == "z"));

        let flipped = kleene_core::complement(&dfa).result;
        prop_assert!(!accepts(&dfa, "z"));
        prop_assert!(!accepts(&flipped, "z"));
    }

    /// Pruning removes states without changing the language.
    #[test]
    fn pruning_preserves_the_language(regex in arb_regex()) {
        let (_, dfa, _) = pipeline(&regex);
        let pruned = convert::prune(&dfa).result;

        prop_assert!(equivalent(&dfa, &pruned));
        prop_assert!(pruned.state_count() <= dfa.state_count());
    }

    /// Every distinguishing string produced by refinement really distinguishes its pair.
    #[test]
    fn refinement_witnesses_are_genuine(regex in arb_regex()) {
        let (_, dfa, _) = pipeline(&regex);
        let refinement = convert::refine(&dfa).result;

        for (&(p, q), mark) in &refinement.marks {
            // A pair separated at round k must be distinguished by a string of length k.
            prop_assert_eq!(
                mark.witness.chars().count(),
                mark.round,
                "round {} but witness {:?}", mark.round, mark.witness
            );

            let from_p = runs_to_accepting(&refinement.source, p, &mark.witness);
            let from_q = runs_to_accepting(&refinement.source, q, &mark.witness);
            prop_assert_ne!(from_p, from_q, "witness {:?} fails to separate", mark.witness);
        }
    }

    /// The marking table and the refinement never disagree.
    ///
    /// They are two presentations of one computation (decision D3). If they diverged, one
    /// of them would be lying to a student revising from their notes.
    #[test]
    fn marking_table_agrees_with_refinement(regex in arb_regex()) {
        let (_, dfa, _) = pipeline(&regex);
        let refinement = convert::refine(&dfa).result;
        let table = refinement.marking_table();

        for &p in &table.states {
            for &q in &table.states {
                if p != q {
                    prop_assert_eq!(
                        table.get(p, q).is_some(),
                        refinement.distinguishable(p, q),
                        "disagreed about ({}, {})", p, q
                    );
                }
            }
        }
    }

    /// A document survives being written and read back.
    #[test]
    fn documents_round_trip(regex in arb_regex()) {
        let (_, dfa, _) = pipeline(&regex);
        let document = kleene_core::io::Document::new(dfa);

        let reloaded = kleene_core::io::Document::from_json(&document.to_json())
            .map_err(|e| TestCaseError::fail(format!("{e}")))?;
        prop_assert_eq!(reloaded, document.clone());

        let compact = kleene_core::io::Document::from_json(&document.to_json_compact())
            .map_err(|e| TestCaseError::fail(format!("{e}")))?;
        prop_assert_eq!(compact, document);
    }

    /// Simulation never disagrees with itself about the same machine and string.
    #[test]
    fn simulation_is_deterministic(regex in arb_regex(), input in arb_string()) {
        let (nfa, _, _) = pipeline(&regex);
        prop_assert_eq!(accepts(&nfa, &input), accepts(&nfa, &input));
    }
}

/// Run `input` from `from`, reporting whether it lands on an accepting state.
fn runs_to_accepting(dfa: &Automaton, from: u32, input: &str) -> bool {
    let mut at = from;
    for ch in input.chars() {
        match dfa.transitions_from(at, Some(&ch.to_string())).next() {
            Some(t) => at = t.to,
            None => return false,
        }
    }
    dfa.state(at).is_some_and(|s| s.accepting)
}

/// The generator has to produce expressions worth testing.
///
/// Without this, a strategy that quietly degenerated into single symbols would leave every
/// property above passing while exercising nothing — the machines would all be two states
/// and the interesting paths would never run. This is the test that keeps the suite honest.
#[test]
fn the_generator_produces_real_structure() {
    use proptest::strategy::ValueTree;
    use proptest::test_runner::TestRunner;

    let mut runner = TestRunner::deterministic();
    let mut deep = 0;
    let mut big = 0;
    let mut starred = 0;
    let mut unions = 0;
    const SAMPLES: usize = 1000;

    for _ in 0..SAMPLES {
        let tree = arb_regex().new_tree(&mut runner).expect("generates");
        let regex = tree.current();

        if regex.depth() >= 3 {
            deep += 1;
        }
        if regex.size() >= 6 {
            big += 1;
        }
        if contains_star(&regex) {
            starred += 1;
        }
        if contains_union(&regex) {
            unions += 1;
        }
    }

    assert!(
        deep > SAMPLES / 10,
        "only {deep}/{SAMPLES} expressions nested 3 deep"
    );
    assert!(
        big > SAMPLES / 10,
        "only {big}/{SAMPLES} expressions had 6+ nodes"
    );
    assert!(
        starred > SAMPLES / 10,
        "only {starred}/{SAMPLES} contained a star"
    );
    assert!(
        unions > SAMPLES / 10,
        "only {unions}/{SAMPLES} contained a union"
    );
}

fn contains_star(regex: &Regex) -> bool {
    match regex {
        Regex::Star(_) => true,
        Regex::Concat(l, r) | Regex::Union(l, r) => contains_star(l) || contains_star(r),
        _ => false,
    }
}

fn contains_union(regex: &Regex) -> bool {
    match regex {
        Regex::Union(..) => true,
        Regex::Star(inner) => contains_union(inner),
        Regex::Concat(l, r) => contains_union(l) || contains_union(r),
        _ => false,
    }
}
