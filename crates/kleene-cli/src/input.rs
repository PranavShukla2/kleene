//! Turning a command-line argument into an automaton.
//!
//! An input is a regular expression, a `.kln` file, or `-` for standard input. Which one is
//! usually obvious from looking, so it is detected rather than declared — but `--from` exists
//! because guessing wrong on someone's data is worse than making them type six characters.

use std::fmt;
use std::fs;
use std::io::Read;
use std::path::Path;

use kleene_core::io::Document;
use kleene_core::{Automaton, convert, examples, parse, thompson};

/// Where an automaton came from.
#[derive(Clone, Copy, Debug, PartialEq, Eq, clap::ValueEnum)]
pub enum From {
    /// Detect: an existing file is read as `.kln`, anything else is a regular expression.
    Auto,
    /// A regular expression, in Kleene's textbook syntax.
    Regex,
    /// A `.kln` document.
    Kln,
}

/// Something that stopped an input being read.
#[derive(Debug)]
pub enum InputError {
    /// The file could not be read.
    Io(String, std::io::Error),
    /// The file is not a valid document.
    Format(String, kleene_core::io::FormatError),
    /// The regular expression could not be parsed.
    Regex(String, kleene_core::ParseError),
}

impl fmt::Display for InputError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(what, e) => write!(f, "cannot read {what}: {e}"),
            Self::Format(what, e) => write!(f, "{what}: {e}"),
            Self::Regex(what, e) => {
                // The caret points at the span the parser blamed, which is most of the
                // value of tracking spans in the first place.
                write!(f, "cannot parse regular expression\n\n  {what}\n  ")?;
                for _ in 0..e.span.start {
                    write!(f, " ")?;
                }
                let width = (e.span.end.saturating_sub(e.span.start)).max(1);
                for _ in 0..width {
                    write!(f, "^")?;
                }
                write!(f, "\n\n{e}")
            }
        }
    }
}

impl std::error::Error for InputError {}

/// Read an input into an automaton, remembering how it was interpreted.
#[derive(Debug)]
pub struct Input {
    /// The machine.
    pub automaton: Automaton,
    /// The document it came from, when it came from one — carries layout and title.
    pub document: Option<Document>,
}

impl Input {
    /// Resolve an argument.
    ///
    /// # Errors
    ///
    /// Fails if the file cannot be read, the document is invalid, or the regular expression
    /// does not parse.
    pub fn resolve(argument: &str, from: From) -> Result<Self, InputError> {
        // Standard input is read once, before anything is decided about it, because it cannot
        // be read twice. Everything else can be classified from the argument alone.
        if argument == "-" {
            let text = read(argument)?;
            let kind = match from {
                From::Auto => sniff(&text),
                explicit => explicit,
            };
            return Self::interpret(&text, "standard input", kind);
        }

        match from {
            From::Auto if Path::new(argument).is_file() => {
                Self::interpret(&read(argument)?, argument, From::Kln)
            }
            // A key from `kleene examples`. Without this the command lists twenty
            // identifiers that no other command will accept — a catalogue you can read and
            // cannot use.
            //
            // It cannot shadow an expression: keys are snake_case, and `_` is not a symbol
            // the regex lexer accepts, so no example key is also a valid expression.
            From::Auto => match examples::by_key(argument) {
                Some(automaton) => Ok(Self {
                    automaton,
                    document: None,
                }),
                None => Self::interpret(argument, argument, From::Regex),
            },
            From::Regex => Self::interpret(argument, argument, From::Regex),
            From::Kln => Self::interpret(&read(argument)?, argument, From::Kln),
        }
    }

    /// Build an automaton from text already in hand.
    fn interpret(text: &str, what: &str, kind: From) -> Result<Self, InputError> {
        match kind {
            From::Regex | From::Auto => {
                let source = text.trim();
                let ast = parse(source).map_err(|e| InputError::Regex(source.to_string(), e))?;
                Ok(Self {
                    automaton: thompson(&ast).result,
                    document: None,
                })
            }
            From::Kln => {
                let document = Document::from_json(text)
                    .map_err(|e| InputError::Format(what.to_string(), e))?;
                Ok(Self {
                    automaton: document.automaton.clone(),
                    document: Some(document),
                })
            }
        }
    }

    /// The machine as a DFA, determinizing only if it is not already one.
    pub fn as_dfa(&self) -> Automaton {
        if self.automaton.determinism() == kleene_core::Determinism::Dfa {
            self.automaton.clone()
        } else {
            convert::determinize(&self.automaton).result
        }
    }
}

/// Which of the two things a piece of piped text is.
///
/// A `.kln` document is JSON and therefore opens with `{`; `{` is reserved in Kleene's regular
/// expression syntax and rejected by the lexer, so no valid expression can start with one.
/// The two languages cannot collide on their first character, which makes this a decision
/// rather than a guess.
fn sniff(text: &str) -> From {
    if text.trim_start().starts_with('{') {
        From::Kln
    } else {
        From::Regex
    }
}

/// Read a path, or standard input for `-`.
fn read(path: &str) -> Result<String, InputError> {
    if path == "-" {
        let mut buffer = String::new();
        std::io::stdin()
            .read_to_string(&mut buffer)
            .map_err(|e| InputError::Io("standard input".into(), e))?;
        return Ok(buffer);
    }

    fs::read_to_string(path).map_err(|e| InputError::Io(path.to_string(), e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use kleene_core::Determinism;

    #[test]
    fn a_regex_argument_becomes_an_epsilon_nfa() {
        let input = Input::resolve("a+b", From::Auto).expect("parses");
        assert_eq!(input.automaton.determinism(), Determinism::EpsilonNfa);
        assert!(input.document.is_none());
    }

    #[test]
    fn a_bad_regex_reports_where_it_went_wrong() {
        let error = Input::resolve("a+", From::Auto).expect_err("incomplete");
        let shown = error.to_string();

        // The caret line is the point of carrying spans through the parser.
        assert!(shown.contains('^'), "{shown}");
        assert!(shown.contains("union"), "{shown}");
        assert!(shown.contains("aa*"), "{shown}");
    }

    #[test]
    fn a_missing_file_forced_as_kln_is_an_io_error_not_a_regex_error() {
        // Without --from this would be treated as a regex and produce a baffling parse
        // error about a slash.
        let error = Input::resolve("/nonexistent/x.kln", From::Kln).expect_err("missing");
        assert!(matches!(error, InputError::Io(..)), "{error:?}");
    }

    #[test]
    fn piped_text_is_classified_by_its_first_character() {
        // The bug this fixes: `-` was hardcoded to `.kln`, so `echo "a*" | kleene convert -`
        // failed with "this does not look like a Kleene file" — for input that was never
        // claiming to be one, and against help text promising it would be detected.
        assert_eq!(sniff("a*b"), From::Regex);
        assert_eq!(sniff("  (a + b)*abb\n"), From::Regex);
        assert_eq!(sniff(r#"{"version":1}"#), From::Kln);
        assert_eq!(sniff("\n  {\"version\": 1}"), From::Kln);
    }

    #[test]
    fn the_two_languages_cannot_collide_on_their_first_character() {
        // Why sniffing is sound rather than lucky: `{` is reserved by the lexer, so no valid
        // expression can begin with the character every .kln file begins with. If that ever
        // stops being true — counted repetition, say — this test fails and the sniff has to
        // become something cleverer.
        let error = kleene_core::parse("{2}").expect_err("`{` is reserved");
        assert!(error.to_string().contains("reserved"), "{error}");
    }

    #[test]
    fn a_regex_from_a_pipe_is_trimmed() {
        // `echo` adds a newline, and a trailing newline is not a symbol.
        let input = Input::interpret("a+b\n", "standard input", From::Regex).expect("parses");
        assert_eq!(input.automaton.determinism(), Determinism::EpsilonNfa);
    }

    #[test]
    fn an_example_key_resolves_to_its_machine() {
        let input = Input::resolve("even_number_of_as", From::Auto).expect("a known key");
        assert_eq!(input.automaton.determinism(), Determinism::Dfa);
        assert_eq!(input.automaton.state_count(), 2);
    }

    #[test]
    fn no_example_key_is_also_a_valid_expression() {
        // What makes the lookup safe rather than a precedence gamble. Keys are snake_case and
        // `_` is not a symbol the lexer accepts, so the two namespaces cannot overlap. If a
        // key without an underscore is ever added, this fails and the ambiguity is a decision
        // someone makes on purpose.
        for example in kleene_core::examples::catalogue() {
            assert!(
                kleene_core::parse(example.key).is_err(),
                "`{}` parses as a regular expression, so it is ambiguous",
                example.key
            );
        }
    }

    #[test]
    fn an_unknown_key_is_still_read_as_an_expression() {
        // The fallback has to stay: `ab` is not a key and must not become "no such example".
        let input = Input::resolve("ab", From::Auto).expect("parses");
        assert!(input.document.is_none());
    }

    #[test]
    fn as_dfa_leaves_an_existing_dfa_alone() {
        let input = Input::resolve("a", From::Regex).expect("parses");
        let dfa = input.as_dfa();
        assert_eq!(dfa.determinism(), Determinism::Dfa);
    }
}
