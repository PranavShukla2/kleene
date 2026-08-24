//! Reading JFLAP's `.jff` files.
//!
//! Roadmap §1.3: *"this is how you take users from an incumbent — you make switching free."*
//! Someone with three years of coursework in `.jff` files will not retype it, and a tool that
//! cannot open their existing work is a tool they will look at once.
//!
//! ## The error messages are the feature
//!
//! JFLAP does far more than Kleene: pushdown automata, Turing machines, grammars, Mealy and
//! Moore machines. A file holding one of those is not corrupt and must not be reported as
//! though it were. The person opening it is *exactly* the user being courted, and the message
//! is a first impression — so it names what the file contains and what Kleene does support,
//! rather than complaining about an unexpected element (task E3).
//!
//! ## What JFLAP does not write down
//!
//! **An alphabet.** JFLAP has no Σ; it infers one from the transitions, so this does the same.
//! A symbol that appears nowhere is a symbol that does not exist, which is a small loss —
//! a machine over `{a, b}` that happens to use only `a` imports as a machine over `{a}` — and
//! there is nothing in the file to recover it from.

use std::collections::BTreeSet;
use std::fmt;

use indexmap::IndexMap;

use crate::automaton::{Automaton, State, StateId, Transition};

/// Why a `.jff` file could not be opened.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum JffError {
    /// Not XML, or not a JFLAP document.
    NotJflap(String),
    /// A JFLAP structure Kleene does not model.
    ///
    /// Carries the type as JFLAP writes it, so the message can name it precisely.
    Unsupported(Structure),
    /// A finite automaton that does not describe a machine — no states, a transition from
    /// nowhere.
    Malformed(String),
}

impl fmt::Display for JffError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotJflap(why) => {
                write!(f, "This does not look like a JFLAP file: {why}")
            }
            Self::Unsupported(kind) => write!(
                f,
                "This file contains {}, which Kleene does not support yet. Kleene reads finite \
                 automata — DFAs, NFAs and ε-NFAs. Everything else in your JFLAP folder will \
                 have to stay there for now.",
                kind.describe()
            ),
            Self::Malformed(why) => write!(f, "This JFLAP file describes no machine: {why}"),
        }
    }
}

impl std::error::Error for JffError {}

/// What kind of thing a `.jff` file holds.
///
/// JFLAP writes this in a `<type>` element, and it is the first thing worth reading — a
/// Turing machine parsed as a finite automaton would produce a plausible and wrong result
/// rather than an error.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Structure {
    /// A finite automaton. The one Kleene reads.
    FiniteAutomaton,
    /// A pushdown automaton.
    Pushdown,
    /// A Turing machine, of one tape or several.
    Turing,
    /// A grammar.
    Grammar,
    /// A regular expression, which JFLAP also stores as a structure.
    RegularExpression,
    /// A Mealy or Moore machine.
    Transducer,
    /// Something this build has not heard of.
    Unknown(String),
}

impl Structure {
    /// Read JFLAP's `<type>` text.
    fn parse(text: &str) -> Self {
        match text.trim() {
            "fa" => Self::FiniteAutomaton,
            "pda" => Self::Pushdown,
            "turing" | "turing-bb" | "multi-tape-turing" => Self::Turing,
            "grammar" => Self::Grammar,
            "re" => Self::RegularExpression,
            "mealy" | "moore" => Self::Transducer,
            other => Self::Unknown(other.to_string()),
        }
    }

    /// How the message names it, as a noun phrase that reads inside a sentence.
    fn describe(&self) -> String {
        match self {
            Self::FiniteAutomaton => "a finite automaton".to_string(),
            Self::Pushdown => "a pushdown automaton".to_string(),
            Self::Turing => "a Turing machine".to_string(),
            Self::Grammar => "a grammar".to_string(),
            Self::RegularExpression => "a regular expression".to_string(),
            Self::Transducer => "a Mealy or Moore machine".to_string(),
            Self::Unknown(kind) => format!("a JFLAP structure of type `{kind}`"),
        }
    }
}

/// Where a state sat in JFLAP, in JFLAP's coordinates.
///
/// Kept beside the machine rather than inside it: `kleene-core` does not know what a pixel is,
/// and JFLAP's coordinate space is one more thing it should not have to have an opinion about.
/// The caller decides what to do with these — the editor uses them directly, because JFLAP's
/// axes run the same way as a screen's, and a re-layout would throw away exactly the
/// arrangement the person spent their time on.
pub type Positions = Vec<(StateId, f64, f64)>;

/// What a `.jff` file turned out to hold.
#[derive(Clone, Debug, PartialEq)]
pub struct Imported {
    /// The machine.
    pub automaton: Automaton,
    /// Where its states sat, in JFLAP's coordinates.
    pub layout: Positions,
    /// Anything the file said that Kleene had to drop.
    ///
    /// Not errors — the import succeeded. These are for telling someone what changed, because
    /// a silent difference between what they drew and what they see is worse than a sentence.
    pub notes: Vec<String>,
}

/// Read a JFLAP `.jff` file.
///
/// ```
/// use kleene_core::io::jff::from_jff;
///
/// let file = r#"<structure><type>fa</type><automaton>
///   <state id="0" name="q0"><x>50</x><y>60</y><initial/></state>
///   <state id="1" name="q1"><x>150</x><y>60</y><final/></state>
///   <transition><from>0</from><to>1</to><read>a</read></transition>
/// </automaton></structure>"#;
///
/// let imported = from_jff(file).unwrap();
/// assert_eq!(imported.automaton.state_count(), 2);
/// // JFLAP writes no alphabet; it is inferred from what the transitions read.
/// assert_eq!(imported.automaton.alphabet, vec!["a".to_string()]);
/// ```
///
/// # Errors
///
/// Fails if the text is not a JFLAP document, if it holds a structure Kleene does not model,
/// or if it holds a finite automaton with no states.
pub fn from_jff(text: &str) -> Result<Imported, JffError> {
    let document =
        roxmltree::Document::parse(text).map_err(|e| JffError::NotJflap(e.to_string()))?;
    let root = document.root_element();

    if root.tag_name().name() != "structure" {
        return Err(JffError::NotJflap(format!(
            "the root element is `{}`, not `structure`",
            root.tag_name().name()
        )));
    }

    // The type first, always. A Turing machine parsed as a finite automaton would produce a
    // plausible and wrong machine rather than an error, which is the worst of the outcomes
    // available here.
    let kind = child_text(root, "type")
        .map_or(Structure::Unknown(String::new()), |t| Structure::parse(&t));
    if kind != Structure::FiniteAutomaton {
        return Err(JffError::Unsupported(kind));
    }

    let machine = root
        .children()
        .find(|n| n.has_tag_name("automaton"))
        .ok_or_else(|| JffError::Malformed("it has no <automaton> element".to_string()))?;

    let mut states: IndexMap<StateId, State> = IndexMap::new();
    let mut layout: Positions = Vec::new();
    let mut notes: Vec<String> = Vec::new();
    let mut start: Option<StateId> = None;

    for node in machine.children().filter(|n| n.has_tag_name("state")) {
        let Some(id) = node.attribute("id").and_then(|v| v.parse::<StateId>().ok()) else {
            notes.push("A state with no usable id was skipped.".to_string());
            continue;
        };

        // JFLAP allows an unnamed state; it draws those as `qN`. Doing the same keeps the
        // imported machine looking like the one the person remembers.
        let label = node
            .attribute("name")
            .map(str::to_string)
            .filter(|name| !name.is_empty())
            .unwrap_or_else(|| format!("q{id}"));

        let mut state = State::new(label);
        state.accepting = node.children().any(|c| c.has_tag_name("final"));
        states.insert(id, state);

        if node.children().any(|c| c.has_tag_name("initial")) {
            // JFLAP's editor allows only one initial state, but a hand-edited file can carry
            // several. The first wins and the rest are reported, rather than the last silently
            // winning because it was written last.
            if start.is_none() {
                start = Some(id);
            } else {
                notes.push(
                    "The file marked more than one start state; the first one was used."
                        .to_string(),
                );
            }
        }

        if let (Some(x), Some(y)) = (number(node, "x"), number(node, "y")) {
            layout.push((id, x, y));
        }
    }

    if states.is_empty() {
        return Err(JffError::Malformed("it contains no states".to_string()));
    }

    let mut transitions = Vec::new();
    let mut alphabet: BTreeSet<String> = BTreeSet::new();

    for node in machine.children().filter(|n| n.has_tag_name("transition")) {
        let from = child_text(node, "from").and_then(|v| v.parse::<StateId>().ok());
        let to = child_text(node, "to").and_then(|v| v.parse::<StateId>().ok());

        let (Some(from), Some(to)) = (from, to) else {
            notes.push("A transition with no usable endpoints was skipped.".to_string());
            continue;
        };
        if !states.contains_key(&from) || !states.contains_key(&to) {
            notes.push("A transition to a state that does not exist was skipped.".to_string());
            continue;
        }

        // An **absent or empty** `<read>` is JFLAP's ε. That is the single most important
        // line in this file: reading it as a symbol named "" would produce a machine whose
        // alphabet contains the empty string, which is not a thing.
        let symbol = child_text(node, "read").filter(|s| !s.is_empty());

        if let Some(symbol) = &symbol {
            alphabet.insert(symbol.clone());
        }
        transitions.push(Transition {
            from,
            to,
            on: symbol,
        });
    }

    let start = start.unwrap_or_else(|| {
        notes.push("The file marked no start state; the first state was used.".to_string());
        *states.keys().next().expect("checked non-empty above")
    });

    Ok(Imported {
        automaton: Automaton {
            alphabet: alphabet.into_iter().collect(),
            states,
            start,
            transitions,
        },
        layout,
        notes,
    })
}

/// The text of the first child with this name, trimmed.
fn child_text<'a>(node: roxmltree::Node<'a, 'a>, name: &str) -> Option<String> {
    node.children()
        .find(|c| c.has_tag_name(name))
        .map(|c| c.text().unwrap_or_default().trim().to_string())
}

/// A numeric child, if it parses. JFLAP writes coordinates as doubles.
fn number(node: roxmltree::Node<'_, '_>, name: &str) -> Option<f64> {
    child_text(node, name)?.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A finite automaton as JFLAP writes one, tabs and all.
    const ENDS_WITH_AB: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!--Created with JFLAP 7.1.-->
<structure>
	<type>fa</type>
	<automaton>
		<state id="0" name="q0">
			<x>90.0</x>
			<y>130.0</y>
			<initial/>
		</state>
		<state id="1" name="q1">
			<x>186.0</x>
			<y>130.0</y>
		</state>
		<state id="2" name="q2">
			<x>282.0</x>
			<y>130.0</y>
			<final/>
		</state>
		<transition><from>0</from><to>1</to><read>a</read></transition>
		<transition><from>0</from><to>0</to><read>b</read></transition>
		<transition><from>1</from><to>2</to><read>b</read></transition>
		<transition><from>1</from><to>1</to><read>a</read></transition>
	</automaton>
</structure>"#;

    #[test]
    fn reads_a_finite_automaton() {
        let imported = from_jff(ENDS_WITH_AB).expect("reads");

        assert_eq!(imported.automaton.state_count(), 3);
        assert_eq!(imported.automaton.start, 0);
        assert!(imported.automaton.state(2).expect("exists").accepting);
        assert!(!imported.automaton.state(1).expect("exists").accepting);
        assert!(imported.notes.is_empty(), "{:?}", imported.notes);
    }

    #[test]
    fn infers_the_alphabet_from_the_transitions() {
        // JFLAP has no Σ. A machine over {a, b} that uses only `a` imports as a machine over
        // {a}, and there is nothing in the file to recover the rest from.
        let imported = from_jff(ENDS_WITH_AB).expect("reads");
        assert_eq!(imported.automaton.alphabet, vec!["a", "b"]);
    }

    #[test]
    fn keeps_the_arrangement_the_person_made() {
        // The point of importing rather than re-drawing. JFLAP's axes run the same way as a
        // screen's, so the numbers carry across untouched.
        let imported = from_jff(ENDS_WITH_AB).expect("reads");
        assert_eq!(
            imported.layout,
            vec![(0, 90.0, 130.0), (1, 186.0, 130.0), (2, 282.0, 130.0)]
        );
    }

    #[test]
    fn an_empty_read_is_an_epsilon_transition() {
        // The most important line in the module. Read as a symbol, it would produce a machine
        // whose alphabet contains the empty string.
        let file = r#"<structure><type>fa</type><automaton>
            <state id="0" name="q0"><initial/></state>
            <state id="1" name="q1"><final/></state>
            <transition><from>0</from><to>1</to><read/></transition>
        </automaton></structure>"#;

        let imported = from_jff(file).expect("reads");
        assert!(imported.automaton.alphabet.is_empty(), "ε is not a symbol");
        assert!(imported.automaton.has_epsilon());
    }

    #[test]
    fn a_missing_read_element_is_also_epsilon() {
        let file = r#"<structure><type>fa</type><automaton>
            <state id="0" name="q0"><initial/></state>
            <state id="1" name="q1"><final/></state>
            <transition><from>0</from><to>1</to></transition>
        </automaton></structure>"#;

        assert!(from_jff(file).expect("reads").automaton.has_epsilon());
    }

    #[test]
    fn every_structure_kleene_does_not_model_is_named_precisely() {
        // Task E3. The person opening one of these is exactly the user being courted, and the
        // message is a first impression — so it says what the file *is*, not what the parser
        // did not expect.
        for (kind, expected) in [
            ("pda", "a pushdown automaton"),
            ("turing", "a Turing machine"),
            ("grammar", "a grammar"),
            ("re", "a regular expression"),
            ("moore", "a Mealy or Moore machine"),
        ] {
            let file = format!("<structure><type>{kind}</type></structure>");
            let error = from_jff(&file).expect_err("should refuse");

            let message = error.to_string();
            assert!(message.contains(expected), "{kind}: {message}");
            // And it says what Kleene *does* read, because "no" without "but" sends someone
            // away for good.
            assert!(message.contains("finite automata"), "{kind}: {message}");
        }
    }

    #[test]
    fn an_unfamiliar_structure_is_still_refused_by_name() {
        let file = "<structure><type>pumping-lemma</type></structure>";
        let message = from_jff(file).expect_err("refuses").to_string();
        assert!(message.contains("pumping-lemma"), "{message}");
    }

    #[test]
    fn a_file_that_is_not_jflap_says_so() {
        assert!(matches!(
            from_jff("not xml at all"),
            Err(JffError::NotJflap(_))
        ));
        assert!(matches!(
            from_jff("<html><body>hello</body></html>"),
            Err(JffError::NotJflap(_))
        ));
    }

    #[test]
    fn an_automaton_with_no_states_is_refused() {
        let file = "<structure><type>fa</type><automaton></automaton></structure>";
        assert!(matches!(from_jff(file), Err(JffError::Malformed(_))));
    }

    #[test]
    fn a_dangling_transition_is_dropped_and_reported() {
        // Not fatal. A file with one bad edge still holds a machine worth opening, and the
        // note is what stops the difference being silent.
        let file = r#"<structure><type>fa</type><automaton>
            <state id="0" name="q0"><initial/></state>
            <transition><from>0</from><to>99</to><read>a</read></transition>
        </automaton></structure>"#;

        let imported = from_jff(file).expect("still reads");
        assert!(imported.automaton.transitions.is_empty());
        assert_eq!(imported.notes.len(), 1);
        assert!(
            imported.notes[0].contains("does not exist"),
            "{:?}",
            imported.notes
        );
    }

    #[test]
    fn a_file_with_no_start_state_gets_one_and_is_told() {
        let file = r#"<structure><type>fa</type><automaton>
            <state id="7" name="only"><final/></state>
        </automaton></structure>"#;

        let imported = from_jff(file).expect("reads");
        assert_eq!(imported.automaton.start, 7);
        assert!(
            imported.notes[0].contains("no start state"),
            "{:?}",
            imported.notes
        );
    }

    #[test]
    fn the_first_of_several_start_states_wins_and_is_reported() {
        // JFLAP's editor allows only one, but a hand-edited file can carry several. The last
        // one winning silently — because it was written last — is the trap avoided here.
        let file = r#"<structure><type>fa</type><automaton>
            <state id="0" name="a"><initial/></state>
            <state id="1" name="b"><initial/></state>
        </automaton></structure>"#;

        let imported = from_jff(file).expect("reads");
        assert_eq!(imported.automaton.start, 0);
        assert!(imported.notes[0].contains("more than one start state"));
    }

    #[test]
    fn state_ids_do_not_have_to_start_at_zero_or_be_contiguous() {
        // JFLAP's ids are whatever survived the user's editing session.
        let file = r#"<structure><type>fa</type><automaton>
            <state id="4" name="q4"><initial/></state>
            <state id="9" name="q9"><final/></state>
            <transition><from>4</from><to>9</to><read>x</read></transition>
        </automaton></structure>"#;

        let imported = from_jff(file).expect("reads");
        assert_eq!(imported.automaton.start, 4);
        assert!(imported.automaton.state(9).expect("exists").accepting);
    }

    #[test]
    fn an_unnamed_state_is_named_the_way_jflap_draws_it() {
        let file = r#"<structure><type>fa</type><automaton>
            <state id="3"><initial/></state>
        </automaton></structure>"#;

        let imported = from_jff(file).expect("reads");
        assert_eq!(imported.automaton.state(3).expect("exists").label, "q3");
    }

    #[test]
    fn an_imported_machine_is_one_the_rest_of_the_engine_accepts() {
        // The real test of an importer: not that it parsed, but that what it produced can be
        // used. An import that validates and then cannot be determinized is not an import.
        let imported = from_jff(ENDS_WITH_AB).expect("reads");
        assert!(!imported.automaton.validate().has_errors());

        let dfa = crate::convert::determinize(&imported.automaton).result;
        assert_eq!(dfa.determinism(), crate::automaton::Determinism::Dfa);
    }
}
