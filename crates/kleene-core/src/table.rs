//! δ written out, and the formal definition it belongs to.
//!
//! Roadmap §2.4a: a finite automaton is taught in three notations — the diagram, the transition
//! table, and the tuple `M = (Q, Σ, δ, q₀, F)` — and converting between them by hand is itself
//! an examined skill. The table is not a view of the diagram. It is δ, and the diagram is a
//! picture of δ.
//!
//! ## Why this is in the core and not in the frontend
//!
//! Grouping transitions by `(from, symbol)` is four lines of TypeScript, so the reason is not
//! difficulty. It is that three of the decisions below are *semantic*, not presentational:
//!
//! - whether an ε column exists at all,
//! - what an empty cell means — no move, written `∅`, versus a move nobody has drawn yet,
//! - and which glyph stands for the empty string, which [`Notation`] owns under decision D7.
//!
//! Answering those in the frontend would put half the definition of δ in the layer that is
//! meant to be drawing it, and the CLI and the TikZ exporter would each need their own answer.

use serde::{Deserialize, Serialize};

use crate::automaton::{Automaton, StateId};
use crate::notation::Notation;

/// One row of the table: a state, and where it goes on each symbol.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "TableRow")
)]
pub struct TableRow {
    /// The state this row is about.
    pub state: StateId,
    /// Its label, so the table reads without a second lookup.
    pub label: String,
    /// Whether it is the start state — the `→` in a printed table.
    pub start: bool,
    /// Whether it accepts — the `*` in a printed table.
    pub accepting: bool,
    /// One cell per column, in column order. Each holds the states reached on that symbol.
    pub cells: Vec<Vec<StateId>>,
}

/// A column of the table: one symbol, or the ε column.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "TableColumn")
)]
pub struct TableColumn {
    /// The heading, already rendered through [`Notation`] — `a`, or `ε`, or `λ`.
    pub heading: String,
    /// The symbol this column reads. `None` is the ε column.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[cfg_attr(feature = "ts", ts(optional))]
    pub symbol: Option<String>,
}

/// δ as a table.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "TransitionTable")
)]
pub struct TransitionTable {
    /// Σ in declared order, with an ε column appended when the machine has ε-transitions.
    pub columns: Vec<TableColumn>,
    /// One row per state, in document order.
    pub rows: Vec<TableRow>,
    /// Whether every cell has at least one target — the machine is a *total* function.
    ///
    /// Worth stating rather than making the reader scan for gaps: a DFA is usually defined
    /// with δ total, and an incomplete table is the most common reason a machine that looks
    /// finished rejects a string its author expected it to accept.
    pub complete: bool,
}

/// The formal definition, `M = (Q, Σ, δ, q₀, F)`.
///
/// δ is deliberately absent: it is the table, and restating it here would be a second copy
/// that could disagree with the first.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "FormalDefinition")
)]
pub struct FormalDefinition {
    /// Q — every state, by label.
    pub states: Vec<String>,
    /// Σ — the alphabet. ε is never a member, however the machine uses it.
    pub alphabet: Vec<String>,
    /// q₀ — the start state's label, or the empty-set glyph if the id dangles.
    pub start: String,
    /// F — the accepting states, by label. May legitimately be empty.
    pub accepting: Vec<String>,
}

impl Automaton {
    /// δ, written out as a table.
    ///
    /// Columns follow Σ in the order it was declared, not sorted — the alphabet is a sequence
    /// the author chose, and reordering it would make the table disagree with the alphabet
    /// panel next to it.
    ///
    /// The ε column appears only when the machine actually has ε-transitions. A permanent ε
    /// column on a DFA is a column of empty cells that asks the reader to wonder what it is
    /// for, and it makes a printed DFA table wider than the one in their textbook.
    ///
    /// ```
    /// use kleene_core::{examples, notation::Notation};
    ///
    /// let table = examples::ends_with_ab().transition_table(Notation::default());
    /// assert_eq!(table.columns.len(), 2);           // a, b — no ε column
    /// assert_eq!(table.rows.len(), 3);
    /// assert!(table.complete);                      // a DFA with every move defined
    /// ```
    pub fn transition_table(&self, notation: Notation) -> TransitionTable {
        let mut columns: Vec<TableColumn> = self
            .alphabet
            .iter()
            .map(|symbol| TableColumn {
                heading: symbol.clone(),
                symbol: Some(symbol.clone()),
            })
            .collect();

        if self.has_epsilon() {
            columns.push(TableColumn {
                heading: notation.empty_string().to_string(),
                symbol: None,
            });
        }

        let rows: Vec<TableRow> = self
            .states
            .iter()
            .map(|(&id, state)| TableRow {
                state: id,
                label: state.label.clone(),
                start: self.start == id,
                accepting: state.accepting,
                cells: columns
                    .iter()
                    .map(|column| {
                        // One entry per target, however many transitions produced it — the
                        // same collapsing the diagram does, so the two views agree about how
                        // many arrows there are.
                        let mut targets: Vec<StateId> = self
                            .transitions_from(id, column.symbol.as_deref())
                            .map(|t| t.to)
                            .collect();
                        targets.sort_unstable();
                        targets.dedup();
                        targets
                    })
                    .collect(),
            })
            .collect();

        // Completeness is about Σ only. An empty ε column does not make a machine incomplete —
        // it makes it a machine without ε-transitions, which is the normal case.
        let symbol_columns = self.alphabet.len();
        let complete = !rows.is_empty()
            && rows
                .iter()
                .all(|row| row.cells.iter().take(symbol_columns).all(|c| !c.is_empty()));

        TransitionTable {
            columns,
            rows,
            complete,
        }
    }

    /// The 5-tuple, with δ left to [`Automaton::transition_table`].
    pub fn formal_definition(&self, notation: Notation) -> FormalDefinition {
        FormalDefinition {
            states: self.states.values().map(|s| s.label.clone()).collect(),
            alphabet: self.alphabet.to_vec(),
            start: self
                .state(self.start)
                .map_or_else(|| notation.empty_set().to_string(), |s| s.label.clone()),
            accepting: self
                .states
                .values()
                .filter(|s| s.accepting)
                .map(|s| s.label.clone())
                .collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::builder::AutomatonBuilder;
    use crate::notation::Notation;

    /// An ε-NFA: q0 -ε-> q1 -a-> q1, q1 accepting.
    fn with_epsilon() -> Automaton {
        AutomatonBuilder::new(["a"])
            .state("q0")
            .accepting("q1")
            .start("q0")
            .epsilon("q0", "q1")
            .edge("q1", "q1", "a")
            .build()
    }

    #[test]
    fn columns_follow_the_declared_alphabet_order() {
        // Not sorted. The alphabet is a sequence its author chose, and reordering it here
        // would make the table disagree with the alphabet panel beside it.
        let machine = AutomatonBuilder::new(["b", "a"])
            .state("q0")
            .start("q0")
            .build();

        let table = machine.transition_table(Notation::default());
        let headings: Vec<&str> = table.columns.iter().map(|c| c.heading.as_str()).collect();
        assert_eq!(headings, ["b", "a"]);
    }

    #[test]
    fn there_is_no_epsilon_column_without_epsilon_transitions() {
        // A permanent ε column on a DFA is a column of empty cells that asks the reader to
        // wonder what it is for, and makes a printed table wider than the textbook's.
        let table = crate::examples::ends_with_ab().transition_table(Notation::default());
        assert!(table.columns.iter().all(|c| c.symbol.is_some()));
    }

    #[test]
    fn the_epsilon_column_appears_when_it_is_needed_and_uses_the_notation() {
        let table = with_epsilon().transition_table(Notation::LAMBDA);
        let last = table.columns.last().expect("a column");

        assert_eq!(last.symbol, None);
        assert_eq!(last.heading, "λ");
    }

    #[test]
    fn a_cell_holds_every_target_once() {
        // Two transitions to the same state on the same symbol are one arrow on the diagram,
        // so they must be one entry here — otherwise the two views disagree about how many
        // moves there are.
        let machine = AutomatonBuilder::new(["a"])
            .state("q0")
            .state("q1")
            .start("q0")
            .edge("q0", "q1", "a")
            .edge("q0", "q1", "a")
            .build();

        let table = machine.transition_table(Notation::default());
        assert_eq!(table.rows[0].cells[0], vec![1]);
    }

    #[test]
    fn a_nondeterministic_cell_holds_several_targets() {
        let machine = AutomatonBuilder::new(["a"])
            .state("q0")
            .state("q1")
            .state("q2")
            .start("q0")
            .edge("q0", "q1", "a")
            .edge("q0", "q2", "a")
            .build();

        assert_eq!(
            machine.transition_table(Notation::default()).rows[0].cells[0],
            vec![1, 2]
        );
    }

    #[test]
    fn rows_carry_the_start_and_accepting_marks() {
        let table = crate::examples::ends_with_ab().transition_table(Notation::default());

        assert!(table.rows[0].start);
        assert_eq!(table.rows.iter().filter(|r| r.accepting).count(), 1);
        assert_eq!(table.rows.iter().filter(|r| r.start).count(), 1);
    }

    #[test]
    fn completeness_ignores_the_epsilon_column() {
        // An empty ε column does not make a machine incomplete; it makes it a machine without
        // ε-transitions, which is the normal case. Here the ε column is *populated* and the
        // `a` column is not, so the machine is genuinely incomplete.
        let table = with_epsilon().transition_table(Notation::default());
        assert!(!table.complete, "q0 has no move on `a`");
    }

    #[test]
    fn a_complete_dfa_says_so() {
        assert!(
            crate::examples::ends_with_ab()
                .transition_table(Notation::default())
                .complete
        );
    }

    #[test]
    fn an_empty_machine_is_not_complete() {
        // Vacuous truth would say yes. "This machine with no states has a total transition
        // function" is technically defensible and useless to a student staring at a blank
        // canvas, so an empty machine reports incomplete.
        let table = Automaton::default().transition_table(Notation::default());
        assert!(!table.complete);
    }

    #[test]
    fn the_formal_definition_names_every_component() {
        let definition = crate::examples::ends_with_ab().formal_definition(Notation::default());

        assert_eq!(definition.states.len(), 3);
        assert_eq!(definition.alphabet, vec!["a", "b"]);
        assert_eq!(definition.start, "q0");
        assert_eq!(definition.accepting, vec!["q2"]);
    }

    #[test]
    fn epsilon_is_never_a_member_of_the_alphabet() {
        // However the machine uses ε, it is not a symbol. A tuple that listed it would be
        // wrong in a way a student would be marked down for copying.
        let definition = with_epsilon().formal_definition(Notation::default());
        assert_eq!(definition.alphabet, vec!["a"]);
    }

    #[test]
    fn a_dangling_start_state_shows_the_empty_set_rather_than_panicking() {
        let mut machine = crate::examples::ends_with_ab();
        machine.start = 99;

        assert_eq!(machine.formal_definition(Notation::default()).start, "∅");
    }
}
