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
    let automaton: Automaton =
        examples::by_key(name).ok_or_else(|| JsError::new(&format!("unknown example: {name}")))?;

    serde_wasm_bindgen::to_value(&automaton).map_err(|e| JsError::new(&e.to_string()))
}

/// The whole example catalogue, as the gallery shows it (Phase 5 Track C).
///
/// The list lives in the core rather than in the frontend, and that is what makes tasks C1 and
/// C4 the same work: the twenty machines the gallery draws are the twenty CI runs a broken
/// example fails. A copy of the list in TypeScript would be a second corpus, tested by nobody,
/// and it would drift the first time one was added.
///
/// The machines themselves are not built here. A gallery asking "what examples are there"
/// has no business constructing twenty automata to answer.
///
/// # Errors
///
/// Returns a JS error if the catalogue cannot be serialized.
#[wasm_bindgen]
pub fn example_catalogue() -> Result<JsValue, JsError> {
    let entries: Vec<_> = examples::catalogue()
        .into_iter()
        .map(|e| {
            serde_json::json!({
                "key": e.key,
                "title": e.title,
                "language": e.language,
                "teaches": e.teaches,
                "tier": e.tier.name(),
                "topics": e.topics.iter().map(|t| t.name()).collect::<Vec<_>>(),
            })
        })
        .collect();

    js_sys::JSON::parse(&serde_json::Value::Array(entries).to_string())
        .map_err(|_| JsError::new("The catalogue could not be returned."))
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

/// Serialize a document as `.kln` (Phase 4 D1).
///
/// Takes the whole document — machine, layout and metadata — because that is what a person
/// saved, and dropping their arrangement on every save would be unforgivable.
///
/// # Errors
///
/// Returns a JS error if the argument is not a document.
#[wasm_bindgen]
pub fn to_kln(document: JsValue) -> Result<String, JsError> {
    let document = document_from_js(document)?;
    Ok(document.to_json())
}

/// Read a `Document` out of a JS value, through JSON.
///
/// **The one place in this crate that does not use `serde_wasm_bindgen` directly**, and the
/// reason is `layout`: it is a map keyed by state id, and JavaScript object keys are always
/// *strings*. `serde_wasm_bindgen` hands those over as strings and the derive rejects them —
/// `invalid type: string "0", expected u32` — while `serde_json` coerces them, because JSON
/// has the same constraint and serde's JSON support has always had to deal with it.
///
/// The same asymmetry runs the other way: `serde_wasm_bindgen` writes a Rust map as a JS
/// `Map`, and every consumer of `Document` on the frontend expects a plain object.
///
/// Going through a JSON string costs a parse. The module header rejects that for *traces*,
/// which cross in bulk and are the payload this boundary was designed around; a document
/// crosses when someone presses Save.
fn document_from_js(value: JsValue) -> Result<kleene_core::io::Document, JsError> {
    let text = js_sys::JSON::stringify(&value)
        .map_err(|_| JsError::new("That is not a document."))?
        .as_string()
        .ok_or_else(|| JsError::new("That is not a document."))?;

    serde_json::from_str(&text).map_err(|e| JsError::new(&e.to_string()))
}

/// Read a `.kln` file (Phase 4 D1, D3).
///
/// The version is checked before anything else, so a file from a newer build produces a
/// sentence about updating rather than a parser complaint about an unexpected field several
/// levels down. That early check is the entire reason the field exists.
///
/// A malformed *machine* is refused — a transition to a state that is not there, a symbol
/// outside the alphabet. A merely **odd** one is not: an unreachable state or a missing
/// transition is normal in something someone is still drawing, and refusing to open a work in
/// progress would make the format useless as a working file.
///
/// # Errors
///
/// Returns a JS error carrying a sentence meant to be shown to the reader, not logged.
#[wasm_bindgen]
pub fn from_kln(text: &str) -> Result<JsValue, JsError> {
    let document =
        kleene_core::io::Document::from_json(text).map_err(|e| JsError::new(&e.to_string()))?;

    // Back through JSON for the same reason: `layout` must arrive as a plain object with
    // string keys, and `serde_wasm_bindgen` would make it a `Map`.
    let json = serde_json::to_string(&document).map_err(|e| JsError::new(&e.to_string()))?;
    js_sys::JSON::parse(&json).map_err(|_| JsError::new("The document could not be returned."))
}

/// Graphviz DOT for a machine (Phase 4 Track G).
///
/// The lingua franca for graphs: `dot -Tpng`, `dot -Tsvg`, and every tool that reads a graph
/// reads this. Cheap to produce, and it makes Kleene composable with pipelines it will never
/// know about.
///
/// Takes no layout, unlike TikZ. Graphviz *is* a layout engine — handing it positions would be
/// telling it not to do the one thing it is for.
///
/// # Errors
///
/// Returns a JS error if the argument is not an automaton.
#[wasm_bindgen]
pub fn to_dot(automaton: JsValue) -> Result<String, JsError> {
    let automaton: Automaton =
        serde_wasm_bindgen::from_value(automaton).map_err(|e| JsError::new(&e.to_string()))?;

    Ok(kleene_core::io::to_dot(&automaton))
}

/// Read a JFLAP `.jff` file (Phase 4 Track E).
///
/// Returns the machine, where its states sat in JFLAP, and anything the import had to drop —
/// a dangling transition, a second start state. Those notes are not errors: the import
/// succeeded, and a silent difference between what someone drew in JFLAP and what they now see
/// is worse than a sentence saying what changed.
///
/// # Errors
///
/// Returns a JS error whose message is meant to be *shown*. A file holding a pushdown
/// automaton is not corrupt, and the person opening it is exactly the user being courted — so
/// the message names what the file contains and what Kleene does read.
#[wasm_bindgen]
pub fn from_jff(text: &str) -> Result<JsValue, JsError> {
    let imported = kleene_core::io::from_jff(text).map_err(|e| JsError::new(&e.to_string()))?;

    // Built by hand rather than derived, because `Imported` is a core type and giving it
    // `Serialize` would be letting the boundary's convenience reach back into the engine.
    let layout: std::collections::BTreeMap<String, kleene_core::io::tikz::Point> = imported
        .layout
        .iter()
        .map(|&(id, x, y)| (id.to_string(), kleene_core::io::tikz::Point { x, y }))
        .collect();

    let payload = serde_json::json!({
        "automaton": imported.automaton,
        "layout": layout,
        "notes": imported.notes,
    });

    js_sys::JSON::parse(&payload.to_string())
        .map_err(|_| JsError::new("The imported machine could not be returned."))
}
