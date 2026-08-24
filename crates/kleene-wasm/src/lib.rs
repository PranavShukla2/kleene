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

    // `Simulation` rather than `Traced<Run>`: its field is called `run`, which reads better
    // than `result` everywhere the tester touches it. `Traced<T>` does now export to
    // TypeScript on its own, so this is a naming preference rather than a boundary limit —
    // see the note on `Simulation` itself.
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

/// An ε-closure, computed one state at a time.
///
/// The narrating implementation rather than the precomputed one, deliberately: this exists to
/// answer *how* a closure was arrived at, and `Closures` answers only *what*. Subset
/// construction uses the fast one and records the seeds, so the UI can replay any round's
/// closure in slow motion without the trace carrying hundreds of ε-steps it would never show
/// (see `convert::epsilon`'s note on why the two forms are separate).
///
/// # Errors
///
/// Returns a JS error if the argument is not an automaton, or if the result cannot be
/// serialized.
#[wasm_bindgen]
pub fn epsilon_closure(automaton: JsValue, seeds: Vec<u32>) -> Result<JsValue, JsError> {
    let automaton: Automaton =
        serde_wasm_bindgen::from_value(automaton).map_err(|e| JsError::new(&e.to_string()))?;

    let traced = kleene_core::convert::epsilon_closure(&automaton, seeds);

    // `Traced<T>` crosses the boundary as itself — it has a TypeScript name now, which is what
    // made a wire type per algorithm unnecessary.
    serde_wasm_bindgen::to_value(&traced).map_err(|e| JsError::new(&e.to_string()))
}

/// Partition refinement and its result, in one call.
///
/// Returns the machine refinement actually ran on as well as the answer, and that is not
/// redundancy: refinement restricts to reachable states and completes δ before it starts, so
/// the ids in the rounds and the marking table index a machine the caller never saw. A view
/// drawing the caller's DFA beside this table would be labelling blocks with states that
/// machine does not have.
///
/// # Errors
///
/// Returns a JS error if the argument is not an automaton, or if the result cannot be
/// serialized.
#[wasm_bindgen]
pub fn minimization(automaton: JsValue) -> Result<JsValue, JsError> {
    let automaton: Automaton =
        serde_wasm_bindgen::from_value(automaton).map_err(|e| JsError::new(&e.to_string()))?;

    let result = kleene_core::convert::minimization(&automaton);

    serde_wasm_bindgen::to_value(&result).map_err(|e| JsError::new(&e.to_string()))
}

/// State elimination, with the GNFA recorded at every step.
///
/// The order is a string rather than an enum across the boundary, for the same reason
/// `determinism` returns one: there are three of them, the UI is the only caller, and a
/// caller mapping three variants onto three strings would be a fourth place for the
/// definition to live. An unrecognised order falls back to the default rather than failing —
/// a stale link asking for an order that has been renamed should still convert something.
///
/// # Errors
///
/// Returns a JS error if the argument is not an automaton, or if the result cannot be
/// serialized.
#[wasm_bindgen]
pub fn elimination(automaton: JsValue, order: &str) -> Result<JsValue, JsError> {
    let automaton: Automaton =
        serde_wasm_bindgen::from_value(automaton).map_err(|e| JsError::new(&e.to_string()))?;

    let result = kleene_core::convert::elimination(&automaton, order.parse().unwrap_or_default());

    serde_wasm_bindgen::to_value(&result).map_err(|e| JsError::new(&e.to_string()))
}

/// TikZ source for an automaton, positioned as the caller has it on screen.
///
/// The layout crosses as a map from state id to `{x, y}` rather than being read from the
/// automaton, because `kleene-core` does not store positions — a machine is a machine wherever
/// it is drawn. It is also why this is the one export that cannot be produced from a `.kln`
/// file alone by a tool that has never rendered it.
///
/// A state missing from the layout is skipped rather than placed at the origin. Stacking
/// everything unplaced at (0,0) produces a picture that looks like a bug in TikZ.
///
/// # Errors
///
/// Returns a JS error if either argument is not the shape it should be.
#[wasm_bindgen]
pub fn to_tikz(automaton: JsValue, layout: JsValue) -> Result<String, JsError> {
    use std::collections::BTreeMap;

    let automaton: Automaton =
        serde_wasm_bindgen::from_value(automaton).map_err(|e| JsError::new(&e.to_string()))?;

    // Keys arrive as strings — JavaScript object keys always do — so the ids are parsed back
    // rather than assumed. An unparseable key is dropped, which degrades to a missing node
    // instead of a failed export.
    let raw: BTreeMap<String, kleene_core::io::tikz::Point> =
        serde_wasm_bindgen::from_value(layout).map_err(|e| JsError::new(&e.to_string()))?;

    let layout: BTreeMap<u32, kleene_core::io::tikz::Point> = raw
        .into_iter()
        .filter_map(|(id, at)| id.parse().ok().map(|id| (id, at)))
        .collect();

    Ok(kleene_core::io::to_tikz(
        &automaton,
        &layout,
        kleene_core::Notation::default(),
    ))
}
