//! Subset construction: an NFA becomes a DFA.
//!
//! The idea is one sentence long — *a state of the DFA is the set of NFA states you could be
//! in* — and the whole difficulty is that the sets are invisible once you draw the result.
//! So this module is built around making them visible:
//!
//! - Each DFA state records the subset it came from, in [`State::origin`], which is what
//!   lets the UI answer "where did this state come from?" by lighting up the NFA.
//! - Each step names the subset, the symbol, the resulting subset, and — the part students
//!   most reliably get wrong — whether that result was **new** or **already seen**.
//!
//! ## Naming (decision D4)
//!
//! DFA states are labelled `A`, `B`, `C`, … rather than `{q1, q3}`. Set notation is
//! self-explanatory at two elements and unreadable at five, and subset construction's entire
//! drama is subsets *growing* — so literal labels degrade exactly as the diagram becomes
//! worth looking at. The subset is never lost: it lives in `origin`, and the narration spells
//! it out every time it is mentioned.
//!
//! ## The empty subset
//!
//! When a symbol leads nowhere, no transition is emitted and the step says so. The trap state
//! that makes the DFA total is [`complete`](fn@super::complete), a separate step — because
//! whether to *draw* it is a teaching preference, and a machine cluttered with edges to a
//! dead state is harder to read than one without.

use std::collections::{BTreeSet, VecDeque};

use indexmap::IndexMap;

use crate::automaton::{Automaton, State, StateId};
use crate::convert::epsilon::Closures;
use crate::trace::{Frame, Step, StepKind, Traced};

/// Sequential DFA state labels: `A`…`Z`, then `AA`, `AB`, and so on.
///
/// Spreadsheet-style rather than `A1`, `A2` because it stays short: teaching-sized machines
/// never leave single letters, and the ones that do are being skim-read anyway.
fn label_for(mut index: usize) -> String {
    let mut out = Vec::new();
    loop {
        out.push(b'A' + (index % 26) as u8);
        if index < 26 {
            break;
        }
        index = index / 26 - 1;
    }
    out.reverse();
    String::from_utf8(out).expect("ASCII letters")
}

/// Render a subset of NFA states the way a course writes it: `{q0, q1}`.
fn render(ids: &BTreeSet<StateId>, nfa: &Automaton) -> String {
    if ids.is_empty() {
        return "∅".to_string();
    }
    let inner = ids
        .iter()
        .map(|&id| {
            nfa.state(id)
                .map_or_else(|| format!("#{id}"), |s| s.label.clone())
        })
        .collect::<Vec<_>>()
        .join(", ");
    format!("{{{inner}}}")
}

/// The worklist as DFA state ids, in the order the queue will take them.
///
/// Derived from the queue each time it is needed rather than maintained beside it: a second
/// structure holding the same order is a second thing to get out of step, and the worklist is
/// never longer than the DFA it is building.
fn pending(
    queue: &VecDeque<BTreeSet<StateId>>,
    subsets: &IndexMap<BTreeSet<StateId>, StateId>,
) -> Vec<StateId> {
    queue.iter().map(|subset| subsets[subset]).collect()
}

/// Convert an NFA (with or without ε-transitions) into an equivalent DFA.
///
/// ```
/// use kleene_core::{parse, thompson, convert::determinize};
///
/// let nfa = thompson(&parse("(a+b)*abb").unwrap()).result;
/// let dfa = determinize(&nfa).result;
///
/// assert!(!dfa.has_epsilon());
/// // Every DFA state remembers the NFA states it stands for.
/// assert!(dfa.states.values().all(|s| s.origin.is_some()));
/// ```
pub fn determinize(nfa: &Automaton) -> Traced<Automaton> {
    let closures = Closures::compute(nfa);
    let mut steps = Vec::new();

    // Subsets in discovery order. IndexMap gives both the "have I seen this?" lookup and a
    // stable index to name states by, without a second structure to keep in step.
    let mut subsets: IndexMap<BTreeSet<StateId>, StateId> = IndexMap::new();
    let mut transitions = Vec::new();
    let mut queue = VecDeque::new();

    let start_subset = closures.of_set([nfa.start]);
    subsets.insert(start_subset.clone(), 0);
    queue.push_back(start_subset.clone());

    steps.push(
        Step::new(
            StepKind::SubsetRound,
            format!(
                "The start state is the ε-closure of {} — that is {}, which becomes A.",
                render(&BTreeSet::from([nfa.start]), nfa),
                render(&start_subset, nfa),
            ),
        )
        .highlighting(start_subset.iter().copied())
        .framed(Frame {
            states: 1,
            transitions: 0,
            pending: vec![0],
            target: Some(0),
            fresh: true,
            ..Frame::default()
        }),
    );

    // Breadth-first, so the trace explores in the order a person filling in the transition
    // table by hand would: finish one row before starting the next.
    while let Some(current) = queue.pop_front() {
        let from_id = subsets[&current];
        let from_label = label_for(from_id as usize);

        for symbol in &nfa.alphabet {
            // Move on the symbol, then close over ε. Doing it in the other order would
            // miss states reachable only by ε *after* consuming the symbol.
            let moved: BTreeSet<StateId> = current
                .iter()
                .flat_map(|&id| nfa.transitions_from(id, Some(symbol)))
                .map(|t| t.to)
                .collect();
            let target = closures.of_set(moved);

            if target.is_empty() {
                steps.push(
                    Step::new(
                        StepKind::SubsetRound,
                        format!(
                            "Reading `{symbol}` from {from_label} = {} reaches no state at all, \
                             so {from_label} has no `{symbol}` transition.",
                            render(&current, nfa)
                        ),
                    )
                    .highlighting(current.iter().copied())
                    .framed(Frame {
                        states: subsets.len() as u32,
                        transitions: transitions.len() as u32,
                        pending: pending(&queue, &subsets),
                        current: Some(from_id),
                        ..Frame::default()
                    }),
                );
                continue;
            }

            let (to_id, is_new) = match subsets.get(&target) {
                Some(&existing) => (existing, false),
                None => {
                    let id = subsets.len() as StateId;
                    subsets.insert(target.clone(), id);
                    queue.push_back(target.clone());
                    (id, true)
                }
            };

            let to_label = label_for(to_id as usize);
            transitions.push(crate::Transition::on(from_id, to_id, symbol.clone()));

            // "New or already seen" is the distinction students most reliably get wrong,
            // so it is stated outright rather than left to be inferred from the diagram.
            steps.push(
                Step::new(
                    StepKind::SubsetRound,
                    if is_new {
                        format!(
                            "Reading `{symbol}` from {from_label} = {} reaches {} — that subset \
                             is new, so it becomes {to_label} and joins the worklist.",
                            render(&current, nfa),
                            render(&target, nfa),
                        )
                    } else {
                        format!(
                            "Reading `{symbol}` from {from_label} = {} reaches {} — already \
                             seen as {to_label}, so no new state is created.",
                            render(&current, nfa),
                            render(&target, nfa),
                        )
                    },
                )
                .highlighting(target.iter().copied())
                .framed(Frame {
                    states: subsets.len() as u32,
                    transitions: transitions.len() as u32,
                    pending: pending(&queue, &subsets),
                    current: Some(from_id),
                    target: Some(to_id),
                    fresh: is_new,
                }),
            );
        }
    }

    // Build the states only now that every subset is known, so labels and ids agree with
    // the order they were discovered in.
    let mut states = IndexMap::with_capacity(subsets.len());
    for (subset, &id) in &subsets {
        // A subset accepts if any NFA state in it accepts — being *able* to be in an
        // accepting state is what acceptance means for an NFA.
        let accepting = subset
            .iter()
            .any(|&s| nfa.state(s).is_some_and(|state| state.accepting));

        let mut state = State::new(label_for(id as usize));
        state.accepting = accepting;
        state.origin = Some(subset.clone());
        states.insert(id, state);
    }

    let accepting_count = states.values().filter(|s| s.accepting).count();
    steps.push(
        Step::new(
            StepKind::SubsetRound,
            format!(
                "No subsets left to expand. The DFA has {} states, {accepting_count} of them \
                 accepting.",
                states.len()
            ),
        )
        // The last frame is the whole machine with an empty worklist, so scrubbing to the end
        // and letting the animation finish land on the same picture.
        .framed(Frame {
            states: states.len() as u32,
            transitions: transitions.len() as u32,
            ..Frame::default()
        }),
    );

    let dfa = Automaton {
        alphabet: nfa.alphabet.clone(),
        states,
        start: 0,
        transitions,
    };

    Traced::new(dfa, steps)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::automaton::Determinism;
    use crate::builder::AutomatonBuilder;
    use crate::regex::{parse, thompson::thompson};

    fn dfa_of(regex: &str) -> Traced<Automaton> {
        determinize(&thompson(&parse(regex).expect("parses")).result)
    }

    #[test]
    fn labels_run_a_to_z_then_double_up() {
        assert_eq!(label_for(0), "A");
        assert_eq!(label_for(25), "Z");
        assert_eq!(label_for(26), "AA");
        assert_eq!(label_for(27), "AB");
        assert_eq!(label_for(51), "AZ");
        assert_eq!(label_for(52), "BA");
    }

    #[test]
    fn the_result_is_deterministic() {
        for input in ["a", "(a+b)*abb", "a*b*", "(ab)*+b", "ε"] {
            let dfa = dfa_of(input).result;
            assert_eq!(dfa.determinism(), Determinism::Dfa, "{input} was not a DFA");
            assert!(!dfa.has_epsilon(), "{input} kept ε-transitions");
        }
    }

    #[test]
    fn every_state_records_the_subset_it_came_from() {
        // This is the whole reason `origin` exists — Phase 3's hover-highlight reads it.
        let dfa = dfa_of("(a+b)*abb").result;
        assert!(dfa.states.values().all(|s| s.origin.is_some()));
    }

    #[test]
    fn origins_refer_to_states_that_exist_in_the_source() {
        let nfa = thompson(&parse("(a+b)*ab").expect("parses")).result;
        let dfa = determinize(&nfa).result;

        for state in dfa.states.values() {
            let origin = state.origin.as_ref().expect("origin recorded");
            assert!(!origin.is_empty(), "an origin subset must never be empty");
            assert!(
                origin.iter().all(|id| nfa.state(*id).is_some()),
                "origin points at a state the NFA does not have"
            );
        }
    }

    #[test]
    fn a_subset_accepts_when_any_member_accepts() {
        let nfa = thompson(&parse("ab").expect("parses")).result;
        let dfa = determinize(&nfa).result;

        for state in dfa.states.values() {
            let origin = state.origin.as_ref().expect("origin recorded");
            let any_accepting = origin
                .iter()
                .any(|&id| nfa.state(id).is_some_and(|s| s.accepting));
            assert_eq!(state.accepting, any_accepting, "{} disagreed", state.label);
        }
    }

    #[test]
    fn the_start_state_is_the_epsilon_closure_of_the_nfa_start() {
        let nfa = thompson(&parse("a*").expect("parses")).result;
        let dfa = determinize(&nfa).result;
        let closures = Closures::compute(&nfa);

        let start_origin = dfa.state(dfa.start).expect("start exists").origin.clone();
        assert_eq!(start_origin, Some(closures.of(nfa.start)));
    }

    #[test]
    fn identical_subsets_are_not_duplicated() {
        // The point of the "already seen" check. Without it this never terminates.
        let nfa = AutomatonBuilder::new(["a"])
            .edge("q0", "q1", "a")
            .edge("q1", "q0", "a")
            .accepting("q1")
            .build();

        let dfa = determinize(&nfa).result;
        assert_eq!(dfa.state_count(), 2);
    }

    #[test]
    fn a_symbol_leading_nowhere_produces_no_transition_but_is_narrated() {
        // `a` over the alphabet {a, b}: reading `b` anywhere is a dead end.
        let nfa = AutomatonBuilder::new(["a", "b"])
            .edge("q0", "q1", "a")
            .accepting("q1")
            .build();

        let t = determinize(&nfa);
        assert!(
            t.steps
                .iter()
                .any(|s| s.detail.contains("reaches no state at all")),
            "a dead end must be explained, not silently omitted"
        );
        assert!(
            t.result
                .transitions
                .iter()
                .all(|tr| tr.on.as_deref() == Some("a"))
        );
    }

    #[test]
    fn the_trace_distinguishes_new_subsets_from_repeats() {
        // The distinction students most reliably get wrong, so it must be explicit.
        let t = dfa_of("(a+b)*abb");
        assert!(t.steps.iter().any(|s| s.detail.contains("is new")));
        assert!(t.steps.iter().any(|s| s.detail.contains("already seen")));
    }

    #[test]
    fn steps_spell_out_the_subset_behind_every_label() {
        // D4's bargain: short labels on the diagram, full subsets in the words.
        let t = dfa_of("ab");
        let round = t
            .steps
            .iter()
            .find(|s| s.detail.contains("Reading"))
            .expect("has a round");
        assert!(round.detail.contains('{'), "{}", round.detail);
    }

    #[test]
    fn the_traversal_is_breadth_first() {
        // So the trace reads like someone filling in a transition table row by row.
        let t = dfa_of("(a+b)*abb");
        let first_round = t
            .steps
            .iter()
            .position(|s| s.detail.contains("A ="))
            .expect("A first");
        let second = t
            .steps
            .iter()
            .position(|s| s.detail.contains("B ="))
            .expect("then B");
        assert!(first_round < second);
    }

    /// Every frame a run emitted, in order.
    fn frames(t: &Traced<Automaton>) -> Vec<&crate::trace::Frame> {
        t.steps.iter().filter_map(|s| s.frame.as_ref()).collect()
    }

    #[test]
    fn every_step_of_a_construction_carries_a_frame() {
        // A step without one is a step the animation has to freeze on.
        let t = dfa_of("(a+b)*abb");
        assert_eq!(frames(&t).len(), t.steps.len());
    }

    #[test]
    fn a_frame_is_always_a_prefix_of_the_finished_machine() {
        // The invariant `Frame`'s two counts stand on: the machine is only ever appended to,
        // so the first `states` states and first `transitions` transitions are a machine in
        // their own right. If some later change renumbered states mid-run, the UI would draw
        // edges into nothing and this is what would catch it.
        for input in ["(a+b)*abb", "a*b*", "(ab)*+b", "a"] {
            let t = dfa_of(input);
            for frame in frames(&t) {
                for edge in t.result.transitions.iter().take(frame.transitions as usize) {
                    assert!(
                        edge.from < frame.states && edge.to < frame.states,
                        "{input}: an edge exists before its endpoints do"
                    );
                }
            }
        }
    }

    #[test]
    fn frames_only_ever_grow() {
        let t = dfa_of("(a+b)*abb");
        let mut previous = (0, 0);
        for frame in frames(&t) {
            assert!(
                frame.states >= previous.0 && frame.transitions >= previous.1,
                "a frame went backwards: {previous:?} then {frame:?}"
            );
            previous = (frame.states, frame.transitions);
        }
    }

    #[test]
    fn the_last_frame_is_the_whole_machine_with_an_empty_worklist() {
        // Scrubbing to the end and letting the animation run out must land on one picture.
        let t = dfa_of("(a+b)*abb");
        let last = *frames(&t).last().expect("frames");

        assert_eq!(last.states as usize, t.result.state_count());
        assert_eq!(last.transitions as usize, t.result.transitions.len());
        assert!(last.pending.is_empty(), "the worklist must have drained");
    }

    #[test]
    fn fresh_is_set_exactly_when_the_prose_says_the_subset_is_new() {
        // The UI reads `fresh` and never the sentence; this is what keeps the two honest.
        let t = dfa_of("(a+b)*abb");
        for step in t.steps.iter().filter(|s| s.detail.starts_with("Reading")) {
            let frame = step.frame.as_ref().expect("framed");
            assert_eq!(
                frame.fresh,
                step.detail.contains("is new"),
                "{}",
                step.detail
            );
        }

        // The start state is discovered rather than read into, so it is framed as fresh
        // without the word appearing — otherwise the animation would never draw it.
        let first = t.steps.first().expect("a first step");
        assert!(first.frame.as_ref().is_some_and(|f| f.fresh));
    }

    #[test]
    fn a_new_subset_joins_the_worklist_and_is_later_expanded() {
        // D1 renders `pending` as a queue. It is only a queue if things leave it.
        let t = dfa_of("(a+b)*abb");
        let expanded: Vec<_> = frames(&t).iter().filter_map(|f| f.current).collect();

        for frame in frames(&t) {
            if frame.fresh {
                let id = frame.target.expect("a fresh frame arrived somewhere");
                assert!(
                    frame.pending.contains(&id) || expanded.contains(&id),
                    "state {id} was created and never queued"
                );
            }
        }
    }

    #[test]
    fn a_dead_end_arrives_nowhere() {
        let nfa = AutomatonBuilder::new(["a", "b"])
            .edge("q0", "q1", "a")
            .accepting("q1")
            .build();

        let t = determinize(&nfa);
        let dead = t
            .steps
            .iter()
            .find(|s| s.detail.contains("reaches no state at all"))
            .expect("narrated");
        let frame = dead.frame.as_ref().expect("framed");

        assert_eq!(
            frame.target, None,
            "nothing was reached, so nothing lights up"
        );
        assert!(!frame.fresh);
    }

    #[test]
    fn the_result_validates() {
        for input in ["a", "(a+b)*abb", "a*b*c*", "ε", "(ab)*+c"] {
            let report = dfa_of(input).result.validate();
            assert!(!report.has_errors(), "{input}: {:?}", report.problems);
        }
    }

    #[test]
    fn determinizing_an_existing_dfa_leaves_its_language_alone() {
        // Idempotence in the shape available before `equiv` exists: the state count must
        // not grow, since every subset is already a singleton.
        let dfa = crate::examples::ends_with_ab();
        let again = determinize(&dfa).result;
        assert_eq!(again.state_count(), dfa.state_count());
    }
}
