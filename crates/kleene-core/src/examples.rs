//! The example corpus (Phase 5 Track C).
//!
//! Twenty machines a student actually meets in a first formal-languages course. Not fixtures
//! invented to be convenient — a bug that shows up here is a bug that would show up in front
//! of a user, which is why the same list is both the gallery and a CI fixture (task C4).
//!
//! ## What earns a place
//!
//! Each one has to teach something the others do not. That is a stronger filter than it
//! sounds: "strings ending in `ab`" and "strings ending in `ba`" are the same lesson twice,
//! and a gallery of near-duplicates is a gallery nobody scrolls. So the list is organised by
//! the *thing that goes wrong* — parity, memory of a suffix, subset blow-up, a trap state,
//! states that look different and are not.
//!
//! ## Why the descriptions live here and not beside the gallery
//!
//! Because they are checked. `catalogue()` is walked by tests that run every machine through
//! validation, determinism and the conversion pipeline, and the description is what a failure
//! names. A description in the frontend would be a caption; here it is part of the fixture.

use crate::automaton::Automaton;
use crate::builder::AutomatonBuilder;

/// How much a reader should already know.
///
/// Three levels, and deliberately few (task C6). Five would be a judgement nobody can make
/// consistently, and a reader cannot tell the difference between "intermediate" and
/// "moderate" anyway.
// Serialised because the teaching layer's problem set carries a tier across the wasm boundary
// and into TypeScript. The gallery reaches these through the catalogue rather than through
// serde, so this costs it nothing.
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "generated/"))]
#[serde(rename_all = "kebab-case")]
pub enum Tier {
    /// Readable in the first week. The state *is* the thing being remembered.
    Introductory,
    /// The ordinary business of the course.
    Standard,
    /// Chosen because it goes wrong — blow-up, a trap, a machine that is not minimal.
    Pathological,
}

impl Tier {
    /// The name used in a URL and on a filter chip.
    pub fn name(self) -> &'static str {
        match self {
            Self::Introductory => "introductory",
            Self::Standard => "standard",
            Self::Pathological => "pathological",
        }
    }
}

/// What an example demonstrates, for someone looking for the thing they are stuck on.
///
/// The filter axis (task C7). Someone arrives looking for ε-transitions or for why their DFA
/// grew a trap state — not for a difficulty. A tier says whether you *can* read an example;
/// a topic says whether you *want* to.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Topic {
    /// The state is a running count or flag.
    Invariants,
    /// A state that loops to itself.
    SelfLoops,
    /// More than one move on a symbol.
    Nondeterminism,
    /// Moves that read nothing.
    Epsilon,
    /// A state nothing escapes.
    TrapStates,
    /// States that cannot be told apart.
    Minimization,
    /// A DFA exponentially larger than the NFA it came from.
    SubsetBlowUp,
    /// Machines about numbers written in a base.
    Arithmetic,
}

impl Topic {
    /// The name used in a URL and on a filter chip.
    pub fn name(self) -> &'static str {
        match self {
            Self::Invariants => "invariants",
            Self::SelfLoops => "self-loops",
            Self::Nondeterminism => "nondeterminism",
            Self::Epsilon => "epsilon",
            Self::TrapStates => "trap-states",
            Self::Minimization => "minimization",
            Self::SubsetBlowUp => "subset-blow-up",
            Self::Arithmetic => "arithmetic",
        }
    }
}

/// One entry of the corpus.
pub struct Example {
    /// The key a URL and `example_automaton` use. Stable — links depend on it.
    pub key: &'static str,
    /// What it is called.
    pub title: &'static str,
    /// The language, in the notation a course writes on a board.
    pub language: &'static str,
    /// What someone learns by opening it. One sentence, and it has to say something the
    /// other nineteen do not.
    pub teaches: &'static str,
    /// How much a reader should already know.
    pub tier: Tier,
    /// What it demonstrates. At least one, or no filter finds it.
    pub topics: &'static [Topic],
    /// Built on demand, because a corpus of twenty machines has no business being constructed
    /// to answer "what examples are there".
    pub build: fn() -> Automaton,
}

/// Strings over `{a, b}` containing an even number of `a`s.
///
/// Two states, because two states is genuinely minimal here — the parity of the `a` count is
/// the entire state. The end-to-end target for the editor (Phase 2).
pub fn even_number_of_as() -> Automaton {
    AutomatonBuilder::new(["a", "b"])
        .accepting("q0") // even so far, including zero
        .state("q1") // odd so far
        .edge("q0", "q1", "a")
        .edge("q1", "q0", "a")
        .edge("q0", "q0", "b")
        .edge("q1", "q1", "b")
        .build()
}

/// Strings over `{a, b}` ending in `ab`.
///
/// The first machine Kleene ever renders. Chosen over something simpler because its geometry
/// exercises exactly the cases that make generated diagrams look broken: two self-loops and a
/// bidirectional pair. A renderer that handles this handles most of what it will meet.
pub fn ends_with_ab() -> Automaton {
    AutomatonBuilder::new(["a", "b"])
        .state("q0") // no useful suffix
        .state("q1") // last symbol was `a`
        .accepting("q2") // last two were `ab`
        .edge("q0", "q1", "a")
        .edge("q0", "q0", "b")
        .edge("q1", "q1", "a")
        .edge("q1", "q2", "b")
        .edge("q2", "q1", "a")
        .edge("q2", "q0", "b")
        .build()
}

/// Strings over `{a, b}` starting with `a`.
///
/// The smallest machine with a real trap state: once the first symbol is `b`, nothing can
/// help. Students draw this without the trap and then cannot explain why their DFA is
/// incomplete.
pub fn starts_with_a() -> Automaton {
    AutomatonBuilder::new(["a", "b"])
        .state("start")
        .accepting("seen")
        .state("dead")
        .edge("start", "seen", "a")
        .edge("start", "dead", "b")
        .edge("seen", "seen", "a")
        .edge("seen", "seen", "b")
        .edge("dead", "dead", "a")
        .edge("dead", "dead", "b")
        .build()
}

/// Strings over `{a, b}` containing `aba` anywhere.
///
/// The pattern-search machine, and the first place a student meets the idea that a state is
/// "how much of the pattern I have matched". Note that failing back is not always to the
/// start — after `ab` then `b`, you are not at zero.
pub fn contains_aba() -> Automaton {
    AutomatonBuilder::new(["a", "b"])
        .state("none")
        .state("a")
        .state("ab")
        .accepting("aba")
        .edge("none", "a", "a")
        .edge("none", "none", "b")
        .edge("a", "a", "a")
        .edge("a", "ab", "b")
        .edge("ab", "aba", "a")
        .edge("ab", "none", "b")
        .edge("aba", "aba", "a")
        .edge("aba", "aba", "b")
        .build()
}

/// Strings over `{a, b}` of even length.
///
/// The counterpart to parity-of-`a`s: the state counts *everything*, so both symbols move it.
/// Side by side, the two make clear that a state is whatever you decided to remember.
pub fn even_length() -> Automaton {
    AutomatonBuilder::new(["a", "b"])
        .accepting("even")
        .state("odd")
        .edges("even", "odd", ["a", "b"])
        .edges("odd", "even", ["a", "b"])
        .build()
}

/// Binary strings that are multiples of three, read most significant bit first.
///
/// The state is the remainder — three states for three remainders — and reading a bit is
/// `r → (2r + b) mod 3`. The first example where the state is genuinely a *computation*
/// rather than a memory of recent input.
pub fn divisible_by_three() -> Automaton {
    AutomatonBuilder::new(["0", "1"])
        .accepting("r0")
        .state("r1")
        .state("r2")
        .edge("r0", "r0", "0") // 0 → 0
        .edge("r0", "r1", "1") // 1 → 1
        .edge("r1", "r2", "0") // 2 → 2
        .edge("r1", "r0", "1") // 3 → 0
        .edge("r2", "r1", "0") // 4 → 1
        .edge("r2", "r2", "1") // 5 → 2
        .build()
}

/// Binary strings ending in `00`, as an NFA that guesses when the ending starts.
///
/// The cleanest illustration of what nondeterminism buys: three states here, and the DFA is
/// the same size — so this is nondeterminism as *convenience* rather than as compression.
pub fn ends_with_00_nfa() -> Automaton {
    AutomatonBuilder::new(["0", "1"])
        .state("guess")
        .state("one")
        .accepting("two")
        .edge("guess", "guess", "0")
        .edge("guess", "guess", "1")
        .edge("guess", "one", "0") // guess that the ending starts here
        .edge("one", "two", "0")
        .build()
}

/// `(a|b)*abb`, as the ε-NFA Thompson's construction produces.
///
/// The canonical worked example of the entire subject. Fourteen states for a language a
/// four-state DFA accepts, which is the whole argument for the two conversions that follow.
pub fn thompson_abb() -> Automaton {
    crate::regex::thompson::thompson(&crate::parse("(a+b)*abb").expect("a fixed expression")).result
}

/// An NFA whose subset construction is exponential: the *n*th symbol from the end is `a`.
///
/// Five states, and a DFA of thirty-two. This is the machine that makes the 2ⁿ bound stop
/// being a footnote — it has to remember the last four symbols, and there are sixteen of
/// those plus where it started.
pub fn nth_from_end() -> Automaton {
    AutomatonBuilder::new(["a", "b"])
        .state("s")
        .state("1")
        .state("2")
        .state("3")
        .accepting("4")
        .edge("s", "s", "a")
        .edge("s", "s", "b")
        .edge("s", "1", "a") // guess: this `a` is the fourth from the end
        .edges("1", "2", ["a", "b"])
        .edges("2", "3", ["a", "b"])
        .edges("3", "4", ["a", "b"])
        .build()
}

/// A machine with two states nothing can tell apart.
///
/// Built to be non-minimal on purpose: `b1` and `b2` accept exactly the same strings, so
/// minimization merges them. The point is that they *look* different — different names,
/// different incoming edges — and behaviour is what counts.
pub fn redundant_states() -> Automaton {
    AutomatonBuilder::new(["a", "b"])
        .state("start")
        .state("b1")
        .state("b2")
        .accepting("done")
        .edge("start", "b1", "a")
        .edge("start", "b2", "b")
        .edge("b1", "done", "a")
        .edge("b1", "done", "b")
        .edge("b2", "done", "a")
        .edge("b2", "done", "b")
        .edge("done", "done", "a")
        .edge("done", "done", "b")
        .build()
}

/// A machine with a state nothing can reach.
///
/// `orphan` is a perfectly good state that no string arrives at, so it contributes nothing to
/// the language. Minimization removes it before it starts, which surprises people the first
/// time their four-state machine minimizes to two.
pub fn unreachable_state() -> Automaton {
    AutomatonBuilder::new(["a"])
        .state("start")
        .accepting("end")
        .state("orphan")
        .edge("start", "end", "a")
        .edge("end", "end", "a")
        .edge("orphan", "start", "a")
        .build()
}

/// An ε-NFA for `a*b*`, with the ε-transition doing the joining.
///
/// The smallest machine where an ε-transition is the *point* rather than an artifact of a
/// construction: it is how "then" is expressed without reading anything.
pub fn epsilon_join() -> Automaton {
    AutomatonBuilder::new(["a", "b"])
        .state("as")
        .accepting("bs")
        .edge("as", "as", "a")
        .epsilon("as", "bs")
        .edge("bs", "bs", "b")
        .build()
}

/// Strings over `{a, b}` with an odd number of `a`s **and** an even number of `b`s.
///
/// The product construction, drawn out: four states, one per combination of two independent
/// parities. Every edge flips exactly one coordinate.
pub fn odd_as_even_bs() -> Automaton {
    AutomatonBuilder::new(["a", "b"])
        .state("ee")
        .accepting("oe")
        .state("eo")
        .state("oo")
        .edge("ee", "oe", "a")
        .edge("ee", "eo", "b")
        .edge("oe", "ee", "a")
        .edge("oe", "oo", "b")
        .edge("eo", "oo", "a")
        .edge("eo", "ee", "b")
        .edge("oo", "eo", "a")
        .edge("oo", "oe", "b")
        .build()
}

/// The empty language: a machine that accepts nothing at all.
///
/// One state, no accepting states. Worth having in the gallery because `∅` and `{ε}` are the
/// pair students most reliably confuse, and seeing both as machines settles it.
pub fn empty_language() -> Automaton {
    AutomatonBuilder::new(["a", "b"])
        .state("q0")
        .edge("q0", "q0", "a")
        .edge("q0", "q0", "b")
        .build()
}

/// The language containing only the empty string.
///
/// Accepting on the start state and nowhere to go. The other half of the `∅` versus `{ε}`
/// pair, and the machine that makes "ε is a string" concrete.
pub fn only_epsilon() -> Automaton {
    AutomatonBuilder::new(["a", "b"])
        .accepting("q0")
        .state("dead")
        .edge("q0", "dead", "a")
        .edge("q0", "dead", "b")
        .edge("dead", "dead", "a")
        .edge("dead", "dead", "b")
        .build()
}

/// Strings over `{a, b}` that do **not** contain `ab`.
///
/// The complement of a pattern search, and the example that shows complementing needs a
/// *complete* machine first — flipping accepting states on an incomplete DFA gives the wrong
/// language, which is a mistake almost everyone makes once.
pub fn avoids_ab() -> Automaton {
    AutomatonBuilder::new(["a", "b"])
        .accepting("q0") // no `a` pending
        .accepting("q1") // last was `a`
        .state("dead")
        .edge("q0", "q1", "a")
        .edge("q0", "q0", "b")
        .edge("q1", "q1", "a")
        .edge("q1", "dead", "b")
        .edge("dead", "dead", "a")
        .edge("dead", "dead", "b")
        .build()
}

/// Strings over `{a, b}` of length exactly three.
///
/// A finite language, which is worth meeting because it makes the trap state unavoidable and
/// shows that "finite" does not mean "small machine" — five states for eight strings.
pub fn length_three() -> Automaton {
    AutomatonBuilder::new(["a", "b"])
        .state("l0")
        .state("l1")
        .state("l2")
        .accepting("l3")
        .state("over")
        .edges("l0", "l1", ["a", "b"])
        .edges("l1", "l2", ["a", "b"])
        .edges("l2", "l3", ["a", "b"])
        .edges("l3", "over", ["a", "b"])
        .edges("over", "over", ["a", "b"])
        .build()
}

/// Binary strings with an even number of `0`s and an even number of `1`s.
///
/// The same product idea as `odd_as_even_bs`, over a binary alphabet and with the accepting
/// state at the origin — which makes the "both counters at zero" reading obvious in a way the
/// `{a, b}` version does not.
pub fn even_zeros_even_ones() -> Automaton {
    AutomatonBuilder::new(["0", "1"])
        .accepting("ee")
        .state("oe")
        .state("eo")
        .state("oo")
        .edge("ee", "oe", "0")
        .edge("ee", "eo", "1")
        .edge("oe", "ee", "0")
        .edge("oe", "oo", "1")
        .edge("eo", "oo", "0")
        .edge("eo", "ee", "1")
        .edge("oo", "eo", "0")
        .edge("oo", "oe", "1")
        .build()
}

/// An NFA with a choice on the very first symbol: strings that start `aa` or end `bb`.
///
/// Nondeterminism that is not a guess about *when* but about *which* — the machine picks a
/// branch and commits. Its subset construction is small and its shape is not, which makes it
/// a good first scrub.
pub fn starts_aa_or_ends_bb() -> Automaton {
    AutomatonBuilder::new(["a", "b"])
        .state("choose")
        .state("a1")
        .accepting("startsaa")
        .state("scan")
        .state("b1")
        .accepting("endsbb")
        .epsilon("choose", "a1")
        .epsilon("choose", "scan")
        .edge("a1", "startsaa", "a")
        .edges("startsaa", "startsaa", ["a", "b"])
        .edges("scan", "scan", ["a", "b"])
        .edge("scan", "b1", "b")
        .edge("b1", "endsbb", "b")
        .build()
}

/// Strings over `{a, b, c}` where every `a` is eventually followed by a `c`.
///
/// A three-symbol alphabet, which matters more than it sounds: every transition table in the
/// gallery is two columns wide until this one, and a student whose coursework is over three
/// symbols needs to see that nothing changes.
pub fn a_then_c() -> Automaton {
    AutomatonBuilder::new(["a", "b", "c"])
        .accepting("clear") // no `a` waiting for its `c`
        .state("owed") // an `a` is waiting
        .edge("clear", "owed", "a")
        .edge("clear", "clear", "b")
        .edge("clear", "clear", "c")
        .edge("owed", "owed", "a")
        .edge("owed", "owed", "b")
        .edge("owed", "clear", "c")
        .build()
}

/// Every example, in the order a gallery should show them.
///
/// Ordered by tier and then by how much each one assumes, so reading top to bottom is a
/// sensible path through the subject rather than an alphabetical accident.
pub fn catalogue() -> Vec<Example> {
    use Tier::{Introductory, Pathological, Standard};
    use Topic::{
        Arithmetic, Epsilon, Invariants, Minimization, Nondeterminism, SelfLoops, SubsetBlowUp,
        TrapStates,
    };

    vec![
        Example {
            key: "even_number_of_as",
            title: "Even number of a’s",
            language: "{ w ∈ {a, b}* : |w|ₐ is even }",
            teaches: "The smallest machine with a real invariant — two states, and the state *is* the parity.",
            tier: Introductory,
            topics: &[Invariants, SelfLoops],
            build: even_number_of_as,
        },
        Example {
            key: "even_length",
            title: "Even length",
            language: "{ w ∈ {a, b}* : |w| is even }",
            teaches: "The counterpart to parity of a’s: here every symbol moves the state, because the state counts everything.",
            tier: Introductory,
            topics: &[Invariants],
            build: even_length,
        },
        Example {
            key: "ends_with_ab",
            title: "Ends in ab",
            language: "{ w ∈ {a, b}* : w ends with ab }",
            teaches: "Why a DFA needs memory of the last symbol, and what a self-loop is actually for.",
            tier: Introductory,
            topics: &[Invariants, SelfLoops],
            build: ends_with_ab,
        },
        Example {
            key: "starts_with_a",
            title: "Starts with a",
            language: "{ w ∈ {a, b}* : w begins with a }",
            teaches: "The smallest machine with a genuine trap state — once the first symbol is b, nothing can help.",
            tier: Introductory,
            topics: &[TrapStates],
            build: starts_with_a,
        },
        Example {
            key: "empty_language",
            title: "The empty language",
            language: "∅",
            teaches: "A machine that accepts nothing. Half of the ∅-versus-{ε} pair that students most reliably confuse.",
            tier: Introductory,
            topics: &[TrapStates],
            build: empty_language,
        },
        Example {
            key: "only_epsilon",
            title: "Only the empty string",
            language: "{ ε }",
            teaches: "The other half: accepting before reading anything. Makes “ε is a string” concrete.",
            tier: Introductory,
            topics: &[TrapStates],
            build: only_epsilon,
        },
        Example {
            key: "contains_aba",
            title: "Contains aba",
            language: "{ w ∈ {a, b}* : aba is a substring of w }",
            teaches: "A state is how much of the pattern you have matched — and failing back is not always to the start.",
            tier: Standard,
            topics: &[Invariants, SelfLoops],
            build: contains_aba,
        },
        Example {
            key: "length_three",
            title: "Exactly three symbols",
            language: "{ w ∈ {a, b}* : |w| = 3 }",
            teaches: "A finite language, and proof that “finite” does not mean “small machine” — five states for eight strings.",
            tier: Standard,
            topics: &[TrapStates],
            build: length_three,
        },
        Example {
            key: "odd_as_even_bs",
            title: "Odd a’s and even b’s",
            language: "{ w ∈ {a, b}* : |w|ₐ is odd and |w|_b is even }",
            teaches: "The product construction drawn out: four states, one per pair of independent parities.",
            tier: Standard,
            topics: &[Invariants],
            build: odd_as_even_bs,
        },
        Example {
            key: "even_zeros_even_ones",
            title: "Even 0s and even 1s",
            language: "{ w ∈ {0, 1}* : |w|₀ and |w|₁ are both even }",
            teaches: "The same product idea with the accepting state at the origin, which makes “both counters at zero” obvious.",
            tier: Standard,
            topics: &[Invariants],
            build: even_zeros_even_ones,
        },
        Example {
            key: "divisible_by_three",
            title: "Multiples of three",
            language: "{ w ∈ {0, 1}* : w is a binary numeral divisible by 3 }",
            teaches: "The state is a remainder, not a memory — reading a bit computes r → (2r + b) mod 3.",
            tier: Standard,
            topics: &[Arithmetic, Invariants],
            build: divisible_by_three,
        },
        Example {
            key: "a_then_c",
            title: "Every a is answered by a c",
            language: "{ w ∈ {a, b, c}* : every a is followed later by a c }",
            teaches: "A three-symbol alphabet. Every other table here is two columns wide; nothing about the method changes.",
            tier: Standard,
            topics: &[Invariants],
            build: a_then_c,
        },
        Example {
            key: "avoids_ab",
            title: "Never contains ab",
            language: "{ w ∈ {a, b}* : ab is not a substring of w }",
            teaches: "Complementing needs a complete machine first — flipping the accepting states of a partial DFA gives the wrong language.",
            tier: Standard,
            topics: &[TrapStates],
            build: avoids_ab,
        },
        Example {
            key: "ends_with_00_nfa",
            title: "Ends in 00 (NFA)",
            language: "{ w ∈ {0, 1}* : w ends with 00 }",
            teaches: "Nondeterminism as convenience rather than compression — the DFA it becomes is the same size.",
            tier: Standard,
            topics: &[Nondeterminism],
            build: ends_with_00_nfa,
        },
        Example {
            key: "epsilon_join",
            title: "a*b*, joined by ε",
            language: "{ aⁱbʲ : i, j ≥ 0 }",
            teaches: "The smallest machine where an ε-transition is the point: it is how “then” is written without reading anything.",
            tier: Standard,
            topics: &[Epsilon],
            build: epsilon_join,
        },
        Example {
            key: "starts_aa_or_ends_bb",
            title: "Starts aa, or ends bb",
            language: "{ w : w begins with aa } ∪ { w : w ends with bb }",
            teaches: "Nondeterminism that chooses a branch rather than a moment — and two ε-transitions doing the choosing.",
            tier: Standard,
            topics: &[Nondeterminism, Epsilon],
            build: starts_aa_or_ends_bb,
        },
        Example {
            key: "redundant_states",
            title: "Two states you cannot tell apart",
            language: "{ w ∈ {a, b}* : |w| ≥ 2 }",
            teaches: "Built non-minimal on purpose. Two states with different names and different incoming edges, and no string separates them.",
            tier: Pathological,
            topics: &[Minimization],
            build: redundant_states,
        },
        Example {
            key: "unreachable_state",
            title: "A state nothing reaches",
            language: "{ aⁿ : n ≥ 1 }",
            teaches: "Minimization removes unreachable states before it starts, which is why a four-state machine can minimize to two.",
            tier: Pathological,
            topics: &[Minimization],
            build: unreachable_state,
        },
        Example {
            key: "thompson_abb",
            title: "Thompson’s construction of (a|b)*abb",
            language: "L((a|b)*abb)",
            teaches: "Fourteen states for a language four states accept — the entire argument for the two conversions that follow.",
            tier: Pathological,
            topics: &[Epsilon, Nondeterminism],
            build: thompson_abb,
        },
        Example {
            key: "nth_from_end",
            title: "Fourth symbol from the end is a",
            language: "{ w ∈ {a, b}* : the 4th symbol from the end is a }",
            teaches: "Five states, and a DFA of thirty-two. The machine that makes the 2ⁿ bound stop being a footnote.",
            tier: Pathological,
            topics: &[Nondeterminism, SubsetBlowUp],
            build: nth_from_end,
        },
    ]
}

/// Build an example by key.
///
/// `None` for a key nothing answers to, rather than a panic: keys arrive from URLs, and a
/// stale link in a lecture slide should not take the page down.
pub fn by_key(key: &str) -> Option<Automaton> {
    catalogue()
        .into_iter()
        .find(|e| e.key == key)
        .map(|e| (e.build)())
}
