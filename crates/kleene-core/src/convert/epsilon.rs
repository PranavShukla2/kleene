//! ε-closure: which states are reachable without reading any input.
//!
//! This is the single most reused computation in the engine — subset construction calls it
//! once per subset per symbol — so it exists in two forms, deliberately:
//!
//! - [`Closures`] precomputes every state's closure once and answers queries by union. This
//!   is what algorithms use.
//! - [`epsilon_closure`] runs the worklist and narrates it. This is what the UI shows when a
//!   student asks *how* a closure was arrived at.
//!
//! Splitting them is a size decision as much as a speed one. If subset construction emitted
//! the full closure narration for every round, a ten-state NFA would produce hundreds of
//! steps about ε-transitions and the actual subset rounds would be lost in them. The trace
//! records *what happened*; the drill-down recomputes *how* on demand.

use std::collections::{BTreeSet, HashMap};

use crate::automaton::{Automaton, StateId};
use crate::trace::{Step, StepKind, Traced};

/// Every state's ε-closure, computed once.
///
/// The optimisation that makes this worth having: ε-closure distributes over union, so
/// `closure({p, q}) == closure(p) ∪ closure(q)`. Precomputing per-state closures turns every
/// later query into a set union instead of a fresh graph traversal — which matters because
/// subset construction performs one per (subset, symbol) pair, and a subset can be large.
#[derive(Clone, Debug)]
pub struct Closures {
    per_state: HashMap<StateId, BTreeSet<StateId>>,
}

impl Closures {
    /// Compute the ε-closure of every state.
    pub fn compute(automaton: &Automaton) -> Self {
        // Adjacency for ε-edges only, built once. Scanning the full transition list inside
        // the traversal would make this quadratic in the number of transitions for no
        // reason.
        let mut eps: HashMap<StateId, Vec<StateId>> = HashMap::new();
        for t in automaton.transitions.iter().filter(|t| t.is_epsilon()) {
            eps.entry(t.from).or_default().push(t.to);
        }

        let per_state = automaton
            .states
            .keys()
            .map(|&id| (id, reach(&eps, id)))
            .collect();

        Self { per_state }
    }

    /// The ε-closure of a single state. Always contains the state itself.
    pub fn of(&self, id: StateId) -> BTreeSet<StateId> {
        self.per_state
            .get(&id)
            .cloned()
            .unwrap_or_else(|| BTreeSet::from([id]))
    }

    /// The ε-closure of a set of states.
    pub fn of_set(&self, ids: impl IntoIterator<Item = StateId>) -> BTreeSet<StateId> {
        let mut out = BTreeSet::new();
        for id in ids {
            match self.per_state.get(&id) {
                Some(closure) => out.extend(closure.iter().copied()),
                None => {
                    out.insert(id);
                }
            }
        }
        out
    }
}

/// States reachable from `from` along ε-edges, including itself.
fn reach(eps: &HashMap<StateId, Vec<StateId>>, from: StateId) -> BTreeSet<StateId> {
    let mut seen = BTreeSet::from([from]);
    let mut stack = vec![from];

    while let Some(id) = stack.pop() {
        for &next in eps.get(&id).map(Vec::as_slice).unwrap_or_default() {
            if seen.insert(next) {
                stack.push(next);
            }
        }
    }

    seen
}

/// Compute an ε-closure, narrating the worklist as it grows.
///
/// Use this for explanation, not for bulk computation — see [`Closures`] for the latter.
///
/// ```
/// use kleene_core::{parse, thompson, convert::epsilon_closure};
///
/// let nfa = thompson(&parse("a*").unwrap()).result;
/// let traced = epsilon_closure(&nfa, [nfa.start]);
///
/// // The start state of `a*` can skip the loop entirely, so its closure reaches the
/// // accepting state without reading anything.
/// assert!(traced.result.len() > 1);
/// ```
pub fn epsilon_closure(
    automaton: &Automaton,
    seeds: impl IntoIterator<Item = StateId>,
) -> Traced<BTreeSet<StateId>> {
    let seeds: BTreeSet<StateId> = seeds.into_iter().collect();
    let mut closure = seeds.clone();
    let mut worklist: Vec<StateId> = seeds.iter().copied().collect();
    let mut steps = Vec::new();

    steps.push(
        Step::new(
            StepKind::EpsilonClosure,
            format!(
                "Start with {}. Every state is in its own ε-closure, because reading nothing \
                 leaves you where you are.",
                render(&seeds, automaton)
            ),
        )
        .highlighting(seeds.iter().copied()),
    );

    // Popping from the end makes this depth-first, which is not a correctness matter — the
    // closure is a fixed point either way — but it keeps the narration coherent, following
    // one ε-chain to its end before starting the next.
    while let Some(id) = worklist.pop() {
        for t in automaton
            .transitions
            .iter()
            .filter(|t| t.from == id && t.is_epsilon())
        {
            if closure.insert(t.to) {
                worklist.push(t.to);
                steps.push(
                    Step::new(
                        StepKind::EpsilonClosure,
                        format!(
                            "{} has an ε-transition to {}, so {} joins the closure — now {}.",
                            label(automaton, id),
                            label(automaton, t.to),
                            label(automaton, t.to),
                            render(&closure, automaton),
                        ),
                    )
                    .highlighting([id, t.to]),
                );
            }
        }
    }

    steps.push(
        Step::new(
            StepKind::EpsilonClosure,
            format!(
                "No ε-transition leads anywhere new, so the closure is complete: {}.",
                render(&closure, automaton)
            ),
        )
        .highlighting(closure.iter().copied()),
    );

    Traced::new(closure, steps)
}

/// A state's label, falling back to its id if it has none.
fn label(automaton: &Automaton, id: StateId) -> String {
    automaton
        .state(id)
        .map_or_else(|| format!("#{id}"), |s| s.label.clone())
}

/// A set of states in the notation a course uses: `{q0, q1}`.
fn render(ids: &BTreeSet<StateId>, automaton: &Automaton) -> String {
    let inner = ids
        .iter()
        .map(|&id| label(automaton, id))
        .collect::<Vec<_>>()
        .join(", ");
    format!("{{{inner}}}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::builder::AutomatonBuilder;
    use crate::regex::{parse, thompson::thompson};

    /// q0 -ε-> q1 -ε-> q2, plus q0 -a-> q3 which ε-closure must ignore.
    fn chain() -> Automaton {
        AutomatonBuilder::new(["a"])
            .epsilon("q0", "q1")
            .epsilon("q1", "q2")
            .edge("q0", "q3", "a")
            .accepting("q2")
            .build()
    }

    #[test]
    fn a_state_is_always_in_its_own_closure() {
        let a = chain();
        assert!(epsilon_closure(&a, [3]).result.contains(&3));
    }

    #[test]
    fn closure_follows_epsilon_chains_transitively() {
        assert_eq!(
            epsilon_closure(&chain(), [0]).result,
            BTreeSet::from([0, 1, 2])
        );
    }

    #[test]
    fn closure_ignores_symbol_transitions() {
        // q3 is reachable from q0 on `a`, which is exactly what ε-closure must not follow.
        assert!(!epsilon_closure(&chain(), [0]).result.contains(&3));
    }

    #[test]
    fn closure_terminates_on_an_epsilon_cycle() {
        let a = AutomatonBuilder::new(["a"])
            .epsilon("q0", "q1")
            .epsilon("q1", "q0")
            .build();
        assert_eq!(epsilon_closure(&a, [0]).result, BTreeSet::from([0, 1]));
    }

    #[test]
    fn the_narration_names_each_state_as_it_joins() {
        let t = epsilon_closure(&chain(), [0]);
        // Opening step, one per state added, closing step.
        assert_eq!(t.steps.len(), 4);
        assert!(t.steps[1].detail.contains("q1"), "{}", t.steps[1].detail);
        assert!(
            t.steps
                .last()
                .expect("closing step")
                .detail
                .contains("complete")
        );
    }

    #[test]
    fn every_step_highlights_something() {
        // Phase 3 lights these up while scrubbing; a step with nothing to highlight
        // cannot be rendered.
        let t = epsilon_closure(&chain(), [0]);
        assert!(t.steps.iter().all(|s| !s.highlight.is_empty()));
    }

    // --- The precomputed form must agree with the narrated one ---

    #[test]
    fn precomputed_closures_match_the_worklist_for_every_state() {
        // The two implementations exist for different reasons and must never disagree.
        // This is the test that keeps the fast path honest.
        for input in ["a", "a*", "(a+b)*", "a*b*c*", "(ab)*+c", "ε", "∅"] {
            let nfa = thompson(&parse(input).expect("parses")).result;
            let closures = Closures::compute(&nfa);

            for &id in nfa.states.keys() {
                assert_eq!(
                    closures.of(id),
                    epsilon_closure(&nfa, [id]).result,
                    "{input}: closures disagree for state {id}"
                );
            }
        }
    }

    #[test]
    fn closure_distributes_over_union() {
        // The property that makes precomputation valid: closure({p,q}) is closure(p) joined
        // with closure(q), so a set query never needs a fresh traversal. If this were false,
        // Closures::of_set would be silently wrong.
        let nfa = thompson(&parse("(a+b)*ab").expect("parses")).result;
        let closures = Closures::compute(&nfa);
        let ids: Vec<StateId> = nfa.states.keys().copied().collect();

        for &p in &ids {
            for &q in &ids {
                let union: BTreeSet<_> = closures.of(p).union(&closures.of(q)).copied().collect();
                assert_eq!(closures.of_set([p, q]), union, "failed for {p} and {q}");
                assert_eq!(union, epsilon_closure(&nfa, [p, q]).result);
            }
        }
    }

    #[test]
    fn an_unknown_state_closes_over_itself() {
        // Defensive: a dangling id must not panic mid-conversion.
        let closures = Closures::compute(&chain());
        assert_eq!(closures.of(99), BTreeSet::from([99]));
    }

    #[test]
    fn sets_render_in_the_notation_a_course_uses() {
        let t = epsilon_closure(&chain(), [0]);
        assert!(t.steps[0].detail.contains("{q0}"), "{}", t.steps[0].detail);
    }
}
