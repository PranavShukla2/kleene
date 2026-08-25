//! The pumping lemma game, held to the plan's definition of done:
//!
//! > The game can be **lost** by a student who does not understand the lemma, and **won** by
//! > one who does. If it cannot be lost, it teaches nothing.
//!
//! Both halves are properties of the code, and both are testable — which is unusual for a
//! teaching claim and worth taking advantage of.

use kleene_core::teach::pumping::{
    Illegal, Language, as_proof, best_split, check_word, legal_splits, settle,
};

#[test]
fn a_good_choice_beats_a_perfect_opponent() {
    // The winnable half. For a non-regular language, a well-chosen w defeats *every* legal
    // split — so the student wins even though the machine always plays its best move.
    for language in [Language::AnBn, Language::AnBnCn, Language::Squares] {
        let n = 4;
        let word = match language {
            Language::AnBn => "aaaabbbb".to_string(),
            Language::AnBnCn => "aaaabbbbcccc".to_string(),
            Language::Squares => "a".repeat(16),
            _ => unreachable!(),
        };

        assert_eq!(check_word(language, &word, n), None, "{language:?}");

        let split = best_split(language, &word, n).expect("a split exists");
        // Some i must defeat even the machine's best split.
        let beaten = (0..=6).any(|i| settle(language, n, &word, &split, i).won);
        assert!(beaten, "{language:?}: the best split survived every i");
    }
}

#[test]
fn every_legal_split_of_a_good_word_can_be_defeated() {
    // Stronger than the above, and the property that makes the game fair: the student is not
    // relying on the machine choosing badly.
    let (language, n, word) = (Language::AnBn, 4, "aaaabbbb");

    for split in legal_splits(word, n) {
        let beaten = (0..=6).any(|i| settle(language, n, word, &split, i).won);
        assert!(beaten, "no i defeats {split:?}");
    }
}

#[test]
fn a_regular_language_cannot_be_beaten() {
    // The losable half, and the lesson: the lemma proves non-regularity and cannot prove
    // regularity. A student who tries this and fails has learned something a sentence in a
    // textbook does not teach.
    for language in [Language::EvenAs, Language::EndsAb] {
        let n = 3;
        let word = match language {
            Language::EvenAs => "aabb",
            Language::EndsAb => "abab",
            _ => unreachable!(),
        };
        assert_eq!(check_word(language, word, n), None);

        let split = best_split(language, word, n).expect("a split exists");
        for i in 0..=6 {
            assert!(
                !settle(language, n, word, &split, i).won,
                "{language:?}: i = {i} beat a regular language"
            );
        }
    }
}

#[test]
fn the_machine_prefers_the_split_that_is_hardest_to_beat() {
    // E2. A machine that splits carelessly lets a student win without understanding, and they
    // conclude the lemma is easy.
    let (language, n, word) = (Language::EvenAs, 3, "aabb");
    let best = best_split(language, word, n).expect("a split");

    // Against a regular language the best split is one that cannot be defeated at all.
    assert!((0..=6).all(|i| !settle(language, n, word, &best, i).won));
}

#[test]
fn every_offered_split_obeys_the_lemma() {
    // |xy| ≤ n and |y| ≥ 1. A student arguing about an illegal split has misread the lemma,
    // and the game must never be the reason they think one is allowed.
    let n = 3;
    for split in legal_splits("aaaabbbb", n) {
        assert!(!split.y.is_empty(), "y must be non-empty: {split:?}");
        assert!(
            split.x.chars().count() + split.y.chars().count() <= n,
            "|xy| must be at most n: {split:?}"
        );
        assert_eq!(format!("{}{}{}", split.x, split.y, split.z), "aaaabbbb");
    }
}

#[test]
fn a_word_outside_the_language_is_refused_by_name() {
    // The commonest mistake in the exercise. Letting the game continue would teach that it
    // does not matter, when it is the whole reason the argument works.
    assert_eq!(
        check_word(Language::AnBn, "aabbb", 4),
        Some(Illegal::NotInLanguage)
    );
}

#[test]
fn a_word_shorter_than_n_is_refused_with_both_numbers() {
    assert_eq!(
        check_word(Language::AnBn, "ab", 4),
        Some(Illegal::TooShort {
            given: 2,
            needed: 4
        })
    );
}

#[test]
fn a_word_over_the_wrong_alphabet_is_refused() {
    assert_eq!(
        check_word(Language::AnBn, "abc", 2),
        Some(Illegal::WrongAlphabet)
    );
}

#[test]
fn a_lost_round_offers_an_exponent_that_would_have_worked() {
    // Only after the round, and only when one exists — during play it would be answering the
    // exercise.
    let (language, n, word) = (Language::AnBn, 3, "aaabbb");
    let split = best_split(language, word, n).expect("a split");
    // i = 1 is xyz itself, which is always in the language, so this is a guaranteed loss.
    let round = settle(language, n, word, &split, 1);

    assert!(!round.won);
    assert!(round.hint.is_some(), "a beatable split should hint");
}

#[test]
fn a_regular_language_hints_nothing_because_there_is_nothing_to_hint() {
    let (language, n, word) = (Language::EvenAs, 2, "aabb");
    let split = best_split(language, word, n).expect("a split");
    let round = settle(language, n, word, &split, 1);
    assert_eq!(round.hint, None);
}

#[test]
fn a_won_round_reads_back_as_a_proof() {
    // E5. Not a summary of the game — the same moves, read as the quantifiers they were.
    let (language, n, word) = (Language::AnBn, 3, "aaabbb");
    let split = best_split(language, word, n).expect("a split");
    let i = (0..=6)
        .find(|&i| settle(language, n, word, &split, i).won)
        .expect("a winning i");

    let proof = as_proof(language, &settle(language, n, word, &split, i));
    assert!(proof.contains("Suppose"), "{proof}");
    assert!(proof.contains("contradicts the lemma"), "{proof}");
    assert!(proof.contains("∎"), "{proof}");
}

#[test]
fn a_lost_round_says_the_proof_does_not_close() {
    // Rather than claiming a proof that was not produced.
    let (language, n, word) = (Language::EvenAs, 2, "aabb");
    let split = best_split(language, word, n).expect("a split");
    let proof = as_proof(language, &settle(language, n, word, &split, 1));

    assert!(proof.contains("does not close"), "{proof}");
    assert!(
        !proof.contains('∎'),
        "a lost round must not print a proof mark"
    );
}

#[test]
fn the_library_has_both_kinds_of_language() {
    // If every language were non-regular, the game would teach that the lemma always works.
    let all = Language::all();
    assert!(all.iter().any(|l| l.is_regular()));
    assert!(all.iter().any(|l| !l.is_regular()));
}

#[test]
fn membership_agrees_with_the_notation_on_small_cases() {
    assert!(Language::AnBn.contains(""));
    assert!(Language::AnBn.contains("aabb"));
    assert!(!Language::AnBn.contains("abab"));
    assert!(!Language::AnBn.contains("aab"));

    assert!(Language::Palindromes.contains("aba"));
    assert!(!Language::Palindromes.contains("aab"));

    assert!(Language::Squares.contains("aaaa"));
    assert!(!Language::Squares.contains("aaa"));
    assert!(Language::Squares.contains(""));

    assert!(Language::EqualCounts.contains("abba"));
    assert!(!Language::EqualCounts.contains("aab"));
}
