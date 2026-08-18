//! Recursive-descent parser for textbook regular expressions.
//!
//! Grammar, loosest binding first:
//!
//! ```text
//!   union   := concat ('+' concat)*
//!   concat  := postfix+
//!   postfix := atom '*'*
//!   atom    := SYMBOL | ε | ∅ | '(' union ')'
//! ```
//!
//! Errors carry a [`Span`] and a sentence, never "unexpected token". The regex bar
//! underlines the span (Phase 3 A3), so the message is read by someone already looking at
//! the right character — it should tell them what to do, not what went wrong.

use std::fmt;

use crate::regex::Span;
use crate::regex::ast::Regex;
use serde::{Deserialize, Serialize};

use crate::regex::lexer::{LexError, Token, TokenKind, lex};

/// A regular expression that could not be parsed.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "ParseError")
)]
pub struct ParseError {
    /// Where the problem is.
    pub span: Span,
    /// What is wrong, in a sentence.
    pub message: String,
    /// What to do about it, when there is a specific suggestion.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub help: Option<String>,
}

impl ParseError {
    fn new(span: Span, message: impl Into<String>) -> Self {
        Self {
            span,
            message: message.into(),
            help: None,
        }
    }

    fn with_help(mut self, help: impl Into<String>) -> Self {
        self.help = Some(help.into());
        self
    }
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)?;
        if let Some(help) = &self.help {
            write!(f, " {help}")?;
        }
        Ok(())
    }
}

impl std::error::Error for ParseError {}

impl From<LexError> for ParseError {
    fn from(e: LexError) -> Self {
        Self {
            span: e.span,
            message: e.message,
            help: None,
        }
    }
}

/// Parse a regular expression.
///
/// # Errors
///
/// Returns the first problem found, with the span to underline and a sentence explaining it.
///
/// ```
/// use kleene_core::regex::parse;
///
/// // `+` is union (decision D1), so this is "a or b".
/// assert_eq!(parse("a + b").unwrap().to_string(), "a + b");
///
/// // And the programming reading fails loudly rather than silently meaning something else.
/// let err = parse("a+").unwrap_err();
/// assert!(err.help.unwrap().contains("aa*"));
/// ```
pub fn parse(input: &str) -> Result<Regex, ParseError> {
    let tokens = lex(input)?;
    let mut parser = Parser {
        tokens: &tokens,
        at: 0,
        len: input.chars().count(),
    };

    // An empty input is `∅` rather than an error: the regex bar starts empty, and a red
    // error on a field nobody has typed in yet is noise.
    if parser.tokens.is_empty() {
        return Ok(Regex::Empty);
    }

    let regex = parser.union()?;

    if let Some(token) = parser.peek() {
        return Err(match token.kind {
            TokenKind::Close => ParseError::new(token.span, "This `)` has no matching `(`.")
                .with_help("Remove it, or add an opening bracket."),
            ref kind => ParseError::new(token.span, format!("Unexpected {kind} here.")),
        });
    }

    Ok(regex)
}

struct Parser<'a> {
    tokens: &'a [Token],
    at: usize,
    /// Character count of the whole input, for pointing at "the end".
    len: usize,
}

impl Parser<'_> {
    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.at)
    }

    fn advance(&mut self) -> Option<&Token> {
        let token = self.tokens.get(self.at);
        if token.is_some() {
            self.at += 1;
        }
        token
    }

    /// The position just past the last token, for errors about something missing.
    fn end_span(&self) -> Span {
        Span::empty_at(self.len)
    }

    /// The span to blame when the thing that is missing should have followed a token.
    fn span_after(&self, token_index: usize) -> Span {
        self.tokens
            .get(token_index)
            .map_or_else(|| self.end_span(), |t| t.span)
    }

    /// `union := concat ('+' concat)*`
    fn union(&mut self) -> Result<Regex, ParseError> {
        let mut left = self.concat()?;

        while matches!(self.peek().map(|t| &t.kind), Some(TokenKind::Union)) {
            let operator = self.at;
            self.advance();

            // This is the error D1 exists for. Choosing `+` = union was justified
            // *specifically* because the opposite assumption lands here, loudly, instead
            // of silently building a different machine. Deleting this message would
            // forfeit the argument for the choice.
            if self.at_end_of_operand() {
                return Err(ParseError::new(
                    self.span_after(operator),
                    "`+` means union here, so it needs something on both sides.",
                )
                .with_help("If you meant \"one or more\", write `aa*` instead of `a+`."));
            }

            let right = self.concat()?;
            left = Regex::union(left, right);
        }

        Ok(left)
    }

    /// Whether the next token cannot begin an operand.
    ///
    /// End of input, `)`, `+` and `*` all mean "no operand here". `*` is in that list
    /// because it is postfix: it attaches to what came before, so meeting one where an
    /// operand was expected means the operand really is missing.
    fn at_end_of_operand(&self) -> bool {
        matches!(
            self.peek().map(|t| &t.kind),
            None | Some(TokenKind::Close | TokenKind::Union | TokenKind::Star)
        )
    }

    /// `concat := postfix+`
    fn concat(&mut self) -> Result<Regex, ParseError> {
        let mut left = self.postfix()?;

        while !self.at_end_of_operand() {
            let right = self.postfix()?;
            left = Regex::concat(left, right);
        }

        Ok(left)
    }

    /// `postfix := atom '*'*`
    fn postfix(&mut self) -> Result<Regex, ParseError> {
        let mut atom = self.atom()?;

        // `a**` is legal and means `a*`; collapsing it here keeps the tree small and
        // matches how anyone would read it.
        while matches!(self.peek().map(|t| &t.kind), Some(TokenKind::Star)) {
            self.advance();
            atom = match atom {
                Regex::Star(_) => atom,
                other => Regex::star(other),
            };
        }

        Ok(atom)
    }

    /// `atom := SYMBOL | ε | ∅ | '(' union ')'`
    fn atom(&mut self) -> Result<Regex, ParseError> {
        let Some(token) = self.advance().cloned() else {
            return Err(ParseError::new(
                self.end_span(),
                "The expression ends too early.",
            ));
        };

        match token.kind {
            TokenKind::Symbol(s) => Ok(Regex::Symbol(s)),
            TokenKind::Epsilon => Ok(Regex::Epsilon),
            TokenKind::EmptySet => Ok(Regex::Empty),

            TokenKind::Open => {
                if matches!(self.peek().map(|t| &t.kind), Some(TokenKind::Close)) {
                    let close = self.advance().expect("just peeked").span;
                    return Err(ParseError::new(
                        token.span.to(close),
                        "`()` is empty — brackets need an expression inside them.",
                    )
                    .with_help("For the empty string write `ε`; for the empty language, `∅`."));
                }

                let inner = self.union()?;

                match self.advance() {
                    Some(Token {
                        kind: TokenKind::Close,
                        ..
                    }) => Ok(inner),
                    _ => Err(ParseError::new(token.span, "This `(` is never closed.")
                        .with_help("Add a matching `)`.")),
                }
            }

            TokenKind::Star => Err(ParseError::new(
                token.span,
                "`*` has nothing to repeat — it must follow an expression.",
            )),

            TokenKind::Union => Err(ParseError::new(
                token.span,
                "`+` means union here, so it needs something on both sides.",
            )
            .with_help("If you meant \"one or more\", write `aa*` instead of `a+`.")),

            TokenKind::Close => Err(ParseError::new(token.span, "This `)` has no matching `(`.")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Parse and render, to check the tree's shape without writing it out by hand.
    fn round(input: &str) -> String {
        parse(input).expect("parses").to_string()
    }

    #[test]
    fn plus_is_union() {
        // The headline of decision D1.
        assert_eq!(
            parse("a+b").unwrap(),
            Regex::union(Regex::symbol("a"), Regex::symbol("b"))
        );
    }

    #[test]
    fn pipe_is_a_synonym_for_plus() {
        assert_eq!(parse("a|b").unwrap(), parse("a+b").unwrap());
    }

    #[test]
    fn concatenation_binds_tighter_than_union() {
        // ab + c must be (ab) + c, never a(b + c).
        assert_eq!(round("ab+c"), "ab + c");
        assert_eq!(
            parse("ab+c").unwrap(),
            Regex::union(
                Regex::concat(Regex::symbol("a"), Regex::symbol("b")),
                Regex::symbol("c")
            )
        );
    }

    #[test]
    fn star_binds_tighter_than_concatenation() {
        // ab* is a(b*), not (ab)*.
        assert_eq!(
            parse("ab*").unwrap(),
            Regex::concat(Regex::symbol("a"), Regex::star(Regex::symbol("b")))
        );
    }

    #[test]
    fn brackets_override_precedence() {
        assert_eq!(round("(a+b)c"), "(a + b)c");
        assert_eq!(round("(ab)*"), "(ab)*");
    }

    #[test]
    fn repeated_stars_collapse() {
        assert_eq!(round("a**"), "a*");
        assert_eq!(round("a***"), "a*");
    }

    #[test]
    fn parses_the_constants() {
        assert_eq!(parse("ε").unwrap(), Regex::Epsilon);
        assert_eq!(parse("∅").unwrap(), Regex::Empty);
    }

    #[test]
    fn an_empty_input_is_the_empty_language() {
        // The regex bar starts empty; a red error on an untouched field is noise.
        assert_eq!(parse("").unwrap(), Regex::Empty);
        assert_eq!(parse("   ").unwrap(), Regex::Empty);
    }

    // --- The errors, which are half the point of this parser ---

    #[test]
    fn postfix_plus_explains_the_convention() {
        // This is the error the entire D1 decision rests on. Someone arriving from
        // programming regex types `a+`, and must be told what `+` means here and what to
        // write instead — rather than silently getting a different machine.
        let err = parse("a+").expect_err("a+ is incomplete");
        assert!(err.message.contains("union"), "{}", err.message);
        let help = err.help.expect("has a suggestion");
        assert!(help.contains("aa*"), "{help}");
        assert!(help.contains("one or more"), "{help}");
    }

    #[test]
    fn postfix_plus_inside_brackets_explains_it_too() {
        // The same mistake one level down must not fall through to a generic message.
        let err = parse("(a+)b").expect_err("a+ is incomplete");
        assert!(err.help.expect("has a suggestion").contains("aa*"));
    }

    #[test]
    fn a_leading_plus_is_reported_as_union_too() {
        let err = parse("+a").expect_err("+a is incomplete");
        assert!(err.message.contains("union"), "{}", err.message);
    }

    #[test]
    fn an_unclosed_bracket_blames_the_opening_one() {
        // Pointing at the end of input would be technically true and useless; the
        // actionable character is the `(` that was never closed.
        let err = parse("(ab").expect_err("unclosed");
        assert_eq!(err.span, Span::at(0));
        assert!(err.message.contains("never closed"), "{}", err.message);
    }

    #[test]
    fn an_unmatched_closing_bracket_is_reported_where_it_is() {
        let err = parse("ab)").expect_err("unmatched");
        assert_eq!(err.span, Span::at(2));
    }

    #[test]
    fn empty_brackets_suggest_the_constants() {
        let err = parse("()").expect_err("empty group");
        assert!(err.help.expect("has a suggestion").contains('ε'));
    }

    #[test]
    fn a_leading_star_says_it_has_nothing_to_repeat() {
        let err = parse("*a").expect_err("nothing to repeat");
        assert!(err.message.contains("nothing to repeat"), "{}", err.message);
        assert_eq!(err.span, Span::at(0));
    }

    #[test]
    fn lex_errors_arrive_as_parse_errors_with_their_span() {
        let err = parse("a[b").expect_err("reserved character");
        assert_eq!(err.span, Span::at(1));
    }

    #[test]
    fn spans_survive_multi_byte_glyphs() {
        // `ε` is three bytes and one character. The span must be the character index, or
        // the UI underlines the wrong place in every regex containing one.
        let err = parse("ε+").expect_err("incomplete union");
        assert_eq!(err.span.start, 1);
    }
}
