//! WebAssembly bindings for [`kleene_core`].
//!
//! Deliberately thin. Every binding here should be a type conversion and a call — if logic
//! starts accumulating in this crate, it belongs in `kleene-core`, where it is testable
//! without a browser and reusable by the CLI.
//!
//! ## Why `serde_wasm_bindgen` and not JSON strings
//!
//! Traces are the main thing crossing this boundary, and they cross in bulk — a subset
//! construction on a modest NFA produces hundreds of steps. Serialising to a JSON string in
//! Rust and re-parsing it in JavaScript pays for the whole structure twice. `serde_wasm_bindgen`
//! builds JS values directly.

#![forbid(unsafe_code)]
#![warn(missing_docs)]

use kleene_core::{Automaton, examples};
use wasm_bindgen::prelude::*;

/// Install a panic hook that reports Rust panics to the browser console.
///
/// Without this, a panic inside wasm surfaces as `unreachable executed` with no location,
/// which is the least debuggable error message in the stack.
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

/// The version of the engine this build was compiled from.
///
/// The trivial half of the FFI proof: a value crosses the boundary at all.
#[wasm_bindgen]
pub fn version() -> String {
    kleene_core::VERSION.to_string()
}

/// A worked example, as a structured JS object.
///
/// The half of the FFI proof that matters. Returning a number would demonstrate nothing
/// about the boundary that will actually carry `Automaton` and `Traced<T>` — nested
/// structs, an `IndexMap`, `Option`s, and a `BTreeSet` in `origin`. If this round-trips,
/// the real payloads will too.
///
/// # Errors
///
/// Returns a JS error if the automaton cannot be serialized, which would mean a type in
/// the core model has drifted out of `Serialize`.
#[wasm_bindgen]
pub fn example_automaton(name: &str) -> Result<JsValue, JsError> {
    let automaton: Automaton = match name {
        "even_number_of_as" => examples::even_number_of_as(),
        "ends_with_ab" => examples::ends_with_ab(),
        other => return Err(JsError::new(&format!("unknown example: {other}"))),
    };

    serde_wasm_bindgen::to_value(&automaton).map_err(|e| JsError::new(&e.to_string()))
}

#[cfg(test)]
mod tests {
    use kleene_core::{Determinism, examples};

    // Exercised natively via the rlib target: the conversions these bindings perform are
    // core behaviour, and core behaviour should not need a browser to test.
    #[test]
    fn examples_resolve_to_real_machines() {
        assert_eq!(examples::ends_with_ab().determinism(), Determinism::Dfa);
        assert_eq!(examples::even_number_of_as().state_count(), 2);
    }

    #[test]
    fn version_is_not_empty() {
        assert!(!kleene_core::VERSION.is_empty());
    }
}
