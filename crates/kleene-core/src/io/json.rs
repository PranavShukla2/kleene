//! The `.kln` document format.
//!
//! A [`Document`] is an [`Automaton`] plus the things a *file* needs and a machine does not:
//! where the states sit on screen, what the thing is called, and which version of the format
//! wrote it.
//!
//! ## Why layout lives here and not on `Automaton`
//!
//! `kleene-core` does not know what a pixel is, and `Automaton` must stay that way — it is
//! what lets the same machine be rendered, printed, exported to TikZ and compared for
//! equivalence without any of those agreeing on a coordinate system. But a *document* is a
//! different thing from a *machine*: it is what a person saved, and losing their layout on
//! every save would be unforgivable. So the format layers presentation on top rather than
//! folding it in.
//!
//! ## No file I/O
//!
//! Everything here works on strings. Reading and writing files is the caller's job — the CLI
//! has a filesystem, the browser has `File` and `localStorage`, and neither belongs in a
//! crate that also compiles to WebAssembly.

use std::collections::BTreeMap;
use std::fmt;

use serde::{Deserialize, Serialize};

use crate::automaton::{Automaton, StateId};

/// The format version this build writes.
///
/// Bumped only for changes that older readers cannot cope with. Adding an optional field is
/// not one of those; removing or repurposing a field is.
pub const VERSION: u32 = 1;

/// Where a state sits on screen.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export, export_to = "generated/"))]
pub struct Point {
    /// Horizontal position.
    pub x: f64,
    /// Vertical position.
    pub y: f64,
}

/// Descriptive information about a document.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export, export_to = "generated/"))]
pub struct Meta {
    /// What the automaton is called — usually its language in words.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub title: Option<String>,
    /// A longer description, when a title is not enough.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub description: Option<String>,
    /// ISO-8601 date the document was created.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub created: Option<String>,
}

/// A saved automaton: the machine, its layout, and its metadata.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS), ts(export, export_to = "generated/"))]
pub struct Document {
    /// Format version. See [`VERSION`].
    pub version: u32,
    /// The machine itself.
    ///
    /// Typed as the wire shape for TypeScript, because that is what actually appears in a
    /// file and on the wasm boundary — `Automaton`'s in-memory `IndexMap` is a Rust
    /// implementation detail that never crosses either.
    #[cfg_attr(feature = "ts", ts(as = "crate::io::wire::WireAutomaton"))]
    pub automaton: Automaton,
    /// Where each state sits. States without an entry are laid out automatically.
    ///
    /// A `BTreeMap` rather than a hash map so the serialized key order is stable — a file
    /// that reorders itself on every save produces noise in version control and defeats
    /// snapshot testing.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub layout: BTreeMap<StateId, Point>,
    /// Title, description, date.
    #[serde(default, skip_serializing_if = "is_default_meta")]
    pub meta: Meta,
}

fn is_default_meta(meta: &Meta) -> bool {
    *meta == Meta::default()
}

/// Something wrong with a document being read.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum FormatError {
    /// The text is not valid JSON, or does not have the shape of a document.
    Malformed(String),
    /// Written by a newer version of Kleene than this one understands.
    UnsupportedVersion {
        /// The version the file claims.
        found: u32,
        /// The newest version this build can read.
        supported: u32,
    },
    /// Structurally valid JSON describing a machine that does not make sense.
    InvalidAutomaton(Vec<String>),
}

impl fmt::Display for FormatError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Malformed(why) => write!(f, "This does not look like a Kleene file: {why}"),
            Self::UnsupportedVersion { found, supported } => write!(
                f,
                "This file was written by a newer version of Kleene (format {found}; this \
                 build understands up to {supported}). Update Kleene to open it."
            ),
            Self::InvalidAutomaton(problems) => {
                write!(
                    f,
                    "The file describes an invalid automaton: {}",
                    problems.join("; ")
                )
            }
        }
    }
}

impl std::error::Error for FormatError {}

/// Just enough of a document to learn its version.
///
/// Read first, so a file from the future produces a sentence a person can act on rather than
/// a serde error about an unknown variant three levels deep. This is the entire reason the
/// version field exists, and it only works if it is checked *before* the full parse.
#[derive(Deserialize)]
struct VersionProbe {
    version: u32,
}

impl Document {
    /// Wrap an automaton as a document, with no layout and no metadata.
    pub fn new(automaton: Automaton) -> Self {
        Self {
            version: VERSION,
            automaton,
            layout: BTreeMap::new(),
            meta: Meta::default(),
        }
    }

    /// Give the document a title.
    #[must_use]
    pub fn titled(mut self, title: impl Into<String>) -> Self {
        self.meta.title = Some(title.into());
        self
    }

    /// Record where the states sit.
    #[must_use]
    pub fn with_layout(mut self, layout: BTreeMap<StateId, Point>) -> Self {
        self.layout = layout;
        self
    }

    /// Serialize, formatted for a human to read and for version control to diff.
    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(self).expect("a Document is always serializable")
    }

    /// Serialize as compactly as possible.
    ///
    /// What URL sharing compresses (roadmap §2.6) — whitespace that helps a reader is pure
    /// cost inside a link.
    pub fn to_json_compact(&self) -> String {
        serde_json::to_string(self).expect("a Document is always serializable")
    }

    /// Read a document.
    ///
    /// # Errors
    ///
    /// Fails if the text is not a document, if it was written by a newer format version, or
    /// if the machine it describes is malformed — a transition to a state that does not
    /// exist, say. Warnings such as an unreachable state do **not** fail the load: those are
    /// normal in a document someone is still working on.
    pub fn from_json(text: &str) -> Result<Self, FormatError> {
        // Version before anything else, so a future file gets an actionable message.
        let probe: VersionProbe =
            serde_json::from_str(text).map_err(|e| FormatError::Malformed(e.to_string()))?;

        if probe.version > VERSION {
            return Err(FormatError::UnsupportedVersion {
                found: probe.version,
                supported: VERSION,
            });
        }

        let document: Self =
            serde_json::from_str(text).map_err(|e| FormatError::Malformed(e.to_string()))?;

        let report = document.automaton.validate();
        if report.has_errors() {
            return Err(FormatError::InvalidAutomaton(
                report.errors().map(|p| p.message.clone()).collect(),
            ));
        }

        Ok(document)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::automaton::{State, Transition};
    use crate::examples;

    fn document() -> Document {
        Document::new(examples::ends_with_ab())
            .titled("Strings ending in ab")
            .with_layout(BTreeMap::from([
                (0, Point { x: 90.0, y: 130.0 }),
                (1, Point { x: 186.0, y: 130.0 }),
                (2, Point { x: 282.0, y: 130.0 }),
            ]))
    }

    #[test]
    fn a_document_round_trips_exactly() {
        let before = document();
        let after = Document::from_json(&before.to_json()).expect("reads back");
        assert_eq!(before, after);
    }

    #[test]
    fn layout_survives_the_round_trip() {
        // Losing someone's layout on save would be unforgivable, so it is asserted rather
        // than assumed.
        let after = Document::from_json(&document().to_json()).expect("reads back");
        assert_eq!(after.layout[&1], Point { x: 186.0, y: 130.0 });
    }

    #[test]
    fn the_compact_form_is_smaller_and_reads_back_the_same() {
        let before = document();
        assert!(before.to_json_compact().len() < before.to_json().len());
        assert_eq!(
            Document::from_json(&before.to_json_compact()).expect("reads back"),
            before
        );
    }

    #[test]
    fn a_future_version_is_refused_with_an_actionable_message() {
        // The entire reason the version field exists. Without the probe this would be a
        // serde error about an unexpected field, three levels deep.
        let text = document()
            .to_json()
            .replace("\"version\": 1", "\"version\": 99");
        let error = Document::from_json(&text).expect_err("refuses the future");

        assert_eq!(
            error,
            FormatError::UnsupportedVersion {
                found: 99,
                supported: VERSION
            }
        );
        assert!(error.to_string().contains("Update Kleene"), "{error}");
    }

    #[test]
    fn an_older_version_is_still_readable() {
        // Forward compatibility is refused; backward compatibility is the promise.
        let text = document()
            .to_json()
            .replace("\"version\": 1", "\"version\": 0");
        assert!(Document::from_json(&text).is_ok());
    }

    #[test]
    fn nonsense_is_rejected_as_not_a_kleene_file() {
        for text in ["", "{}", "not json at all", "[1, 2, 3]"] {
            assert!(
                matches!(Document::from_json(text), Err(FormatError::Malformed(_))),
                "{text:?} was accepted"
            );
        }
    }

    #[test]
    fn a_structurally_valid_but_broken_machine_is_refused() {
        // Valid JSON describing a transition into a state that does not exist. Accepting
        // this silently would push the failure into whichever algorithm ran next.
        let mut broken = document();
        broken
            .automaton
            .transitions
            .push(Transition::on(0, 99, "a"));

        let error = Document::from_json(&broken.to_json()).expect_err("refuses");
        assert!(
            matches!(error, FormatError::InvalidAutomaton(_)),
            "{error:?}"
        );
        assert!(error.to_string().contains("99"), "{error}");
    }

    #[test]
    fn a_document_with_only_warnings_still_loads() {
        // An unreachable state is normal in something someone is still drawing. Refusing
        // to open it would make the format unusable as a working file.
        let mut work_in_progress = document();
        work_in_progress
            .automaton
            .states
            .insert(9, State::new("orphan"));

        let loaded = Document::from_json(&work_in_progress.to_json()).expect("loads");
        assert!(
            loaded
                .automaton
                .validate()
                .problems
                .iter()
                .any(|p| p.message.contains("orphan"))
        );
    }

    #[test]
    fn empty_sections_are_omitted_rather_than_written_as_null() {
        // Share links carry this through a URL fragment; every byte of `"layout": {}` is
        // wasted there, and `null` fields read as a bug in a file someone opens.
        let bare = Document::new(examples::even_number_of_as()).to_json();
        assert!(!bare.contains("layout"), "{bare}");
        assert!(!bare.contains("meta"), "{bare}");
        assert!(!bare.contains("null"), "{bare}");
    }

    #[test]
    fn layout_keys_serialize_in_a_stable_order() {
        // A file that reorders itself on every save is noise in version control and
        // defeats snapshot testing.
        let doc = document();
        assert_eq!(doc.to_json(), doc.to_json());

        let json = doc.to_json();
        let zero = json.find("\"0\"").expect("state 0");
        let two = json.find("\"2\"").expect("state 2");
        assert!(zero < two, "layout keys are out of order");
    }

    #[test]
    fn a_hand_written_minimal_document_reads() {
        // The smallest thing someone could reasonably type or generate: no layout, no meta,
        // and no `accepting` flag on a non-accepting state.
        let minimal = r#"{
            "version": 1,
            "automaton": {
                "alphabet": ["a"],
                "states": [
                    { "id": 0, "label": "q0" },
                    { "id": 1, "label": "q1", "accepting": true }
                ],
                "start": 0,
                "transitions": [{ "from": 0, "to": 1, "on": "a" }]
            }
        }"#;

        let loaded = Document::from_json(minimal).expect("loads");
        assert!(!loaded.automaton.state(0).expect("q0").accepting);
        assert!(loaded.automaton.state(1).expect("q1").accepting);
    }

    #[test]
    fn an_absent_on_field_is_an_epsilon_transition() {
        // The one part of the format worth reading twice: {"from":0,"to":1} looks
        // incomplete and is not.
        let text = r#"{
            "version": 1,
            "automaton": {
                "alphabet": ["a"],
                "states": [
                    { "id": 0, "label": "q0" },
                    { "id": 1, "label": "q1", "accepting": true }
                ],
                "start": 0,
                "transitions": [{ "from": 0, "to": 1 }]
            }
        }"#;

        let loaded = Document::from_json(text).expect("loads");
        assert!(loaded.automaton.has_epsilon());
    }

    #[test]
    fn a_document_without_layout_or_meta_still_reads() {
        // The minimum a hand-written or generated file has to provide.
        let minimal = r#"{
            "version": 1,
            "automaton": {
                "alphabet": ["a"],
                "states": [{ "id": 0, "label": "q0", "accepting": true }],
                "start": 0,
                "transitions": [{ "from": 0, "to": 0, "on": "a" }]
            }
        }"#;

        let loaded = Document::from_json(minimal).expect("loads");
        assert_eq!(loaded.automaton.state_count(), 1);
        assert!(loaded.layout.is_empty());
        assert_eq!(loaded.meta, Meta::default());
    }
}
