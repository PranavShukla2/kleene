//! The regular expression syntax tree.

use std::fmt;

use serde::{Deserialize, Serialize};

use crate::automaton::Symbol;
use crate::notation::Notation;

/// A regular expression.
/// Serialized in serde's default externally-tagged form (`{"symbol": "a"}`,
/// `{"star": {...}}`). Internal tagging cannot express tuple variants, and restructuring
/// the tree into named-field variants purely to get a `kind` key would be the tail wagging
/// the dog — the AST is read far more often in Rust than in JavaScript.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Regex {
    /// `∅` — matches nothing at all, not even the empty string.
    Empty,
    /// `ε` — matches only the empty string.
    Epsilon,
    /// A single alphabet symbol.
    Symbol(Symbol),
    /// One after the other.
    Concat(Box<Regex>, Box<Regex>),
    /// One or the other.
    Union(Box<Regex>, Box<Regex>),
    /// Zero or more repetitions.
    Star(Box<Regex>),
}

impl Regex {
    /// `a b`
    pub fn concat(left: Regex, right: Regex) -> Regex {
        Regex::Concat(Box::new(left), Box::new(right))
    }

    /// `a + b`
    pub fn union(left: Regex, right: Regex) -> Regex {
        Regex::Union(Box::new(left), Box::new(right))
    }

    /// `a*`
    pub fn star(inner: Regex) -> Regex {
        Regex::Star(Box::new(inner))
    }

    /// A symbol.
    pub fn symbol(s: impl Into<Symbol>) -> Regex {
        Regex::Symbol(s.into())
    }

    /// How many nodes the tree contains.
    ///
    /// Used by the property-test generator to assert it is producing expressions with
    /// real structure rather than a stream of single symbols.
    pub fn size(&self) -> usize {
        match self {
            Self::Empty | Self::Epsilon | Self::Symbol(_) => 1,
            Self::Star(inner) => 1 + inner.size(),
            Self::Concat(l, r) | Self::Union(l, r) => 1 + l.size() + r.size(),
        }
    }

    /// How deeply the tree nests.
    pub fn depth(&self) -> usize {
        match self {
            Self::Empty | Self::Epsilon | Self::Symbol(_) => 1,
            Self::Star(inner) => 1 + inner.depth(),
            Self::Concat(l, r) | Self::Union(l, r) => 1 + l.depth().max(r.depth()),
        }
    }

    /// Every symbol mentioned, in first-appearance order.
    pub fn alphabet(&self) -> Vec<Symbol> {
        let mut out = Vec::new();
        self.collect_alphabet(&mut out);
        out
    }

    fn collect_alphabet(&self, out: &mut Vec<Symbol>) {
        match self {
            Self::Symbol(s) => {
                if !out.contains(s) {
                    out.push(s.clone());
                }
            }
            Self::Star(inner) => inner.collect_alphabet(out),
            Self::Concat(l, r) | Self::Union(l, r) => {
                l.collect_alphabet(out);
                r.collect_alphabet(out);
            }
            Self::Empty | Self::Epsilon => {}
        }
    }

    /// Binding tightness, used to decide where parentheses are actually needed.
    fn precedence(&self) -> u8 {
        match self {
            Self::Union(..) => 1,
            Self::Concat(..) => 2,
            Self::Star(..) => 3,
            _ => 4,
        }
    }

    /// Render using the given notation.
    ///
    /// Parenthesises only where precedence requires it, so the output reads like something
    /// a person would write. This matters more than it looks: `to_regex` output is shown to
    /// students, and a correct expression buried in redundant brackets teaches nothing.
    pub fn display(&self, notation: Notation) -> String {
        match self {
            Self::Empty => notation.empty_set().to_string(),
            Self::Epsilon => notation.empty_string().to_string(),
            Self::Symbol(s) => s.clone(),

            Self::Union(l, r) => {
                format!(
                    "{} + {}",
                    l.bracketed(1, notation),
                    r.bracketed(1, notation)
                )
            }

            // Concatenation's right operand needs brackets at equal precedence too:
            // `a(bc)` and `(ab)c` render identically, which is fine, but `a(b + c)` must
            // not lose its brackets.
            Self::Concat(l, r) => {
                format!("{}{}", l.bracketed(2, notation), r.bracketed(2, notation))
            }

            // Star binds tighter than everything, so anything compound needs brackets.
            Self::Star(inner) => format!("{}*", inner.bracketed(4, notation)),
        }
    }

    /// Render, adding brackets if this node binds more loosely than the context requires.
    fn bracketed(&self, needed: u8, notation: Notation) -> String {
        if self.precedence() < needed {
            format!("({})", self.display(notation))
        } else {
            self.display(notation)
        }
    }
}

impl fmt::Display for Regex {
    /// Renders with the default notation (`ε`).
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.display(Notation::default()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sym(s: &str) -> Regex {
        Regex::symbol(s)
    }

    #[test]
    fn renders_without_redundant_brackets() {
        // ab + c needs none of them.
        let r = Regex::union(Regex::concat(sym("a"), sym("b")), sym("c"));
        assert_eq!(r.to_string(), "ab + c");
    }

    #[test]
    fn brackets_a_union_inside_a_concatenation() {
        // Losing these brackets would change the language, which is the one thing
        // rendering must never do.
        let r = Regex::concat(sym("a"), Regex::union(sym("b"), sym("c")));
        assert_eq!(r.to_string(), "a(b + c)");
    }

    #[test]
    fn brackets_a_compound_under_a_star() {
        assert_eq!(
            Regex::star(Regex::concat(sym("a"), sym("b"))).to_string(),
            "(ab)*"
        );
        assert_eq!(
            Regex::star(Regex::union(sym("a"), sym("b"))).to_string(),
            "(a + b)*"
        );
    }

    #[test]
    fn does_not_bracket_a_single_symbol_under_a_star() {
        assert_eq!(Regex::star(sym("a")).to_string(), "a*");
    }

    #[test]
    fn renders_the_empty_string_per_the_notation_setting() {
        assert_eq!(Regex::Epsilon.display(Notation::EPSILON), "ε");
        assert_eq!(Regex::Epsilon.display(Notation::LAMBDA), "λ");
    }

    #[test]
    fn collects_the_alphabet_in_first_appearance_order() {
        let r = Regex::union(Regex::concat(sym("b"), sym("a")), sym("b"));
        assert_eq!(r.alphabet(), ["b", "a"]);
    }

    #[test]
    fn size_and_depth_describe_the_tree() {
        let r = Regex::star(Regex::union(sym("a"), sym("b")));
        assert_eq!(r.size(), 4);
        assert_eq!(r.depth(), 3);
    }
}
