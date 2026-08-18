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

/// Everything wrong with an automaton, as a structured report.
///
/// Routed through wasm rather than reimplemented in TypeScript, and that is the whole point.
/// "Is this machine well-formed?" is a definition, not a convenience — a second copy in
/// another language would drift, and the drift would be silent because both sides still
/// compile and both still return plausible answers. The editor's validation strip and every
/// algorithm's precondition must agree, so there is one implementation and it lives in the
/// core.
///
/// # Errors
///
/// Returns a JS error if the argument is not an automaton, or if the report cannot be
/// serialized.
#[wasm_bindgen]
pub fn validate(automaton: JsValue) -> Result<JsValue, JsError> {
    let automaton: Automaton =
        serde_wasm_bindgen::from_value(automaton).map_err(|e| JsError::new(&e.to_string()))?;

    serde_wasm_bindgen::to_value(&automaton.validate()).map_err(|e| JsError::new(&e.to_string()))
}

/// Whether a machine is a DFA, an NFA, or an ε-NFA.
///
/// Returns the badge text directly — `DFA`, `NFA`, `ε-NFA` — because the badge is the only
/// consumer and a caller that had to map three variants onto three strings would be a fourth
/// place for the definition to live.
///
/// # Errors
///
/// Returns a JS error if the argument is not an automaton.
#[wasm_bindgen]
pub fn determinism(automaton: JsValue) -> Result<String, JsError> {
    let automaton: Automaton =
        serde_wasm_bindgen::from_value(automaton).map_err(|e| JsError::new(&e.to_string()))?;

    Ok(automaton.determinism().label().to_string())
}

/// Run a string through a machine, returning the trace as well as the answer.
///
/// The trace is the payload this whole boundary was designed around: a run over a modest NFA
/// produces a configuration per symbol plus a step of prose for each, and `serde_wasm_bindgen`
/// builds those directly rather than through a JSON string parsed twice.
///
/// The input tester steps through the result rather than simulating anything itself. A
/// simulator that existed in both Rust and TypeScript could disagree about ε-closures or about
/// what "stuck" means, and the two would be tested separately and believed equally.
///
/// # Errors
///
/// Returns a JS error if the argument is not an automaton, or if the run cannot be serialized.
#[wasm_bindgen]
pub fn simulate(automaton: JsValue, input: &str) -> Result<JsValue, JsError> {
    let automaton: Automaton =
        serde_wasm_bindgen::from_value(automaton).map_err(|e| JsError::new(&e.to_string()))?;

    let traced = kleene_core::simulate::simulate(&automaton, input);

    // `Simulation` rather than `Traced<Run>`: a generic type has no TypeScript name the
    // frontend can use, so the core carries a flattened wire shape for it — the same role
    // `io::wire` plays for `Automaton`.
    let simulation = kleene_core::simulate::Simulation::from(traced);

    serde_wasm_bindgen::to_value(&simulation).map_err(|e| JsError::new(&e.to_string()))
}

/// δ written out as a table, and the 5-tuple it belongs to.
///
/// Roadmap §2.4a: the diagram, the table and the tuple are the same object in the three
/// notations the subject teaches, and converting between them by hand is an examined skill.
/// Derived in Rust rather than in the frontend because three of the decisions are semantic —
/// whether an ε column exists, what an empty cell means, and which glyph stands for the empty
/// string — and answering those in the view layer would put half the definition of δ in the
/// code that is meant to be drawing it.
///
/// # Errors
///
/// Returns a JS error if the argument is not an automaton, or if the result cannot be
/// serialized.
#[wasm_bindgen]
pub fn transition_table(automaton: JsValue) -> Result<JsValue, JsError> {
    let automaton: Automaton =
        serde_wasm_bindgen::from_value(automaton).map_err(|e| JsError::new(&e.to_string()))?;

    // Notation is not yet a user setting; D7 makes it one, and this is the call site that will
    // read it when it is.
    let table = automaton.transition_table(kleene_core::Notation::default());

    serde_wasm_bindgen::to_value(&table).map_err(|e| JsError::new(&e.to_string()))
}

/// The formal definition, `M = (Q, Σ, δ, q₀, F)`.
///
/// δ is absent by design: it is the transition table, and restating it here would be a second
/// copy that could disagree with the first.
///
/// # Errors
///
/// Returns a JS error if the argument is not an automaton.
#[wasm_bindgen]
pub fn formal_definition(automaton: JsValue) -> Result<JsValue, JsError> {
    let automaton: Automaton =
        serde_wasm_bindgen::from_value(automaton).map_err(|e| JsError::new(&e.to_string()))?;

    let definition = automaton.formal_definition(kleene_core::Notation::default());

    serde_wasm_bindgen::to_value(&definition).map_err(|e| JsError::new(&e.to_string()))
}

/// Compile a regular expression into an ε-NFA, or into the reason it is not one.
///
/// Returns `undefined` for an empty input rather than an error — that is the state the regex
/// bar is in before anyone has typed, and greeting a visitor with "unexpected end of input" is
/// reporting a mistake they have not made.
///
/// The pipeline lives in the core (`regex::compile`) rather than being stitched together here.
/// Three call sites joining `parse` to `thompson` is three chances to join it differently, and
/// the browser, the CLI and the docs generator have to agree about what an expression means.
///
/// # Errors
///
/// Returns a JS error only if the result cannot be serialized, which would mean a type in the
/// core has drifted out of `Serialize`.
#[wasm_bindgen]
pub fn compile_regex(source: &str) -> Result<JsValue, JsError> {
    match kleene_core::regex::compile::compile(source) {
        None => Ok(JsValue::UNDEFINED),
        Some(outcome) => {
            serde_wasm_bindgen::to_value(&outcome).map_err(|e| JsError::new(&e.to_string()))
        }
    }
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
