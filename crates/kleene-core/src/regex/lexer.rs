//! Turns regex source into tokens, keeping track of where each one came from.
//!
//! Positions are retained on every token because the UI underlines the offending character
//! when a parse fails (Phase 3 A3). An error that says only "unexpected token" makes the
//! user hunt for their own mistake, which is the opposite of what this tool is for.

use std::fmt;

use crate::regex::Span;

/// A lexed token and where it appeared.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Token {
    /// What was read.
    pub kind: TokenKind,
    /// Where it was read from.
    pub span: Span,
}

/// The kinds of token a regular expression is made of.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TokenKind {
    /// An alphabet symbol.
    Symbol(String),
    /// Union: written `+` (decision D1) or `|`.
    Union,
    /// Kleene star.
    Star,
    /// `(`
    Open,
    /// `)`
    Close,
    /// The empty string: `ε` or `λ`, both accepted on input.
    Epsilon,
    /// The empty language: `∅`.
    EmptySet,
}

impl fmt::Display for TokenKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Symbol(s) => write!(f, "`{s}`"),
            Self::Union => write!(f, "`+`"),
            Self::Star => write!(f, "`*`"),
            Self::Open => write!(f, "`(`"),
            Self::Close => write!(f, "`)`"),
            Self::Epsilon => write!(f, "the empty string"),
            Self::EmptySet => write!(f, "the empty set"),
        }
    }
}

/// Something the lexer could not make sense of.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LexError {
    /// The character that could not be read.
    pub found: char,
    /// Where it was.
    pub span: Span,
    /// A sentence explaining the problem.
    pub message: String,
}

/// Read a regular expression into tokens.
///
/// Whitespace is skipped, so `a + b` and `a+b` lex identically. That is deliberate: the
/// spaced form is how lecture slides write union, and treating whitespace as significant
/// would make the textbook spelling fail for a reason no student would guess.
///
/// # Errors
///
/// Returns the first character that is not valid regex syntax, with its position.
pub fn lex(input: &str) -> Result<Vec<Token>, LexError> {
    let mut tokens = Vec::new();

    for (index, ch) in input.chars().enumerate() {
        // Char indices rather than byte offsets: the frontend underlines spans, and a
        // JS caller can slice `[...input]` directly without a UTF-8 conversion step.
        let span = Span::at(index);

        let kind = match ch {
            c if c.is_whitespace() => continue,

            // D1: `+` is union. `|` is accepted as a synonym so anyone arriving from a
            // programming background is not blocked, only redirected.
            '+' | '|' | '∪' => TokenKind::Union,

            '*' => TokenKind::Star,
            '(' => TokenKind::Open,
            ')' => TokenKind::Close,

            // Both glyphs are accepted on input regardless of the display setting (D7).
            // Rejecting the one the user's own course uses would be perverse.
            'ε' | 'λ' => TokenKind::Epsilon,
            '∅' => TokenKind::EmptySet,

            // Reserved for future syntax rather than silently treated as symbols, so that
            // adding them later cannot change the meaning of an existing saved regex.
            '?' => {
                return Err(LexError {
                    found: ch,
                    span,
                    message: "`?` (optional) is not supported yet. Write `(r + ε)` instead."
                        .to_string(),
                });
            }
            '[' | ']' | '{' | '}' | '\\' | '.' | '^' | '$' => {
                return Err(LexError {
                    found: ch,
                    span,
                    message: format!(
                        "`{ch}` is reserved. Kleene uses textbook regular expressions, \
                         not programming regex syntax."
                    ),
                });
            }

            c if c.is_alphanumeric() => TokenKind::Symbol(c.to_string()),

            _ => {
                return Err(LexError {
                    found: ch,
                    span,
                    message: format!("`{ch}` is not a symbol or an operator."),
                });
            }
        };

        tokens.push(Token { kind, span });
    }

    Ok(tokens)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kinds(input: &str) -> Vec<TokenKind> {
        lex(input)
            .expect("lexes")
            .into_iter()
            .map(|t| t.kind)
            .collect()
    }

    #[test]
    fn lexes_a_simple_expression() {
        assert_eq!(
            kinds("ab*"),
            [
                TokenKind::Symbol("a".into()),
                TokenKind::Symbol("b".into()),
                TokenKind::Star
            ]
        );
    }

    #[test]
    fn plus_and_pipe_are_the_same_token() {
        // D1: both mean union. They must be indistinguishable after lexing, or the
        // parser would have two paths to keep in agreement.
        assert_eq!(kinds("a+b"), kinds("a|b"));
    }

    #[test]
    fn whitespace_is_insignificant() {
        // `a + b` is how the lecture slide writes it. It must lex as `a+b`.
        assert_eq!(kinds("a + b"), kinds("a+b"));
    }

    #[test]
    fn both_empty_string_glyphs_are_accepted_on_input() {
        // The display setting (D7) governs output, not what a user is allowed to type.
        assert_eq!(kinds("ε"), [TokenKind::Epsilon]);
        assert_eq!(kinds("λ"), [TokenKind::Epsilon]);
    }

    #[test]
    fn spans_point_at_the_right_character() {
        let tokens = lex("ab*").expect("lexes");
        assert_eq!(tokens[2].span, Span::at(2));
    }

    #[test]
    fn spans_count_characters_not_bytes() {
        // `ε` is three bytes. A byte offset here would leave the UI underlining the
        // wrong character for every regex containing a multi-byte glyph.
        let tokens = lex("εa").expect("lexes");
        assert_eq!(tokens[1].span, Span::at(1));
    }

    #[test]
    fn programming_regex_syntax_is_rejected_with_an_explanation() {
        let err = lex("[a-z]").expect_err("rejects character classes");
        assert_eq!(err.found, '[');
        assert!(err.message.contains("programming regex"), "{}", err.message);
    }

    #[test]
    fn optional_is_reserved_and_suggests_the_textbook_spelling() {
        let err = lex("a?").expect_err("rejects ?");
        assert!(err.message.contains("(r + ε)"), "{}", err.message);
    }

    #[test]
    fn an_unknown_character_reports_itself_and_its_position() {
        let err = lex("a#b").expect_err("rejects #");
        assert_eq!(err.found, '#');
        assert_eq!(err.span, Span::at(1));
    }
}
