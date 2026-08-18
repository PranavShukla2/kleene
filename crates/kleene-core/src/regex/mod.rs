//! Regular expressions: lexing, parsing, and the syntax tree.
//!
//! ## Notation
//!
//! Kleene uses **textbook** regular expression syntax, not programming regex syntax. The
//! difference that matters most is decision **D1**: `+` means **union**, as in
//! Hopcroft–Ullman and in most formal-languages courses — not "one or more".
//!
//! ```text
//!   a + b        a or b            (`|` is accepted as a synonym)
//!   ab           a then b
//!   a*           zero or more a
//!   aa*          one or more a
//!   ε            the empty string  (`λ` also accepted on input)
//!   ∅            the empty language
//! ```
//!
//! Precedence, loosest to tightest: **union < concatenation < star**.
//!
//! The choice of `+` was made on the grounds that it fails *loudly*. Someone assuming the
//! programming convention writes `a+`, which is missing its right operand and produces an
//! error naming the convention. Under the opposite choice, someone pasting `a + b` from a
//! lecture slide would get a silently different machine and no error at all.

use serde::{Deserialize, Serialize};

pub mod ast;
pub mod compile;
pub mod lexer;
pub mod parser;
pub mod simplify;
pub mod thompson;

pub use ast::Regex;
pub use parser::{ParseError, parse};
pub use simplify::simplify;
pub use thompson::thompson;

/// A range of characters in the source text.
///
/// Measured in **characters, not bytes**, so a caller can slice `[...input]` without a
/// UTF-8 conversion. Regexes are short; the cost of char indexing is irrelevant and the
/// correctness gain for multi-byte glyphs like `ε` is not.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "Span")
)]
pub struct Span {
    /// First character, inclusive.
    pub start: usize,
    /// Last character, exclusive.
    pub end: usize,
}

impl Span {
    /// A span covering one character.
    pub fn at(index: usize) -> Self {
        Self {
            start: index,
            end: index + 1,
        }
    }

    /// A span covering a range.
    pub fn new(start: usize, end: usize) -> Self {
        Self { start, end }
    }

    /// A zero-width span, for errors about something that is missing.
    pub fn empty_at(index: usize) -> Self {
        Self {
            start: index,
            end: index,
        }
    }

    /// The smallest span covering both.
    pub fn to(self, other: Self) -> Self {
        Self {
            start: self.start.min(other.start),
            end: self.end.max(other.end),
        }
    }
}
