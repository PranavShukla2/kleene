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
use kleene_core::{Automaton, convert, parse, thompson};

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
        let kind = match from {
            From::Auto if argument == "-" || Path::new(argument).is_file() => From::Kln,
            From::Auto => From::Regex,
            explicit => explicit,
        };

        match kind {
            From::Regex => {
                let ast =
                    parse(argument).map_err(|e| InputError::Regex(argument.to_string(), e))?;
                Ok(Self {
                    automaton: thompson(&ast).result,
                    document: None,
                })
            }
            From::Kln | From::Auto => {
                let text = read(argument)?;
                let document = Document::from_json(&text)
                    .map_err(|e| InputError::Format(argument.to_string(), e))?;
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
    fn as_dfa_leaves_an_existing_dfa_alone() {
        let input = Input::resolve("a", From::Regex).expect("parses");
        let dfa = input.as_dfa();
        assert_eq!(dfa.determinism(), Determinism::Dfa);
    }
}
