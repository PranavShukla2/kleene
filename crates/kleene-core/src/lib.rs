//! # kleene-core
//!
//! Automata theory algorithms that return their reasoning alongside their result.
//!
//! Pure algorithms: zero I/O, zero geometry. This crate does not know what a pixel is.
//!
//! ## The one design decision
//!
//! Every conversion returns a [`Traced<T>`](trace::Traced) — the result, plus the ordered
//! steps that produced it. `determinize()` does not return a DFA; it returns a DFA *and*
//! the subset-construction rounds that built it.
//!
//! That single choice is why one implementation can serve a browser step-through, a CLI
//! `--verbose` mode, and generated documentation, with no second copy of the explanation to
//! keep in sync.
//!
//! ```
//! use kleene_core::{automaton::Determinism, examples};
//!
//! let dfa = examples::ends_with_ab();
//! assert_eq!(dfa.determinism(), Determinism::Dfa);
//! assert_eq!(dfa.state_count(), 3);
//! ```

#![forbid(unsafe_code)]
#![warn(missing_docs)]
#![warn(clippy::all)]

pub mod automaton;
pub mod builder;
pub mod convert;
pub mod examples;
pub mod notation;
pub mod regex;
pub mod trace;
pub mod validate;

pub use automaton::{Automaton, Determinism, State, StateId, Symbol, Transition};
pub use builder::AutomatonBuilder;
pub use convert::{Closures, complete, determinize, epsilon_closure, prune};
pub use notation::Notation;
pub use regex::{ParseError, Regex, parse, thompson};
pub use trace::{Step, StepKind, Traced};
pub use validate::{Problem, ProblemKind, Report, Severity};

/// The version of this crate, surfaced so the app and CLI can report the engine they
/// were built against rather than guessing.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
