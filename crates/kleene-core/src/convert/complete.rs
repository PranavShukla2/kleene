//! Completion: giving every state a move on every symbol.
//!
//! A DFA drawn the way most courses draw it is *partial* — transitions that would lead
//! nowhere are simply left out. That is easier to read, and it is also not quite a DFA by the
//! strict definition, where δ is a total function.
//!
//! The distinction stops being pedantic the moment you take a complement. Swapping accepting
//! and non-accepting states only works if every string reaches *some* state; on a partial
//! machine, strings that fall off the edge are rejected before and after the swap, and the
//! complement is silently wrong. So completion is a prerequisite there, not a formality.
//!
//! It is kept separate from [`determinize`](super::determinize) because whether to *draw* the
//! trap state is a teaching preference (decision D5), and a diagram cluttered with edges into
//! a dead state is markedly harder to read than one without.

use std::collections::BTreeSet;

use crate::automaton::{Automaton, State, StateId, Transition};
use crate::trace::{Step, StepKind, Traced};

/// Add a trap state, if the machine needs one, so that δ is total.
///
/// Returns the machine unchanged when it is already complete — including when the alphabet
/// is empty, where completeness is vacuous.
///
/// ```
/// use kleene_core::{AutomatonBuilder, convert::complete};
///
/// // `q0` has no move on `b`.
/// let partial = AutomatonBuilder::new(["a", "b"])
///     .accepting("q0")
///     .edge("q0", "q0", "a")
///     .build();
/// assert!(!partial.is_complete());
///
/// let completed = complete(&partial).result;
/// assert!(completed.is_complete());
/// assert_eq!(completed.state_count(), 2); // q0 plus the trap
/// ```
pub fn complete(automaton: &Automaton) -> Traced<Automaton> {
    // Which (state, symbol) pairs are missing. Collected first so the trap state is only
    // created if it is actually needed.
    let missing: Vec<(StateId, String)> = automaton
        .states
        .keys()
        .flat_map(|&id| {
            automaton
                .alphabet
                .iter()
                .filter(move |sym| automaton.transitions_from(id, Some(sym)).next().is_none())
                .map(move |sym| (id, sym.clone()))
        })
        .collect();

    if missing.is_empty() {
        return Traced::new(
            automaton.clone(),
            vec![Step::new(
                StepKind::Note,
                "Every state already has a move on every symbol, so no trap state is needed.",
            )],
        );
    }

    let mut result = automaton.clone();

    // The next free id, rather than `len()`, since ids need not be contiguous.
    let trap = result.states.keys().copied().max().map_or(0, |m| m + 1);

    // The trap state *is* the empty subset — it stands for "the set of states you could be
    // in is empty". Recording that in `origin` is not decoration: it makes the trap behave
    // like any other subset-construction state in the UI, including hover-highlight, which
    // correctly lights up nothing.
    let mut state = State::new("∅");
    state.origin = Some(BTreeSet::new());
    result.states.insert(trap, state);

    let mut steps = vec![
        Step::new(
            StepKind::Note,
            format!(
                "{} transition{} missing, so a trap state ∅ is added. Anything that reaches it \
             can never leave, and it is not accepting — so those strings are rejected.",
                missing.len(),
                if missing.len() == 1 { " is" } else { "s are" },
            ),
        )
        .highlighting([trap]),
    ];

    for (from, symbol) in &missing {
        result
            .transitions
            .push(Transition::on(*from, trap, symbol.clone()));
        steps.push(
            Step::new(
                StepKind::Note,
                format!(
                    "{} had no move on `{symbol}`, so it now goes to ∅.",
                    label(automaton, *from),
                ),
            )
            .highlighting([*from, trap]),
        );
    }

    // The trap needs its own moves too, or completing it would leave it incomplete.
    for symbol in &automaton.alphabet {
        result
            .transitions
            .push(Transition::on(trap, trap, symbol.clone()));
    }
    steps.push(
        Step::new(
            StepKind::Note,
            "∅ loops to itself on every symbol: once the set of possible states is empty, \
             reading more input cannot make it non-empty.",
        )
        .highlighting([trap]),
    );

    Traced::new(result, steps)
}

fn label(automaton: &Automaton, id: StateId) -> String {
    automaton
        .state(id)
        .map_or_else(|| format!("#{id}"), |s| s.label.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::automaton::Determinism;
    use crate::builder::AutomatonBuilder;
    use crate::examples;

    fn partial() -> Automaton {
        AutomatonBuilder::new(["a", "b"])
            .accepting("q0")
            .edge("q0", "q0", "a")
            .build()
    }

    #[test]
    fn completing_makes_delta_total() {
        let done = complete(&partial()).result;
        assert!(done.is_complete());
    }

    #[test]
    fn the_trap_is_not_accepting() {
        let done = complete(&partial()).result;
        let trap = done
            .states
            .values()
            .find(|s| s.label == "∅")
            .expect("trap exists");
        assert!(!trap.accepting, "a trap state must reject");
    }

    #[test]
    fn the_trap_is_the_empty_subset() {
        // Not decoration: it makes the trap behave like any other subset-construction
        // state in the UI, and hover-highlight correctly lights up nothing.
        let done = complete(&partial()).result;
        let trap = done
            .states
            .values()
            .find(|s| s.label == "∅")
            .expect("trap exists");
        assert_eq!(trap.origin, Some(BTreeSet::new()));
    }

    #[test]
    fn the_trap_cannot_be_escaped() {
        let done = complete(&partial()).result;
        let trap = *done
            .states
            .iter()
            .find(|(_, s)| s.label == "∅")
            .expect("trap exists")
            .0;

        for symbol in &done.alphabet {
            let targets: Vec<_> = done
                .transitions_from(trap, Some(symbol))
                .map(|t| t.to)
                .collect();
            assert_eq!(targets, vec![trap], "∅ escaped on `{symbol}`");
        }
    }

    #[test]
    fn an_already_complete_machine_is_untouched() {
        // Idempotence matters: the editor may call this on every edit.
        let before = examples::ends_with_ab();
        let t = complete(&before);
        assert_eq!(t.result, before);
        assert!(t.steps[0].detail.contains("no trap state is needed"));
    }

    #[test]
    fn completing_twice_adds_only_one_trap() {
        let once = complete(&partial()).result;
        let twice = complete(&once).result;
        assert_eq!(once.state_count(), twice.state_count());
    }

    #[test]
    fn completion_preserves_determinism() {
        let done = complete(&partial()).result;
        assert_eq!(done.determinism(), Determinism::Dfa);
    }

    #[test]
    fn an_empty_alphabet_needs_no_trap() {
        // Vacuously complete — and creating an unreachable trap would be worse than
        // doing nothing.
        let a = AutomatonBuilder::new(Vec::<String>::new())
            .accepting("q0")
            .build();
        assert_eq!(complete(&a).result.state_count(), 1);
    }

    #[test]
    fn the_trap_id_does_not_collide_with_sparse_ids() {
        // Ids need not be contiguous — a state deleted in the editor leaves a hole, and
        // using `len()` as the next id would overwrite an existing state.
        let mut a = partial();
        let state = a.states.shift_remove(&0).expect("q0 exists");
        a.states.insert(7, state);
        a.start = 7;
        a.transitions.clear();

        let done = complete(&a).result;
        assert_eq!(done.state_count(), 2);
        assert!(
            done.state(7).is_some(),
            "the existing state was overwritten"
        );
    }

    #[test]
    fn every_missing_transition_is_explained_individually() {
        // q0 is missing `b`; the trap explanation plus one line for it, plus the self-loop
        // summary. A student should be able to see which move was missing.
        let t = complete(&partial());
        assert!(
            t.steps
                .iter()
                .any(|s| s.detail.contains("had no move on `b`"))
        );
    }

    #[test]
    fn the_result_validates() {
        let report = complete(&partial()).result.validate();
        assert!(!report.has_errors(), "{:?}", report.problems);
    }
}
