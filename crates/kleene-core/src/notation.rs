//! How the symbols of the subject are written down.
//!
//! Courses disagree about notation, and a tool that quietly uses the other convention is
//! harder to learn from than one that uses none. Decision D7 makes the empty string a
//! **setting** rather than a constant for exactly this reason: it appears on edges, in
//! regexes, in step prose, in TikZ output and in the docs, so hard-coding it would turn a
//! change into a find-and-replace across every exporter.

use serde::{Deserialize, Serialize};

/// Which glyphs to write the subject's constants with.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Notation {
    /// How the empty string is written.
    pub empty_string: EmptyString,
}

impl Notation {
    /// Hopcroft–Ullman convention: the empty string is `ε`.
    pub const EPSILON: Self = Self {
        empty_string: EmptyString::Epsilon,
    };
    /// Linz convention: the empty string is `λ`.
    pub const LAMBDA: Self = Self {
        empty_string: EmptyString::Lambda,
    };

    /// The glyph for the empty string.
    pub fn empty_string(self) -> &'static str {
        match self.empty_string {
            EmptyString::Epsilon => "ε",
            EmptyString::Lambda => "λ",
        }
    }

    /// The LaTeX command for the empty string, for TikZ export.
    pub fn empty_string_latex(self) -> &'static str {
        match self.empty_string {
            EmptyString::Epsilon => r"\varepsilon",
            EmptyString::Lambda => r"\lambda",
        }
    }

    /// The glyph for the empty language.
    ///
    /// Not configurable — `∅` is universal in a way `ε` is not.
    pub fn empty_set(self) -> &'static str {
        "∅"
    }

    /// How a transition's symbol is written: the symbol itself, or the empty-string glyph.
    pub fn symbol(self, on: Option<&str>) -> &str {
        on.unwrap_or(self.empty_string())
    }
}

impl Default for Notation {
    /// `ε`, per decision D7.
    fn default() -> Self {
        Self::EPSILON
    }
}

/// Which glyph stands for the empty string.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EmptyString {
    /// `ε` — Hopcroft–Ullman, Sipser, Kozen.
    Epsilon,
    /// `λ` — Linz, and a number of Indian syllabi.
    Lambda,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_epsilon() {
        assert_eq!(Notation::default().empty_string(), "ε");
    }

    #[test]
    fn switching_notation_moves_every_surface_together() {
        // The point of D7: one setting, and prose, edge labels and LaTeX all follow. If
        // any surface were hard-coded, this test would catch it the day someone flips it.
        let l = Notation::LAMBDA;
        assert_eq!(l.empty_string(), "λ");
        assert_eq!(l.empty_string_latex(), r"\lambda");
        assert_eq!(l.symbol(None), "λ");
    }

    #[test]
    fn a_real_symbol_is_unaffected_by_notation() {
        assert_eq!(Notation::EPSILON.symbol(Some("a")), "a");
        assert_eq!(Notation::LAMBDA.symbol(Some("a")), "a");
    }
}
