//! Checking that an automaton makes sense, and saying so usefully.
//!
//! Two kinds of problem live here and they are deliberately not the same thing:
//!
//! - **Errors** mean the machine is malformed — a transition to a state that does not exist,
//!   a symbol outside the alphabet. Algorithms may not run on these.
//! - **Warnings** mean the machine is well-formed but probably not what was meant — a state
//!   nothing reaches, no accepting states at all, a missing transition. These are normal
//!   *while editing*, and blocking on them would make the editor unusable.
//!
//! Every problem names the states and transitions it concerns, because the editor's
//! validation strip is click-to-focus (Phase 2 E3): the point is not to tell a student that
//! something is wrong, it is to put their cursor on it.

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::automaton::{Automaton, StateId};

/// How much a problem matters.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "Severity")
)]
#[serde(rename_all = "kebab-case")]
pub enum Severity {
    /// The machine is malformed. Algorithms must not run.
    Error,
    /// Well-formed, but likely not intended. Normal while editing.
    Warning,
}

/// What kind of problem was found.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "ProblemKind")
)]
#[serde(rename_all = "kebab-case")]
#[non_exhaustive]
pub enum ProblemKind {
    /// The start state id does not exist.
    MissingStartState,
    /// A transition refers to a state that does not exist.
    DanglingTransition,
    /// A transition reads a symbol that is not in the alphabet.
    SymbolNotInAlphabet,
    /// Two states share a label, so any explanation mentioning it is ambiguous.
    DuplicateLabel,
    /// A state cannot be reached from the start state.
    UnreachableState,
    /// No state is accepting, so the machine accepts nothing.
    NoAcceptingStates,
    /// A state has no transition for some symbol — the machine is incomplete.
    MissingTransition,
}

/// One problem found in an automaton.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "Problem")
)]
pub struct Problem {
    /// Whether this blocks algorithms or is merely suspicious.
    pub severity: Severity,
    /// What sort of problem it is, for the UI to pick an icon and a fix.
    pub kind: ProblemKind,
    /// A sentence a student can act on, naming labels rather than ids.
    pub message: String,
    /// States this concerns, so the editor can focus them.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub states: Vec<StateId>,
}

impl Problem {
    fn error(kind: ProblemKind, message: impl Into<String>, states: Vec<StateId>) -> Self {
        Self {
            severity: Severity::Error,
            kind,
            message: message.into(),
            states,
        }
    }

    fn warning(kind: ProblemKind, message: impl Into<String>, states: Vec<StateId>) -> Self {
        Self {
            severity: Severity::Warning,
            kind,
            message: message.into(),
            states,
        }
    }
}

/// Everything found wrong with an automaton.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "Report")
)]
pub struct Report {
    /// Problems, errors first.
    pub problems: Vec<Problem>,
}

impl Report {
    /// Whether any problem blocks algorithms from running.
    pub fn has_errors(&self) -> bool {
        self.problems.iter().any(|p| p.severity == Severity::Error)
    }

    /// Whether the machine is well-formed enough to run algorithms on.
    pub fn is_runnable(&self) -> bool {
        !self.has_errors()
    }

    /// Just the blocking problems.
    pub fn errors(&self) -> impl Iterator<Item = &Problem> {
        self.problems
            .iter()
            .filter(|p| p.severity == Severity::Error)
    }
}

impl Automaton {
    /// The label of a state, or a readable stand-in if the id is dangling.
    fn label_of(&self, id: StateId) -> String {
        self.state(id)
            .map_or_else(|| format!("#{id}"), |s| s.label.clone())
    }

    /// Every state reachable from the start state, following any symbol including ε.
    ///
    /// Public because dead-state pruning and the editor's "unreachable" shading both need
    /// it, and computing it twice in two places is how the two end up disagreeing.
    pub fn reachable(&self) -> BTreeSet<StateId> {
        let mut seen = BTreeSet::new();
        let mut stack = vec![self.start];

        // A plain worklist rather than recursion: an automaton can be cyclic, and cycles
        // are the normal case rather than the exception.
        while let Some(id) = stack.pop() {
            if !seen.insert(id) {
                continue;
            }
            for t in self.transitions.iter().filter(|t| t.from == id) {
                if !seen.contains(&t.to) {
                    stack.push(t.to);
                }
            }
        }

        seen
    }

    /// Check the machine, returning everything wrong with it.
    ///
    /// Never returns early. A student fixing one problem at a time, being told about the
    /// next one only after fixing the last, is a worse experience than seeing all four at
    /// once — and the editor shows them as a list, not a dialog.
    pub fn validate(&self) -> Report {
        let mut problems = Vec::new();

        // --- Errors: the machine is malformed ---

        if self.state(self.start).is_none() {
            problems.push(Problem::error(
                ProblemKind::MissingStartState,
                format!("The start state (#{}) does not exist.", self.start),
                vec![],
            ));
        }

        for t in &self.transitions {
            for (id, role) in [(t.from, "from"), (t.to, "to")] {
                if self.state(id).is_none() {
                    problems.push(Problem::error(
                        ProblemKind::DanglingTransition,
                        format!("A transition points {role} state #{id}, which does not exist."),
                        vec![id],
                    ));
                }
            }

            if let Some(symbol) = &t.on
                && !self.alphabet.contains(symbol)
            {
                problems.push(Problem::error(
                    ProblemKind::SymbolNotInAlphabet,
                    format!(
                        "The transition {} → {} reads `{symbol}`, which is not in the alphabet.",
                        self.label_of(t.from),
                        self.label_of(t.to),
                    ),
                    vec![t.from, t.to],
                ));
            }
        }

        let mut seen_labels: Vec<(&str, StateId)> = Vec::new();
        for (&id, state) in &self.states {
            if let Some(&(_, first)) = seen_labels.iter().find(|(l, _)| *l == state.label) {
                problems.push(Problem::error(
                    ProblemKind::DuplicateLabel,
                    format!(
                        "Two states are both labelled `{}`. Every explanation mentioning it \
                         would be ambiguous.",
                        state.label
                    ),
                    vec![first, id],
                ));
            } else {
                seen_labels.push((&state.label, id));
            }
        }

        // --- Warnings: well-formed, but probably not intended ---

        if !self.states.is_empty() && !self.states.values().any(|s| s.accepting) {
            problems.push(Problem::warning(
                ProblemKind::NoAcceptingStates,
                "No state is accepting, so this machine rejects every string.",
                vec![],
            ));
        }

        let reachable = self.reachable();
        let unreachable: Vec<StateId> = self
            .states
            .keys()
            .copied()
            .filter(|id| !reachable.contains(id))
            .collect();

        for id in &unreachable {
            problems.push(Problem::warning(
                ProblemKind::UnreachableState,
                format!(
                    "`{}` cannot be reached from the start state, so it can never be entered.",
                    self.label_of(*id)
                ),
                vec![*id],
            ));
        }

        // Incompleteness is reported per state rather than per (state, symbol), so a state
        // missing three symbols is one line in the editor's strip and not three.
        for (&id, _) in &self.states {
            let missing: Vec<&str> = self
                .alphabet
                .iter()
                .filter(|sym| self.transitions_from(id, Some(sym)).next().is_none())
                .map(String::as_str)
                .collect();

            if !missing.is_empty() {
                problems.push(Problem::warning(
                    ProblemKind::MissingTransition,
                    format!(
                        "`{}` has no transition on {}.",
                        self.label_of(id),
                        missing
                            .iter()
                            .map(|s| format!("`{s}`"))
                            .collect::<Vec<_>>()
                            .join(", ")
                    ),
                    vec![id],
                ));
            }
        }

        problems.sort_by_key(|p| p.severity);
        Report { problems }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::builder::AutomatonBuilder;
    use crate::examples;

    fn kinds(report: &Report) -> Vec<ProblemKind> {
        report.problems.iter().map(|p| p.kind.clone()).collect()
    }

    #[test]
    fn a_good_dfa_has_nothing_to_report() {
        let report = examples::ends_with_ab().validate();
        assert_eq!(report.problems, vec![]);
        assert!(report.is_runnable());
    }

    #[test]
    fn a_dangling_transition_is_an_error() {
        let mut a = examples::ends_with_ab();
        a.transitions.push(crate::Transition::on(0, 99, "a"));

        let report = a.validate();
        assert!(report.has_errors());
        assert!(kinds(&report).contains(&ProblemKind::DanglingTransition));
    }

    #[test]
    fn a_symbol_outside_the_alphabet_is_an_error_naming_both_states() {
        let mut a = examples::ends_with_ab();
        a.transitions.push(crate::Transition::on(0, 1, "z"));

        let report = a.validate();
        let problem = report
            .problems
            .iter()
            .find(|p| p.kind == ProblemKind::SymbolNotInAlphabet)
            .expect("reported");
        assert!(problem.message.contains("q0"), "{}", problem.message);
        assert!(problem.message.contains('z'), "{}", problem.message);
        assert_eq!(problem.states, vec![0, 1]);
    }

    #[test]
    fn a_missing_start_state_is_an_error() {
        let mut a = examples::ends_with_ab();
        a.start = 42;
        assert!(kinds(&a.validate()).contains(&ProblemKind::MissingStartState));
    }

    #[test]
    fn duplicate_labels_are_an_error_because_explanations_become_ambiguous() {
        let mut a = examples::ends_with_ab();
        a.states.get_mut(&1).expect("q1 exists").label = "q0".into();

        let report = a.validate();
        let problem = report
            .problems
            .iter()
            .find(|p| p.kind == ProblemKind::DuplicateLabel)
            .expect("reported");
        assert_eq!(
            problem.states,
            vec![0, 1],
            "both offenders must be focusable"
        );
    }

    #[test]
    fn an_unreachable_state_is_only_a_warning() {
        // Normal while editing — you place a state before wiring it up. Blocking on this
        // would make the editor unusable.
        let a = AutomatonBuilder::new(["a"])
            .accepting("q0")
            .edge("q0", "q0", "a")
            .state("orphan")
            .build();

        let report = a.validate();
        assert!(report.is_runnable(), "an orphan must not block algorithms");
        let problem = report
            .problems
            .iter()
            .find(|p| p.kind == ProblemKind::UnreachableState)
            .expect("reported");
        assert!(problem.message.contains("orphan"), "{}", problem.message);
    }

    #[test]
    fn missing_transitions_are_reported_once_per_state_not_once_per_symbol() {
        // A state missing three symbols should be one line in the editor's strip.
        let a = AutomatonBuilder::new(["a", "b", "c"])
            .accepting("q0")
            .build();

        let report = a.validate();
        let missing: Vec<_> = report
            .problems
            .iter()
            .filter(|p| p.kind == ProblemKind::MissingTransition)
            .collect();

        assert_eq!(missing.len(), 1);
        for sym in ["a", "b", "c"] {
            assert!(missing[0].message.contains(sym), "{}", missing[0].message);
        }
    }

    #[test]
    fn a_machine_with_no_accepting_states_is_warned_about() {
        let a = AutomatonBuilder::new(["a"]).edge("q0", "q0", "a").build();
        assert!(kinds(&a.validate()).contains(&ProblemKind::NoAcceptingStates));
    }

    #[test]
    fn every_problem_is_reported_not_just_the_first() {
        // Fixing one problem at a time, learning of the next only after, is worse than
        // seeing all of them — and the editor renders a list, not a dialog.
        let mut a = examples::ends_with_ab();
        a.start = 99;
        a.transitions.push(crate::Transition::on(0, 77, "a"));
        a.transitions.push(crate::Transition::on(0, 1, "z"));

        let report = a.validate();
        assert!(report.errors().count() >= 3, "{:?}", report.problems);
    }

    #[test]
    fn errors_sort_before_warnings() {
        let mut a = examples::ends_with_ab();
        a.start = 99;
        a.states.insert(50, crate::State::new("orphan"));

        let report = a.validate();
        let first = report.problems.first().expect("has problems");
        assert_eq!(first.severity, Severity::Error);
    }

    #[test]
    fn reachability_follows_epsilon_transitions_and_survives_cycles() {
        let a = AutomatonBuilder::new(["a"])
            .epsilon("q0", "q1")
            .edge("q1", "q2", "a")
            .edge("q2", "q1", "a") // cycle
            .accepting("q2")
            .build();

        assert_eq!(a.reachable(), BTreeSet::from([0, 1, 2]));
    }
}
