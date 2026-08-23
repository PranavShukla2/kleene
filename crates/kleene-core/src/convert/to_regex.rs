//! DFA → regular expression, by state elimination.
//!
//! The direction of the pipeline nobody tools well. Every course teaches it, usually as a
//! sequence of increasingly crowded diagrams, and the thing that makes it hard to follow is
//! that the labels stop being symbols and start being expressions.
//!
//! ## The method
//!
//! Treat the machine as a **GNFA** — a machine whose edges carry regular expressions rather
//! than single symbols. Add a fresh start and a fresh accept state so that the start has no
//! incoming edges and the accept has no outgoing ones, then remove the original states one at
//! a time. Removing `q` means rerouting every path that went *through* it:
//!
//! ```text
//!   new(p → r)  =  old(p → r)  +  old(p → q) · old(q → q)* · old(q → r)
//! ```
//!
//! The `old(q → q)*` in the middle is the self-loop — every number of trips around it, before
//! carrying on. When only the two added states remain, the edge between them is the answer.
//!
//! ## Order matters, but not for correctness
//!
//! Any elimination order yields an equivalent expression, and they can differ in length by an
//! order of magnitude. See [`Order`] — this is decision **D6**.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::automaton::{Automaton, StateId};
use crate::convert::prune::prune;
use crate::regex::ast::Regex;
use crate::regex::simplify::simplify;
use crate::trace::{Step, StepKind, Traced};

/// Which state to eliminate next.
///
/// Correctness is unaffected; readability of the result is affected a great deal. This is
/// decision **D6**, and both options exist so answering it is a matter of choosing a default
/// rather than writing more code.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Order {
    /// Remove the state whose (incoming × outgoing) edge count is smallest.
    ///
    /// Each elimination creates one new edge per (incoming, outgoing) pair, so this removes
    /// the state that will add the least. Usually produces markedly shorter expressions.
    #[default]
    FewestEdges,
    /// Remove states in id order, as worked examples usually do.
    ///
    /// Slower to converge and often longer output, but it matches a student's hand-working
    /// line for line, which is worth more than brevity when checking your own answer.
    Textbook,
}

impl Order {
    /// The name this order goes by outside Rust — in a URL, a CLI flag, or a button.
    pub fn name(self) -> &'static str {
        match self {
            Self::FewestEdges => "fewest-edges",
            Self::Textbook => "textbook",
        }
    }

    /// Every order, for a UI that offers the choice (task F3).
    pub fn all() -> [Self; 2] {
        [Self::FewestEdges, Self::Textbook]
    }
}

impl std::str::FromStr for Order {
    type Err = ();

    /// Parses the names [`Order::name`] produces, and nothing else.
    ///
    /// The error is `()` because every caller has the same reasonable fallback — the default
    /// order — and none of them has anything useful to say about *why* a string was not one of
    /// two known values.
    fn from_str(text: &str) -> Result<Self, Self::Err> {
        Self::all().into_iter().find(|o| o.name() == text).ok_or(())
    }
}

/// A GNFA edge label: `None` means no edge at all, which is different from an ε edge.
type Label = Option<Regex>;

/// Combine two possible edges into one.
fn either(left: Label, right: Label) -> Label {
    match (left, right) {
        (None, r) => r,
        (l, None) => l,
        (Some(l), Some(r)) => Some(Regex::union(l, r)),
    }
}

/// Concatenate labels, where a missing edge makes the whole path impossible.
fn then(left: &Label, right: &Label) -> Label {
    match (left, right) {
        (Some(l), Some(r)) => Some(Regex::concat(l.clone(), r.clone())),
        _ => None,
    }
}

/// One endpoint of a GNFA edge.
///
/// State elimination adds a fresh start and accept state, so an endpoint is either a state of
/// the machine or one of those two. They are carried as a tagged variant rather than as the
/// sentinel ids the algorithm uses internally (`u32::MAX` and its neighbour), because a view
/// that had to know those numbers would be reading an implementation detail — and would draw a
/// state labelled `4294967295` the first time the check was forgotten.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "Endpoint")
)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Endpoint {
    /// The fresh start state, which has nothing incoming.
    Start,
    /// The fresh accept state, which has nothing outgoing.
    Accept,
    /// A state of the machine being converted.
    State {
        /// Its id in [`Elimination::source`].
        id: StateId,
    },
}

/// One labelled edge of the GNFA, as it stands at some point in the elimination.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "GnfaEdge")
)]
pub struct GnfaEdge {
    /// Where the edge starts.
    pub from: Endpoint,
    /// Where it ends. Equal to `from` for a self-loop, which is the case `r*` comes from.
    pub to: Endpoint,
    /// The regular expression on the edge, rendered.
    ///
    /// A string rather than the `Regex` tree. The view puts it on an arrow and never inspects
    /// it, and shipping the tree would export five more TypeScript types to no end — watching
    /// a label grow from `a` to `ab*c` (task F2) is a text change.
    pub label: String,
}

/// The GNFA after one step of elimination.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "EliminationStep")
)]
pub struct EliminationStep {
    /// The state this step removed, if it removed one.
    pub eliminated: Option<StateId>,
    /// Machine states still present, in elimination order — so a view can show what is next.
    pub remaining: Vec<StateId>,
    /// Every labelled edge, after the step. Sorted, so the same machine always renders the same.
    pub edges: Vec<GnfaEdge>,
}

/// The largest machine state elimination will run on, measured rather than guessed.
///
/// Elimination's cost is not in its step count — it produces one step per state — it is in the
/// *size of the expression*, which roughly squares at every elimination. Measured on
/// `(a+b)*a(a+b)ⁿ`, whose DFA doubles with each `n`:
///
/// | states | time | answer |
/// |---|---|---|
/// | 5 | 0.15 ms | 49 chars |
/// | 9 | 1.5 ms | 477 chars |
/// | 17 | 17 ms | 6,193 chars |
/// | 33 | 741 ms | 177,197 chars |
///
/// Every doubling costs about 40× the time and 30× the output. At 65 states that is half a
/// minute and several megabytes of expression, which is not an answer anyone can read.
///
/// So this is a refusal, not a cap. Truncating the *explanation* is right for subset
/// construction (decision D18) because the machine stays correct and complete; truncating an
/// expression would leave a wrong answer that looks like a right one. Refusing, and saying to
/// minimize first, is both honest and the advice a reader actually needs.
pub const ELIMINATION_LIMIT: usize = 25;

/// State elimination, in the shape a view can render.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "Elimination")
)]
pub struct Elimination {
    /// The machine elimination ran on: pruned of dead and unreachable states, which is *not*
    /// the machine the caller passed. Every id in the steps indexes this one.
    #[cfg_attr(feature = "ts", ts(as = "crate::io::wire::WireAutomaton"))]
    pub source: Automaton,
    /// One per entry of `steps`, in the same order.
    pub stages: Vec<EliminationStep>,
    /// Why each state was eliminated and what it did to the edges.
    pub steps: Vec<Step>,
    /// The answer, rendered. Empty when `refused` is set.
    pub regex: String,
    /// Why elimination did not run, when it did not.
    ///
    /// Set only for machines past [`ELIMINATION_LIMIT`]. `None` means the answer above is
    /// real; anything else would be a wrong expression that looks like a right one.
    pub refused: Option<String>,
}

/// Convert to a regular expression, recording the GNFA at every step.
///
/// The plain [`to_regex`] returns only the answer and its narration. This returns the *pictures*
/// as well, which is what task F2 needs: watching one edge label grow from `a` to `ab*c` is the
/// whole lesson, and a trace of sentences cannot show it.
pub fn elimination(automaton: &Automaton, order: Order) -> Elimination {
    // Pruned first, because that is what elimination runs on — a machine full of unreachable
    // states should not be refused for a size it does not really have.
    let machine = prune(automaton).result;
    let states = machine.state_count();

    if states > ELIMINATION_LIMIT {
        return Elimination {
            source: machine,
            stages: Vec::new(),
            steps: Vec::new(),
            regex: String::new(),
            refused: Some(format!(
                "This machine has {states} states. State elimination roughly squares the \
                 expression at every step, so the answer here would run to hundreds of \
                 thousands of characters — long past anything readable. Minimize it first: \
                 the smallest machine for a language is usually far smaller, and its \
                 expression is the one worth reading."
            )),
        };
    }

    let run = eliminate(automaton, order);

    // Capped together with the stages that run parallel to them (decision D18). See the same
    // note in `convert::minimize::minimization`.
    let (steps, dropped) = crate::trace::cap(run.steps);
    let mut stages = run.stages;
    stages.truncate(steps.len().saturating_sub(usize::from(dropped > 0)));
    if dropped > 0 {
        if let Some(last) = stages.last().cloned() {
            stages.push(last);
        }
    }

    Elimination {
        regex: run.result.to_string(),
        source: run.source,
        stages,
        steps,
        refused: None,
    }
}

/// The GNFA right now, as a sorted list of labelled edges.
///
/// Sorted so the same machine always renders the same. A `HashMap` iterates in whatever order
/// it likes, and an arrow list that reshuffled between steps would make every step look like it
/// had changed every edge.
fn snapshot(
    edges: &HashMap<(StateId, StateId), Regex>,
    source: StateId,
    sink: StateId,
) -> Vec<GnfaEdge> {
    let endpoint = |id: StateId| {
        if id == source {
            Endpoint::Start
        } else if id == sink {
            Endpoint::Accept
        } else {
            Endpoint::State { id }
        }
    };

    let mut out: Vec<GnfaEdge> = edges
        .iter()
        .map(|(&(from, to), label)| GnfaEdge {
            from: endpoint(from),
            to: endpoint(to),
            label: label.to_string(),
        })
        .collect();

    out.sort_by(|a, b| {
        let key = |e: &GnfaEdge| {
            let rank = |p: Endpoint| match p {
                Endpoint::Start => (0, 0),
                Endpoint::State { id } => (1, id),
                Endpoint::Accept => (2, 0),
            };
            (rank(e.from), rank(e.to))
        };
        key(a).cmp(&key(b))
    });
    out
}

/// Everything one elimination produced.
struct Run {
    result: Regex,
    source: Automaton,
    stages: Vec<EliminationStep>,
    steps: Vec<Step>,
}

/// Convert a machine to a regular expression describing the same language.
///
/// ```
/// use kleene_core::{examples, convert::to_regex, counterexample::equivalent};
/// use kleene_core::{parse, thompson, convert::determinize};
///
/// let dfa = examples::even_number_of_as();
/// let regex = to_regex(&dfa).result;
///
/// // The expression describes exactly the language it came from.
/// let rebuilt = determinize(&thompson(&parse(&regex.to_string()).unwrap()).result).result;
/// assert!(equivalent(&dfa, &rebuilt));
/// ```
pub fn to_regex(automaton: &Automaton) -> Traced<Regex> {
    to_regex_with(automaton, Order::default())
}

/// Convert to a regular expression, choosing the elimination order.
pub fn to_regex_with(automaton: &Automaton, order: Order) -> Traced<Regex> {
    let run = eliminate(automaton, order);
    Traced::new(run.result, run.steps)
}

/// The elimination itself, recording the GNFA as it goes.
///
/// One implementation, two callers: [`to_regex_with`] throws the pictures away and
/// [`elimination`] keeps them. Running it twice with a flag would have been the other option,
/// and the snapshots cost a string per edge per step on machines this tool is for — far less
/// than the risk of two code paths that are supposed to agree.
fn eliminate(automaton: &Automaton, order: Order) -> Run {
    // Dead and unreachable states contribute nothing but produce large ∅-laden fragments
    // that simplification then has to grind away. Removing them first is both faster and
    // produces a far more readable trace.
    let machine = prune(automaton).result;
    let mut steps = Vec::new();

    // Two fresh states, so the start has nothing incoming and the accept nothing outgoing.
    // Without that, the final edge would be tangled with the machine's own loops.
    let ids: Vec<StateId> = machine.states.keys().copied().collect();
    let source = u32::MAX - 1;
    let sink = u32::MAX;

    let mut edges: HashMap<(StateId, StateId), Regex> = HashMap::new();
    for t in &machine.transitions {
        let label =
            t.on.as_ref()
                .map_or(Regex::Epsilon, |s| Regex::symbol(s.clone()));
        let slot = edges.remove(&(t.from, t.to));
        edges.insert(
            (t.from, t.to),
            match slot {
                Some(existing) => Regex::union(existing, label),
                None => label,
            },
        );
    }

    edges.insert((source, machine.start), Regex::Epsilon);
    for (&id, state) in &machine.states {
        if state.accepting {
            let slot = edges.remove(&(id, sink));
            edges.insert(
                (id, sink),
                match slot {
                    Some(existing) => Regex::union(existing, Regex::Epsilon),
                    None => Regex::Epsilon,
                },
            );
        }
    }

    steps.push(Step::new(
        StepKind::StateElimination,
        format!(
            "Added a fresh start and accept state, so the start has no incoming edges and the \
             accept none outgoing. {} original state{} to eliminate.",
            ids.len(),
            if ids.len() == 1 { "" } else { "s" },
        ),
    ));

    let mut remaining = ids;
    let mut stages = vec![EliminationStep {
        eliminated: None,
        remaining: remaining.clone(),
        edges: snapshot(&edges, source, sink),
    }];

    while !remaining.is_empty() {
        let index = choose(&remaining, &edges, order);
        let victim = remaining.remove(index);

        // Everything that leads in, and everything that leads out, excluding the self-loop.
        let incoming: Vec<StateId> = remaining
            .iter()
            .chain(std::iter::once(&source))
            .copied()
            .filter(|&p| edges.contains_key(&(p, victim)))
            .collect();
        let outgoing: Vec<StateId> = remaining
            .iter()
            .chain(std::iter::once(&sink))
            .copied()
            .filter(|&r| edges.contains_key(&(victim, r)))
            .collect();

        let loop_part = edges
            .get(&(victim, victim))
            .map(|r| Regex::star(r.clone()))
            .map(|r| simplify(&r));

        for &p in &incoming {
            for &r in &outgoing {
                let through = then(
                    &then(
                        &edges.get(&(p, victim)).cloned(),
                        &loop_part.clone().or(Some(Regex::Epsilon)),
                    ),
                    &edges.get(&(victim, r)).cloned(),
                );

                if let Some(new_label) = either(edges.get(&(p, r)).cloned(), through) {
                    edges.insert((p, r), simplify(&new_label));
                }
            }
        }

        edges.retain(|&(from, to), _| from != victim && to != victim);

        steps.push(
            Step::new(
                StepKind::StateElimination,
                format!(
                    "Eliminate {}: every path through it is rerouted, {} edge{} relabelled. \
                     {} state{} left.",
                    label(&machine, victim),
                    incoming.len() * outgoing.len(),
                    if incoming.len() * outgoing.len() == 1 {
                        ""
                    } else {
                        "s"
                    },
                    remaining.len(),
                    if remaining.len() == 1 { "" } else { "s" },
                ),
            )
            .highlighting([victim]),
        );

        stages.push(EliminationStep {
            eliminated: Some(victim),
            remaining: remaining.clone(),
            edges: snapshot(&edges, source, sink),
        });
    }

    // Whatever is left between the two added states is the answer. Nothing left means no
    // path from start to accept at all — the empty language.
    let result = simplify(&edges.remove(&(source, sink)).unwrap_or(Regex::Empty));

    steps.push(Step::new(
        StepKind::StateElimination,
        format!("Only the added states remain; the edge between them is the answer: {result}"),
    ));

    stages.push(EliminationStep {
        eliminated: None,
        remaining: Vec::new(),
        edges: vec![GnfaEdge {
            from: Endpoint::Start,
            to: Endpoint::Accept,
            label: result.to_string(),
        }],
    });

    Run {
        result,
        source: machine,
        stages,
        steps,
    }
}

/// Pick the index of the next state to eliminate.
fn choose(
    remaining: &[StateId],
    edges: &HashMap<(StateId, StateId), Regex>,
    order: Order,
) -> usize {
    match order {
        Order::Textbook => 0,
        Order::FewestEdges => {
            // Eliminating a state creates one edge per (incoming, outgoing) pair, so the
            // cheapest victim is the one with the smallest product. Ties break on id, which
            // keeps the output stable across runs.
            remaining
                .iter()
                .enumerate()
                .min_by_key(|(_, id)| {
                    let id = **id;
                    let incoming = edges
                        .keys()
                        .filter(|&&(from, to)| to == id && from != id)
                        .count();
                    let outgoing = edges
                        .keys()
                        .filter(|&&(from, to)| from == id && to != id)
                        .count();
                    (incoming * outgoing, id)
                })
                .map_or(0, |(i, _)| i)
        }
    }
}

fn label(automaton: &Automaton, id: StateId) -> String {
    automaton
        .state(id)
        .map_or_else(|| format!("#{id}"), |s| s.label.clone())
}

#[cfg(test)]
mod elimination_tests {
    use super::*;
    use crate::regex::parse;
    use crate::regex::thompson::thompson;

    fn dfa_of(source: &str) -> Automaton {
        crate::convert::determinize(&thompson(&parse(source).expect("parses")).result).result
    }

    #[test]
    fn every_order_round_trips_through_its_name() {
        // The names cross the FFI boundary and end up in URLs. A name that does not parse back
        // is an order the UI can select and the engine will silently ignore.
        for order in Order::all() {
            assert_eq!(order.name().parse::<Order>(), Ok(order));
        }
    }

    #[test]
    fn an_unknown_order_is_rejected_rather_than_guessed() {
        assert!("spiral".parse::<Order>().is_err());
        assert!("".parse::<Order>().is_err());
    }

    #[test]
    fn the_order_changes_the_working_but_never_the_language() {
        // Task F3 lets a reader pick the order so it matches their notes. That is only safe
        // because the answer is the same language either way — the expressions differ, and
        // both are correct.
        use crate::counterexample::equivalent;
        use crate::regex::thompson::thompson;

        for input in ["(a|b)*abb", "a*b*", "(ab)*+b"] {
            let dfa = dfa_of(input);
            for order in Order::all() {
                let text = elimination(&dfa, order).regex;
                let rebuilt =
                    crate::convert::determinize(&thompson(&parse(&text).expect("parses")).result)
                        .result;
                assert!(equivalent(&dfa, &rebuilt), "{input} under {}", order.name());
            }
        }
    }

    #[test]
    fn a_machine_past_the_limit_is_refused_rather_than_ground_through() {
        // The measured hazard, and the one decision D18's step cap does *not* cover:
        // elimination produces one step per state, so a step cap never fires — the blow-up is
        // in the expression, which roughly squares at every elimination.
        let big = dfa_of("(a+b)*a(a+b)(a+b)(a+b)(a+b)(a+b)");
        assert!(big.state_count() > ELIMINATION_LIMIT);

        let e = elimination(&big, Order::default());
        assert!(
            e.refused.is_some(),
            "a 65-state machine must not be attempted"
        );
        assert!(
            e.regex.is_empty(),
            "a refusal must not also carry an answer"
        );
        assert!(e.steps.is_empty());

        // And it says what to do about it, because "minimize first" is real advice here — the
        // minimal machine for this language is a fraction of the size.
        let reason = e.refused.expect("checked");
        assert!(reason.contains("Minimize"), "{reason}");
    }

    #[test]
    fn a_machine_within_the_limit_is_never_refused() {
        for input in ["(a|b)*abb", "a*b*", "(ab)*+b", "a"] {
            let e = elimination(&dfa_of(input), Order::default());
            assert_eq!(e.refused, None, "{input}");
            assert!(!e.regex.is_empty(), "{input}");
        }
    }

    #[test]
    fn there_is_exactly_one_stage_per_step() {
        // The alignment every consumer relies on: a view scrubbing to step 3 reads stages[3].
        for input in ["(a|b)*abb", "a*b*", "(ab)*+b", "a"] {
            let e = elimination(&dfa_of(input), Order::default());
            assert_eq!(e.stages.len(), e.steps.len(), "{input}");
        }
    }

    #[test]
    fn every_state_is_eliminated_exactly_once() {
        for input in ["(a|b)*abb", "a*b*", "(ab)*+b"] {
            let e = elimination(&dfa_of(input), Order::default());
            let mut removed: Vec<StateId> = e.stages.iter().filter_map(|s| s.eliminated).collect();
            removed.sort_unstable();

            let mut all: Vec<StateId> = e.source.states.keys().copied().collect();
            all.sort_unstable();
            assert_eq!(removed, all, "{input}");
        }
    }

    #[test]
    fn remaining_shrinks_by_one_each_time_a_state_goes() {
        let e = elimination(&dfa_of("(a|b)*abb"), Order::default());
        for pair in e.stages.windows(2) {
            let expected = if pair[1].eliminated.is_some() {
                pair[0].remaining.len() - 1
            } else {
                // The closing stage, which removes nothing and empties the list.
                pair[1].remaining.len()
            };
            assert_eq!(pair[1].remaining.len(), expected);
        }
    }

    #[test]
    fn no_edge_ever_names_a_state_that_has_been_eliminated() {
        // The property a view depends on to draw anything at all. An arrow to a state that is
        // no longer there is the visible half of an off-by-one in the snapshot.
        for input in ["(a|b)*abb", "a*b*", "(ab)*+b"] {
            let e = elimination(&dfa_of(input), Order::default());
            for stage in &e.stages {
                for edge in &stage.edges {
                    for end in [edge.from, edge.to] {
                        if let Endpoint::State { id } = end {
                            assert!(
                                stage.remaining.contains(&id),
                                "{input}: an edge names {id}, which is gone"
                            );
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn the_last_stage_is_one_edge_holding_the_answer() {
        for input in ["(a|b)*abb", "a*b*", "a"] {
            let e = elimination(&dfa_of(input), Order::default());
            let last = e.stages.last().expect("a stage");

            assert_eq!(last.edges.len(), 1);
            assert_eq!(last.edges[0].from, Endpoint::Start);
            assert_eq!(last.edges[0].to, Endpoint::Accept);
            assert_eq!(last.edges[0].label, e.regex, "{input}");
        }
    }

    #[test]
    fn the_recorded_run_agrees_with_the_plain_one() {
        // Two callers, one implementation — and this is what says so. If `to_regex_with` and
        // `elimination` ever diverge, the page showing the working would be showing the
        // working of a different conversion.
        for input in ["(a|b)*abb", "a*b*", "(ab)*+b", "a", "ε"] {
            let dfa = dfa_of(input);
            let plain = to_regex_with(&dfa, Order::default());
            let recorded = elimination(&dfa, Order::default());

            assert_eq!(recorded.regex, plain.result.to_string(), "{input}");
            assert_eq!(recorded.steps, plain.steps, "{input}");
        }
    }

    #[test]
    fn a_label_only_ever_grows_or_stays() {
        // Task F2's claim: watching an edge label grow from `a` to `ab*c` is the lesson. It is
        // only a lesson if labels do not silently shrink — simplification runs *inside* a step,
        // never between them.
        let e = elimination(&dfa_of("(a|b)*abb"), Order::default());
        assert!(
            e.stages
                .iter()
                .any(|s| s.edges.iter().any(|edge| edge.label.len() > 3)),
            "no label ever grew, so there is nothing to watch"
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::convert::subset::determinize;
    use crate::counterexample::equivalent;
    use crate::examples;
    use crate::regex::{parse, thompson::thompson};

    fn dfa(regex: &str) -> Automaton {
        determinize(&thompson(&parse(regex).expect("parses")).result).result
    }

    /// Rebuild a machine from an expression, for comparing languages.
    fn machine_of(regex: &Regex) -> Automaton {
        determinize(&thompson(&parse(&regex.to_string()).expect("re-parses")).result).result
    }

    #[test]
    fn the_round_trip_preserves_the_language() {
        // The strong one. regex → DFA → regex → DFA must describe the same language, and
        // it exercises every part of the pipeline at once. The roadmap calls this out as
        // the test most likely to find real bugs, and it is why to_regex is written last.
        for input in [
            "a",
            "ab",
            "a+b",
            "a*",
            "(a+b)*",
            "(a+b)*abb",
            "a*b*",
            "(ab)*",
            "a(ba)*",
            "(a+b)*a(a+b)",
            "ε",
        ] {
            let original = dfa(input);
            let expression = to_regex(&original).result;
            let rebuilt = machine_of(&expression);

            assert!(
                equivalent(&original, &rebuilt),
                "{input} became {expression}, which is a different language"
            );
        }
    }

    #[test]
    fn the_round_trip_holds_for_hand_built_machines_too() {
        for machine in [examples::even_number_of_as(), examples::ends_with_ab()] {
            let expression = to_regex(&machine).result;
            assert!(
                equivalent(&machine, &machine_of(&expression)),
                "hand-built machine became {expression}"
            );
        }
    }

    #[test]
    fn both_elimination_orders_describe_the_same_language() {
        // D6 changes the shape of the answer, never its meaning.
        for input in ["(a+b)*abb", "a(ba)*", "a*b*"] {
            let machine = dfa(input);
            let fewest = to_regex_with(&machine, Order::FewestEdges).result;
            let textbook = to_regex_with(&machine, Order::Textbook).result;

            assert!(
                equivalent(&machine_of(&fewest), &machine_of(&textbook)),
                "{input}: {fewest} and {textbook} disagree"
            );
        }
    }

    #[test]
    fn the_output_is_small_enough_to_read() {
        // Without simplification this is where state elimination becomes useless: correct
        // output that nobody can read is not an answer.
        let expression = to_regex(&dfa("(a+b)*abb")).result.to_string();
        assert!(
            expression.len() < 80,
            "expression is {} characters: {expression}",
            expression.len()
        );
    }

    #[test]
    fn the_empty_language_converts_to_the_empty_language() {
        let expression = to_regex(&dfa("∅")).result;
        assert_eq!(expression, Regex::Empty);
    }

    #[test]
    fn a_machine_accepting_only_the_empty_string_gives_epsilon() {
        let machine = dfa("ε");
        let expression = to_regex(&machine).result;
        assert!(equivalent(&machine, &machine_of(&expression)));
    }

    #[test]
    fn every_elimination_is_narrated() {
        let machine = dfa("(a+b)*abb");
        let t = to_regex(&machine);
        let eliminations = t
            .steps
            .iter()
            .filter(|s| s.detail.starts_with("Eliminate"))
            .count();
        assert_eq!(eliminations, machine.state_count());
    }

    #[test]
    fn the_trace_ends_with_the_answer() {
        let t = to_regex(&dfa("ab"));
        let last = t.steps.last().expect("has steps");
        assert!(
            last.detail.contains(&t.result.to_string()),
            "{}",
            last.detail
        );
    }

    #[test]
    fn self_loops_become_starred_sections() {
        // The part of the rule people forget: paths through a state may go round its own
        // loop any number of times first.
        let expression = to_regex(&dfa("a*b")).result.to_string();
        assert!(expression.contains('*'), "expected a star in {expression}");
    }
}
