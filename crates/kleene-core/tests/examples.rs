//! Every example, exercised (Phase 5 Track C4).
//!
//! The corpus is a gallery *and* a fixture, and this is the half that makes it a fixture. A
//! broken example is caught here rather than by a student clicking a card — which is the point
//! of the examples being real machines rather than pictures of machines.
//!
//! These run over the whole catalogue rather than over named entries on purpose: an example
//! added later gets the same scrutiny without anyone remembering to add a test for it.

use kleene_core::convert::{determinize, elimination, minimize, to_regex::Order};
use kleene_core::counterexample::equivalent;
use kleene_core::examples::{Tier, by_key, catalogue};
use kleene_core::simulate::simulate;
use kleene_core::{parse, thompson};

#[test]
fn the_corpus_is_the_size_the_plan_asked_for() {
    // Roadmap §5 and task C1 say about twenty. Fewer is a thin gallery; many more and the
    // filters stop being enough to find anything.
    assert!(
        catalogue().len() >= 20,
        "only {} examples",
        catalogue().len()
    );
}

#[test]
fn every_key_is_unique_and_url_safe() {
    // Keys go in links, and a link is the distribution mechanism. A duplicate would make one
    // example unreachable; a space or a slash would make its link break on being pasted.
    let keys: Vec<&str> = catalogue().iter().map(|e| e.key).collect();

    let unique: std::collections::BTreeSet<&&str> = keys.iter().collect();
    assert_eq!(unique.len(), keys.len(), "a key appears twice");

    for key in keys {
        assert!(
            key.chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_'),
            "{key} is not safe in a URL"
        );
    }
}

#[test]
fn every_example_is_reachable_by_its_key() {
    for example in catalogue() {
        assert!(
            by_key(example.key).is_some(),
            "{} is unreachable",
            example.key
        );
    }
}

#[test]
fn an_unknown_key_is_not_a_panic() {
    // Keys arrive from URLs. A stale link in a lecture slide must not take the page down.
    assert!(by_key("no_such_example").is_none());
    assert!(by_key("").is_none());
}

#[test]
fn every_example_is_a_well_formed_machine() {
    for example in catalogue() {
        let report = (example.build)().validate();
        assert!(
            !report.has_errors(),
            "{}: {:?}",
            example.key,
            report.errors().map(|p| &p.message).collect::<Vec<_>>()
        );
    }
}

#[test]
fn every_example_survives_the_whole_pipeline() {
    // The real test of a fixture: not that it parsed, but that everything the app will do to
    // it works. A card that opens and then cannot be determinized is a broken card.
    for example in catalogue() {
        let machine = (example.build)();

        let dfa = determinize(&machine).result;
        assert!(
            !dfa.validate().has_errors(),
            "{}: determinized badly",
            example.key
        );

        let minimal = minimize(&dfa).result;
        assert!(
            equivalent(&dfa, &minimal),
            "{}: minimization changed the language",
            example.key
        );
    }
}

#[test]
fn every_example_converts_back_to_an_expression_describing_it() {
    // The round trip that proves the machine and the tool agree about what it means.
    for example in catalogue() {
        let machine = (example.build)();
        let dfa = determinize(&machine).result;

        let converted = elimination(&dfa, Order::default());
        if converted.refused.is_some() {
            // Past the size limit, which is a decision rather than a failure — but only the
            // deliberately pathological entries have any business being there.
            assert_eq!(
                example.tier,
                Tier::Pathological,
                "{} is too large to convert and is not marked pathological",
                example.key
            );
            continue;
        }

        let rebuilt =
            determinize(&thompson(&parse(&converted.regex).expect("parses")).result).result;
        assert!(
            equivalent(&dfa, &rebuilt),
            "{}: its own expression describes a different language",
            example.key
        );
    }
}

#[test]
fn every_example_accepts_something_or_says_why_not() {
    // A machine that accepts nothing is usually a mistake. Two entries are that on purpose,
    // and naming them here is what stops a third appearing by accident.
    let deliberately_empty = ["empty_language"];

    for example in catalogue() {
        let machine = (example.build)();
        let accepts_any = (0..=4)
            .flat_map(|len| strings_of(&machine.alphabet, len))
            .any(|w| simulate(&machine, &w).result.verdict.is_accepted());

        if deliberately_empty.contains(&example.key) {
            assert!(!accepts_any, "{} was meant to accept nothing", example.key);
        } else {
            assert!(
                accepts_any,
                "{} accepts no string up to length four — is that intended?",
                example.key
            );
        }
    }
}

#[test]
fn every_description_says_something_the_others_do_not() {
    // The filter that keeps a gallery worth scrolling. Two entries teaching the same lesson
    // are one entry and one distraction.
    let mut teaches: Vec<&str> = catalogue().iter().map(|e| e.teaches).collect();
    teaches.sort_unstable();
    let before = teaches.len();
    teaches.dedup();
    assert_eq!(
        teaches.len(),
        before,
        "two examples claim to teach the same thing"
    );

    for example in catalogue() {
        assert!(
            example.teaches.len() > 40,
            "{}: too terse to be useful",
            example.key
        );
        assert!(
            !example.language.is_empty(),
            "{}: no language given",
            example.key
        );
        assert!(
            !example.topics.is_empty(),
            "{}: no topics, so no filter finds it",
            example.key
        );
    }
}

#[test]
fn the_tiers_are_all_populated() {
    // Three tiers with nothing in one of them is two tiers and a lie on a filter chip.
    for tier in [Tier::Introductory, Tier::Standard, Tier::Pathological] {
        assert!(
            catalogue().iter().any(|e| e.tier == tier),
            "nothing is {}",
            tier.name()
        );
    }
}

/// Every string of exactly `len` symbols over `alphabet`.
fn strings_of(alphabet: &[String], len: usize) -> Vec<String> {
    if len == 0 {
        return vec![String::new()];
    }
    strings_of(alphabet, len - 1)
        .into_iter()
        .flat_map(|prefix| {
            alphabet
                .iter()
                .map(move |symbol| format!("{prefix}{symbol}"))
                .collect::<Vec<_>>()
        })
        .collect()
}
