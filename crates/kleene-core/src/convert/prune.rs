//! Pruning: removing states that cannot affect the language.
//!
//! Two separate defects, often conflated:
//!
//! - **Unreachable** — no string gets you there from the start state. Usually left over from
//!   editing, and harmless but confusing.
//! - **Dead** (not *co-reachable*) — you can get there, but no continuation from it ever
//!   reaches an accepting state. The trap state added by
//!   [`complete`](fn@super::complete) is the canonical example.
//!
//! A state is **useful** only if it is both. Removing the rest changes nothing about the
//! language and makes the diagram considerably easier to read, which is why this runs before
//! `to_regex` — state elimination over dead states produces enormous expressions describing
//! paths that never accept anything.
//!
//! Note that pruning is *not* minimization. It deletes states that do no work; minimization
//! merges states that do the *same* work. A machine can be fully pruned and still far from
//! minimal.

use std::collections::{BTreeSet, HashMap};

use indexmap::IndexMap;

use crate::automaton::{Automaton, StateId, Transition};
use crate::trace::{Step, StepKind, Traced};

/// States from which some accepting state is reachable.
///
/// The mirror of [`Automaton::reachable`]: a reverse traversal seeded with every accepting
/// state. Public because the editor shades dead states, and a second implementation would
/// eventually disagree with this one.
pub fn co_reachable(automaton: &Automaton) -> BTreeSet<StateId> {
    let mut incoming: HashMap<StateId, Vec<StateId>> = HashMap::new();
    for t in &automaton.transitions {
        incoming.entry(t.to).or_default().push(t.from);
    }

    let mut seen: BTreeSet<StateId> = automaton
        .states
        .iter()
        .filter(|(_, s)| s.accepting)
        .map(|(&id, _)| id)
        .collect();
    let mut stack: Vec<StateId> = seen.iter().copied().collect();

    while let Some(id) = stack.pop() {
        for &prev in incoming.get(&id).map(Vec::as_slice).unwrap_or_default() {
            if seen.insert(prev) {
                stack.push(prev);
            }
        }
    }

    seen
}

/// Remove every state that is unreachable or dead.
///
/// The start state always survives, even when it is dead. A machine with no states is not
/// representable, and a single non-accepting start state is the correct way to write the
/// empty language.
///
/// ```
/// use kleene_core::{AutomatonBuilder, convert::prune};
///
/// let messy = AutomatonBuilder::new(["a"])
///     .accepting("q0")
///     .edge("q0", "q0", "a")
///     .state("orphan")          // unreachable
///     .edge("q0", "sink", "a")  // reachable, but never accepts
///     .build();
///
/// assert_eq!(prune(&messy).result.state_count(), 1);
/// ```
pub fn prune(automaton: &Automaton) -> Traced<Automaton> {
    let reachable = automaton.reachable();
    let alive = co_reachable(automaton);

    let mut keep: BTreeSet<StateId> = automaton
        .states
        .keys()
        .copied()
        .filter(|id| reachable.contains(id) && alive.contains(id))
        .collect();

    // Without this the empty language would have nowhere to live.
    keep.insert(automaton.start);

    let removed: Vec<StateId> = automaton
        .states
        .keys()
        .copied()
        .filter(|id| !keep.contains(id))
        .collect();

    if removed.is_empty() {
        return Traced::new(
            automaton.clone(),
            vec![Step::new(
                StepKind::Note,
                "Every state is reachable and can still lead to an accepting state, so \
                 nothing is removed.",
            )],
        );
    }

    let mut steps = Vec::new();
    for &id in &removed {
        let label = automaton
            .state(id)
            .map_or_else(|| format!("#{id}"), |s| s.label.clone());

        // Naming *which* defect it is matters: they have different causes and different
        // fixes, and "removed 3 states" teaches nothing.
        steps.push(
            Step::new(
                StepKind::Note,
                match (reachable.contains(&id), alive.contains(&id)) {
                    (false, true) => format!(
                        "{label} cannot be reached from the start state, so no string ever \
                         enters it. Removed."
                    ),
                    (true, false) => format!(
                        "{label} can be entered, but no continuation from it ever reaches an \
                         accepting state, so every string passing through it is rejected \
                         anyway. Removed."
                    ),
                    _ => format!(
                        "{label} is neither reachable nor able to lead anywhere accepting. \
                         Removed."
                    ),
                },
            )
            .highlighting([id]),
        );
    }

    // Renumber into a dense 0..n range, in the original relative order. Sparse ids are
    // legal but leak into exports and labels, and a pruned machine is a good moment to tidy.
    let remap: HashMap<StateId, StateId> = automaton
        .states
        .keys()
        .filter(|id| keep.contains(id))
        .enumerate()
        .map(|(new, &old)| (old, new as StateId))
        .collect();

    let mut states = IndexMap::with_capacity(remap.len());
    for (&old, state) in &automaton.states {
        if let Some(&new) = remap.get(&old) {
            states.insert(new, state.clone());
        }
    }

    let transitions: Vec<Transition> = automaton
        .transitions
        .iter()
        .filter_map(|t| {
            Some(Transition {
                from: *remap.get(&t.from)?,
                to: *remap.get(&t.to)?,
                on: t.on.clone(),
            })
        })
        .collect();

    steps.push(Step::new(
        StepKind::Note,
        format!(
            "{} of {} states removed; {} remain.",
            removed.len(),
            automaton.state_count(),
            states.len()
        ),
    ));

    let pruned = Automaton {
        alphabet: automaton.alphabet.clone(),
        states,
        start: *remap.get(&automaton.start).unwrap_or(&0),
        transitions,
    };

    Traced::new(pruned, steps)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::builder::AutomatonBuilder;
    use crate::convert::complete::complete;
    use crate::examples;

    #[test]
    fn a_tidy_machine_is_left_alone() {
        let before = examples::ends_with_ab();
        let t = prune(&before);
        assert_eq!(t.result, before);
        assert!(t.steps[0].detail.contains("nothing is removed"));
    }

    #[test]
    fn a_state_that_is_only_unreachable_is_described_as_unreachable() {
        // `orphan` leads to an accepting state, so it is co-reachable — its *only* defect
        // is that nothing reaches it. Isolating the branches matters: an orphan with both
        // defects would take a different path and this test would prove nothing about
        // unreachability.
        let a = AutomatonBuilder::new(["a"])
            .accepting("q0")
            .edge("q0", "q0", "a")
            .edge("orphan", "q0", "a")
            .build();

        let t = prune(&a);
        assert_eq!(t.result.state_count(), 1);

        let reason = t
            .steps
            .iter()
            .find(|s| s.detail.contains("orphan"))
            .expect("orphan explained");
        assert!(
            reason.detail.contains("cannot be reached"),
            "{}",
            reason.detail
        );
    }

    #[test]
    fn a_state_with_both_defects_says_so_rather_than_picking_one() {
        // An isolated state is neither reachable nor able to reach an accepting state.
        // Reporting only half of that would be a half-truth a student could act on wrongly.
        let a = AutomatonBuilder::new(["a"])
            .accepting("q0")
            .edge("q0", "q0", "a")
            .state("isolated")
            .build();

        let reason = prune(&a)
            .steps
            .iter()
            .find(|s| s.detail.contains("isolated"))
            .expect("explained")
            .detail
            .clone();
        assert!(reason.contains("neither"), "{reason}");
    }

    #[test]
    fn dead_states_go_and_are_described_as_dead_not_unreachable() {
        // The two defects have different causes and different fixes, so the explanation
        // must distinguish them.
        let a = AutomatonBuilder::new(["a"])
            .accepting("q0")
            .edge("q0", "q0", "a")
            .edge("q0", "sink", "a")
            .build();

        let t = prune(&a);
        let reason = t
            .steps
            .iter()
            .find(|s| s.detail.contains("sink"))
            .expect("sink explained");
        assert!(
            reason.detail.contains("can be entered"),
            "{}",
            reason.detail
        );
    }

    #[test]
    fn pruning_removes_the_trap_that_completion_added() {
        // These two are exact opposites, which makes them a good pair to check.
        let partial = AutomatonBuilder::new(["a", "b"])
            .accepting("q0")
            .edge("q0", "q0", "a")
            .build();

        let completed = complete(&partial).result;
        assert_eq!(completed.state_count(), 2);
        assert_eq!(prune(&completed).result.state_count(), 1);
    }

    #[test]
    fn the_start_state_survives_even_when_dead() {
        // A machine with no states is not representable, and a lone non-accepting start
        // state is the correct way to write the empty language.
        let a = AutomatonBuilder::new(["a"]).state("q0").build();
        let pruned = prune(&a).result;

        assert_eq!(pruned.state_count(), 1);
        assert!(!pruned.state(pruned.start).expect("start exists").accepting);
    }

    #[test]
    fn surviving_states_are_renumbered_densely() {
        // Sparse ids are legal but leak into exports and labels.
        let a = AutomatonBuilder::new(["a"])
            .state("q0")
            .state("orphan")
            .accepting("q2")
            .edge("q0", "q2", "a")
            .build();

        let pruned = prune(&a).result;
        let ids: Vec<StateId> = pruned.states.keys().copied().collect();
        assert_eq!(ids, vec![0, 1]);
    }

    #[test]
    fn transitions_are_remapped_not_dropped() {
        let a = AutomatonBuilder::new(["a"])
            .state("q0")
            .state("orphan")
            .accepting("q2")
            .edge("q0", "q2", "a")
            .build();

        let pruned = prune(&a).result;
        assert_eq!(pruned.transitions.len(), 1);
        assert!(
            !pruned.validate().has_errors(),
            "remapping left a dangling id"
        );
    }

    #[test]
    fn the_start_state_is_remapped_correctly() {
        let mut a = AutomatonBuilder::new(["a"])
            .state("orphan")
            .accepting("real")
            .edge("real", "real", "a")
            .build();
        a.start = 1; // "real"

        let pruned = prune(&a).result;
        assert_eq!(
            pruned.state(pruned.start).expect("start exists").label,
            "real"
        );
    }

    #[test]
    fn pruning_is_idempotent() {
        let a = AutomatonBuilder::new(["a"])
            .accepting("q0")
            .edge("q0", "q0", "a")
            .state("orphan")
            .build();

        let once = prune(&a).result;
        assert_eq!(prune(&once).result, once);
    }

    #[test]
    fn co_reachable_is_the_mirror_of_reachable() {
        // Reversing every edge and swapping the roles of start and accepting states should
        // exchange the two sets. Checking the shape rather than the values.
        let a = examples::ends_with_ab();
        assert_eq!(a.reachable().len(), a.state_count());
        assert_eq!(co_reachable(&a).len(), a.state_count());
    }

    #[test]
    fn a_machine_with_no_accepting_states_prunes_to_its_start() {
        let a = AutomatonBuilder::new(["a"])
            .state("q0")
            .edge("q0", "q1", "a")
            .edge("q1", "q0", "a")
            .build();
        assert_eq!(prune(&a).result.state_count(), 1);
    }
}
