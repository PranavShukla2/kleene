//! Conversions between machine representations.
//!
//! Every conversion here returns a [`Traced`](crate::trace::Traced) — the machine it built,
//! and the ordered reasoning that built it. That is the shape of the library rather than a
//! convenience (roadmap §2.1), and it is why the browser's step scrubber, the CLI's
//! `--verbose` output and the generated docs can all read one implementation.
//!
//! ## The pipeline
//!
//! ```text
//!   regex ──thompson──> ε-NFA ──determinize──> DFA ──minimize──> minimal DFA
//! ```
//!
//! Each stage is independently useful and independently traced, so a student can enter the
//! pipeline anywhere — drawing an NFA by hand and determinizing it is as well supported as
//! typing a regular expression.

pub mod complete;
pub mod epsilon;
pub mod minimize;
pub mod prune;
pub mod subset;
pub mod to_regex;

pub use complete::complete;
pub use epsilon::{Closures, epsilon_closure};
pub use minimize::{Mark, MarkingTable, Minimization, Refinement, minimization, minimize, refine};
pub use prune::{co_reachable, prune, retaining};
pub use subset::determinize;
pub use to_regex::{Order, to_regex, to_regex_with};
