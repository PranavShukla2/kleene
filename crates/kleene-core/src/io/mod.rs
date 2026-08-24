//! Reading and writing automata in other formats.
//!
//! Every function here works on **strings**, never paths. Files are the caller's business:
//! the CLI has a filesystem, the browser has `File` and IndexedDB, and neither belongs in a
//! crate that also compiles to WebAssembly.
//!
//! | Format | Direction | Purpose |
//! |---|---|---|
//! | [`json`] — `.kln` | read + write | Kleene's own document format |
//! | [`dot`] | write | Graphviz, for papers and pipelines |
//!
//! TikZ export needs layout information the editor does not produce until Phase 2, so it
//! arrives in Phase 4 alongside the rest of the export surface.

pub mod dot;
pub mod jff;
pub mod json;
pub mod tikz;
pub mod wire;

pub use dot::to_dot;
pub use json::{Document, FormatError, Meta, Point};
pub use tikz::to_tikz;
pub use wire::{WireAutomaton, WireState};
