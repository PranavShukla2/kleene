//! Reading JFLAP's `.jff` files.
//!
//! Roadmap §1.3: *"this is how you take users from an incumbent — you make switching free."*
//! Someone with three years of coursework in `.jff` files will not retype it, and a tool that
//! cannot open their existing work is a tool they will look at once.
//!
//! ## The error messages are the feature
//!
//! JFLAP does far more than Kleene: pushdown automata, Turing machines, grammars, Mealy and
//! Moore machines. A file holding one of those is not corrupt and must not be reported as
//! though it were. The person opening it is *exactly* the user being courted, and the message
//! is a first impression — so it names what the file contains and what Kleene does support,
//! rather than complaining about an unexpected element (task E3).
//!
//! ## What JFLAP does not write down
//!
//! **An alphabet.** JFLAP has no Σ; it infers one from the transitions, so this does the same.
//! A symbol that appears nowhere is a symbol that does not exist, which is a small loss —
//! a machine over `{a, b}` that happens to use only `a` imports as a machine over `{a}` — and
//! there is nothing in the file to recover it from.

use std::collections::BTreeSet;
use std::fmt;

use indexmap::IndexMap;

use crate::automaton::{Automaton, State, StateId, Transition};

/// Why a `.jff` file could not be opened.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum JffError {
    /// Not XML, or not a JFLAP document.
    NotJflap(String),
    /// A JFLAP structure Kleene does not model.
    ///
    /// Carries the type as JFLAP writes it, so the message can name it precisely.
    Unsupported(Structure),
    /// A finite automaton that does not describe a machine — no states, a transition from
    /// nowhere.
    Malformed(String),
}

impl fmt::Display for JffError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotJflap(why) => {
                write!(f, "This does not look like a JFLAP file: {why}")
            }
            Self::Unsupported(kind) => write!(
                f,
                "This file contains {}, which Kleene does not support yet. Kleene reads finite \
                 automata — DFAs, NFAs and ε-NFAs. Everything else in your JFLAP folder will \
                 have to stay there for now.",
                kind.describe()
            ),
            Self::Malformed(why) => write!(f, "This JFLAP file describes no machine: {why}"),
        }
    }
}

impl std::error::Error for JffError {}

/// What kind of thing a `.jff` file holds.
///
/// JFLAP writes this in a `<type>` element, and it is the first thing worth reading — a
/// Turing machine parsed as a finite automaton would produce a plausible and wrong result
/// rather than an error.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Structure {
    /// A finite automaton. The one Kleene reads.
    FiniteAutomaton,
    /// A pushdown automaton.
    Pushdown,
    /// A Turing machine, of one tape or several.
    Turing,
    /// A grammar.
    Grammar,
    /// A regular expression, which JFLAP also stores as a structure.
    RegularExpression,
    /// A Mealy or Moore machine.
    Transducer,
    /// Something this build has not heard of.
    Unknown(String),
}

impl Structure {
    /// Read JFLAP's `<type>` text.
    fn parse(text: &str) -> Self {
        match text.trim() {
            "fa" => Self::FiniteAutomaton,
            "pda" => Self::Pushdown,
            "turing" | "turing-bb" | "multi-tape-turing" => Self::Turing,
            "grammar" => Self::Grammar,
            "re" => Self::RegularExpression,
            "mealy" | "moore" => Self::Transducer,
            other => Self::Unknown(other.to_string()),
        }
    }

    /// How the message names it, as a noun phrase that reads inside a sentence.
    fn describe(&self) -> String {
        match self {
            Self::FiniteAutomaton => "a finite automaton".to_string(),
            Self::Pushdown => "a pushdown automaton".to_string(),
            Self::Turing => "a Turing machine".to_string(),
            Self::Grammar => "a grammar".to_string(),
            Self::RegularExpression => "a regular expression".to_string(),
            Self::Transducer => "a Mealy or Moore machine".to_string(),
            Self::Unknown(kind) => format!("a JFLAP structure of type `{kind}`"),
        }
    }
}

/// Where a state sat in JFLAP, in JFLAP's coordinates.
///
/// Kept beside the machine rather than inside it: `kleene-core` does not know what a pixel is,
/// and JFLAP's coordinate space is one more thing it should not have to have an opinion about.
/// The caller decides what to do with these — the editor uses them directly, because JFLAP's
/// axes run the same way as a screen's, and a re-layout would throw away exactly the
/// arrangement the person spent their time on.
pub type Positions = Vec<(StateId, f64, f64)>;

/// What a `.jff` file turned out to hold.
#[derive(Clone, Debug, PartialEq)]
pub struct Imported {
    /// The machine.
    pub automaton: Automaton,
    /// Where its states sat, in JFLAP's coordinates.
    pub layout: Positions,
    /// Anything the file said that Kleene had to drop.
    ///
    /// Not errors — the import succeeded. These are for telling someone what changed, because
    /// a silent difference between what they drew and what they see is worse than a sentence.
    pub notes: Vec<String>,
}
