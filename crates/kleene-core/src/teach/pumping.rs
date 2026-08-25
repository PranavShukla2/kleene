//! The pumping lemma, played as the game it already is (teaching layer Track E).
//!
//! The lemma is taught as a proof technique and learned, by most people, as a formula to
//! recite. The roadmap's claim is that this is the single most valuable thing in the teaching
//! layer even if nothing else gets built, and the reason is specific: the lemma is a statement
//! with alternating quantifiers, and alternating quantifiers *are* a game.
//!
//! > For every n, there exists w with |w| ≥ n, such that for every split w = xyz with
//! > |xy| ≤ n and |y| ≥ 1, there exists i with xyⁱz ∉ L.
//!
//! Each quantifier is a move, and whose move it is follows from which quantifier it is:
//!
//! | Quantifier | Whose move | What is chosen |
//! |---|---|---|
//! | for every n | the machine | the pumping length |
//! | there exists w | **the student** | a word in the language |
//! | for every split | the machine | where to cut it |
//! | there exists i | **the student** | how many times to pump |
//!
//! A student who wins has produced a proof. Not a proof-shaped answer — the actual object,
//! move by move. That is why E5 can replay a finished game as a proof sketch: there is nothing
//! to translate.
//!
//! ## The machine has to play well (task E2, decision D19)
//!
//! If the machine splits carelessly, a student defeats it without understanding anything and
//! concludes the lemma is easy. If it always plays perfectly, a first attempt is hopeless and
//! they conclude the opposite.
//!
//! The judgement taken here: **the machine plays the best move available, always, and the
//! difficulty is carried by the language instead.** Optimal play against `aⁿbⁿ` is still
//! losable by the machine, because the language really is non-regular and a good `w` really
//! does defeat every split — so a student who chooses well wins against a perfect opponent,
//! which is worth more than winning against a careless one. The library then ranges from
//! languages where a first `w` works to ones where it does not.
//!
//! The other half of D19 is that **some of the languages are regular**, and against those the
//! student cannot win. Losing is the lesson: the lemma proves non-regularity and cannot prove
//! regularity, and the fastest way to learn that is to try.

use serde::{Deserialize, Serialize};

/// A language to play against.
///
/// A predicate rather than an automaton, because half of these are not regular and therefore
/// have no automaton — which is the entire point of the exercise.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "generated/"))]
#[serde(rename_all = "kebab-case")]
pub enum Language {
    /// `aⁿbⁿ` — the canonical non-regular language.
    AnBn,
    /// Equal numbers of a's and b's, in any order.
    EqualCounts,
    /// Palindromes over {a, b}.
    Palindromes,
    /// `aⁿbⁿcⁿ`, which is not even context-free.
    AnBnCn,
    /// `a^(k²)` — strings of a's whose length is a perfect square.
    Squares,
    /// **Regular.** An even number of a's. The student cannot win, and that is the lesson.
    EvenAs,
    /// **Regular.** Strings over {a, b} ending in `ab`.
    EndsAb,
}

impl Language {
    /// Whether a string is in the language.
    pub fn contains(self, word: &str) -> bool {
        let a = word.chars().filter(|&c| c == 'a').count();
        let b = word.chars().filter(|&c| c == 'b').count();
        let c = word.chars().filter(|&c| c == 'c').count();

        match self {
            Self::AnBn => {
                word.chars().all(|ch| ch == 'a' || ch == 'b')
                    && word == format!("{}{}", "a".repeat(a), "b".repeat(b))
                    && a == b
            }
            Self::EqualCounts => word.chars().all(|ch| ch == 'a' || ch == 'b') && a == b,
            Self::Palindromes => {
                word.chars().all(|ch| ch == 'a' || ch == 'b') && word.chars().eq(word.chars().rev())
            }
            Self::AnBnCn => {
                word == format!("{}{}{}", "a".repeat(a), "b".repeat(b), "c".repeat(c))
                    && a == b
                    && b == c
            }
            Self::Squares => {
                let n = word.chars().count();
                word.chars().all(|ch| ch == 'a') && {
                    let root = (n as f64).sqrt().round() as usize;
                    root * root == n
                }
            }
            Self::EvenAs => word.chars().all(|ch| ch == 'a' || ch == 'b') && a % 2 == 0,
            Self::EndsAb => word.chars().all(|ch| ch == 'a' || ch == 'b') && word.ends_with("ab"),
        }
    }

    /// Whether the language is regular — which is whether the student can possibly win.
    pub fn is_regular(self) -> bool {
        matches!(self, Self::EvenAs | Self::EndsAb)
    }

    /// How it is written in a problem statement.
    pub fn notation(self) -> &'static str {
        match self {
            Self::AnBn => "{ aⁿbⁿ : n ≥ 0 }",
            Self::EqualCounts => "{ w ∈ {a,b}* : w has equally many a's and b's }",
            Self::Palindromes => "{ w ∈ {a,b}* : w is a palindrome }",
            Self::AnBnCn => "{ aⁿbⁿcⁿ : n ≥ 0 }",
            Self::Squares => "{ aᵏ² : k ≥ 0 }",
            Self::EvenAs => "{ w ∈ {a,b}* : w has an even number of a's }",
            Self::EndsAb => "{ w ∈ {a,b}* : w ends in ab }",
        }
    }

    /// Every language, in the order they are worth playing.
    pub fn all() -> Vec<Language> {
        vec![
            Self::AnBn,
            Self::EvenAs,
            Self::EqualCounts,
            Self::Palindromes,
            Self::EndsAb,
            Self::Squares,
            Self::AnBnCn,
        ]
    }
}

/// One way of cutting a word into `xyz`.
///
/// Named `Cut` rather than `Split` because `convert::minimize::Split` exists, and two types
/// with one name export to one TypeScript file where the second silently loses. This is the
/// fourth such collision in the project; `scripts/generate-types.sh` now refuses them.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "generated/"))]
pub struct Cut {
    /// Everything before the pumped part.
    pub x: String,
    /// The part that gets repeated. Never empty — the lemma requires |y| ≥ 1.
    pub y: String,
    /// Everything after it.
    pub z: String,
}

impl Cut {
    /// `xyⁱz`.
    pub fn pumped(&self, i: usize) -> String {
        format!("{}{}{}", self.x, self.y.repeat(i), self.z)
    }
}

/// Every split the lemma permits, for a word and a pumping length.
///
/// The constraints are the lemma's own: `|xy| ≤ n` and `|y| ≥ 1`. A student arguing about a
/// split that breaks either has misread the lemma, and the game never offers one.
pub fn legal_cuts(word: &str, n: usize) -> Vec<Cut> {
    let chars: Vec<char> = word.chars().collect();
    let mut splits = Vec::new();

    for start in 0..chars.len().min(n) {
        for end in (start + 1)..=chars.len().min(n) {
            splits.push(Cut {
                x: chars[..start].iter().collect(),
                y: chars[start..end].iter().collect(),
                z: chars[end..].iter().collect(),
            });
        }
    }
    splits
}

/// How many `i` a student would have to try before a split is defeated.
///
/// `None` when no `i` up to the search bound defeats it — which, for a regular language, is
/// every split, and is exactly why the student loses.
fn defeat(language: Language, split: &Cut, bound: usize) -> Option<usize> {
    (0..=bound).find(|&i| !language.contains(&split.pumped(i)))
}

/// The machine's choice of split: the one hardest for the student to defeat.
///
/// "Hardest" is the smallest `i` that works, maximised — a split defeated only by `i = 4` is
/// harder to find than one defeated by `i = 0`, and a split that cannot be defeated at all is
/// hardest of all. Among equals it prefers a longer `y`, which tends to be the one a student
/// finds least obvious.
///
/// This is E2 and D19: the machine plays its best move every time, and the difficulty lives in
/// the language rather than in an artificial handicap.
pub fn best_cut(language: Language, word: &str, n: usize) -> Option<Cut> {
    const BOUND: usize = 6;

    legal_cuts(word, n).into_iter().max_by_key(|split| {
        let hardness = defeat(language, split, BOUND).map_or(usize::MAX, |i| i);
        (hardness, split.y.chars().count())
    })
}

/// Why a move was not allowed.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "generated/"))]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Illegal {
    /// The word is shorter than the pumping length the machine chose.
    TooShort {
        /// How long the chosen word is.
        given: usize,
        /// How long it had to be.
        needed: usize,
    },
    /// The word is not in the language, so pumping it proves nothing.
    NotInLanguage,
    /// The word uses symbols the language's alphabet does not have.
    WrongAlphabet,
}

/// Check a student's choice of `w` before the game proceeds.
///
/// Rejected early and by name, because both mistakes are the ones people actually make and
/// both are instructive. Choosing a `w` that is not in `L` is the commonest error in the
/// exercise, and letting the game continue would teach that it does not matter.
pub fn check_word(language: Language, word: &str, n: usize) -> Option<Illegal> {
    let alphabet: &[char] = match language {
        Language::AnBnCn => &['a', 'b', 'c'],
        _ => &['a', 'b'],
    };

    if !word.chars().all(|ch| alphabet.contains(&ch)) {
        return Some(Illegal::WrongAlphabet);
    }
    if word.chars().count() < n {
        return Some(Illegal::TooShort {
            given: word.chars().count(),
            needed: n,
        });
    }
    if !language.contains(word) {
        return Some(Illegal::NotInLanguage);
    }
    None
}

/// How a completed round ended.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "generated/"))]
pub struct Round {
    /// The pumping length the machine claimed.
    pub n: usize,
    /// The word the student chose.
    pub word: String,
    /// How the machine cut it.
    pub split: Cut,
    /// The exponent the student chose.
    pub i: usize,
    /// `xyⁱz`.
    pub pumped: String,
    /// Whether the pumped string left the language — which is the student winning.
    pub won: bool,
    /// An `i` that would have worked, when the student's did not and one exists.
    ///
    /// Only ever shown *after* a round, and only for a language that can be beaten. Handing it
    /// over during play would be answering the exercise.
    pub hint: Option<usize>,
}

/// Play out a round once the student has chosen `i`.
pub fn settle(language: Language, n: usize, word: &str, split: &Cut, i: usize) -> Round {
    const BOUND: usize = 6;

    let pumped = split.pumped(i);
    let won = !language.contains(&pumped);

    Round {
        n,
        word: word.to_string(),
        split: split.clone(),
        i,
        pumped,
        won,
        hint: if won {
            None
        } else {
            defeat(language, split, BOUND)
        },
    }
}

/// The round written out as the proof it is (task E5).
///
/// Not a summary of what happened — the same moves, read as the quantifiers they were. A
/// student who wins has produced this object by playing; all this does is print it.
pub fn as_proof(language: Language, round: &Round) -> String {
    let l = language.notation();

    if !round.won {
        return format!(
            "Suppose L = {l} is regular. Let n = {n}.\n\
             You chose w = {w}, which is in L and has |w| ≥ n.\n\
             The adversary split it as x = {x}, y = {y}, z = {z} — legal, since |xy| ≤ n and |y| ≥ 1.\n\
             You pumped with i = {i}, giving {pumped}, which is still in L.\n\
             So this split survived, and the proof does not close here.{extra}",
            n = round.n,
            w = show(&round.word),
            x = show(&round.split.x),
            y = show(&round.split.y),
            z = show(&round.split.z),
            i = round.i,
            pumped = show(&round.pumped),
            extra = match round.hint {
                Some(i) => format!(" Try i = {i} against this split."),
                None => String::from(
                    " No exponent defeats this split, because this language is regular — \
                     the lemma cannot prove what is not true."
                ),
            }
        );
    }

    format!(
        "Suppose L = {l} is regular.\n\
         Then the pumping lemma gives a pumping length n; the adversary chose n = {n}.\n\
         Choose w = {w}. It is in L and |w| ≥ n, so the lemma applies.\n\
         The lemma says w = xyz with |xy| ≤ n and |y| ≥ 1; the adversary chose x = {x}, y = {y}, z = {z}.\n\
         Take i = {i}. Then xyⁱz = {pumped}, which is not in L.\n\
         This contradicts the lemma, so L is not regular. ∎",
        n = round.n,
        w = show(&round.word),
        x = show(&round.split.x),
        y = show(&round.split.y),
        z = show(&round.split.z),
        i = round.i,
        pumped = show(&round.pumped),
    )
}

/// A string, with the empty one visible.
fn show(word: &str) -> String {
    if word.is_empty() {
        "ε".to_string()
    } else {
        format!("`{word}`")
    }
}
