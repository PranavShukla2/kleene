//! Minimization by partition refinement — and the reason this project exists.
//!
//! Any tool can tell you a DFA minimizes to four states. What the exam actually asks, and
//! what JFLAP will not tell you, is *which string proved two states were different*. So this
//! module computes that string for every separated pair and carries it through to the result.
//!
//! ## One algorithm, two presentations (decision D3)
//!
//! CSE2004 teaches both partition refinement and table-filling, so both must be renderable —
//! but they are not two algorithms. Table-filling is the **dual** of refinement: a pair is
//! marked at round *k* by the table method exactly when it first falls into different blocks
//! at round *k* of refinement. Both are computing *"distinguishable by some string of length
//! ≤ k"*, from opposite ends.
//!
//! So [`refine`] runs once and produces both: the per-round partitions, and a
//! [`MarkingTable`] that is a *view* over the same data rather than a second computation.
//!
//! ## How the witness is reconstructed
//!
//! The distinguishing string falls out of the same pass, by induction on the round:
//!
//! - **Round 0** separates accepting from non-accepting. The witness is `ε` — the empty
//!   string is already accepted by one and not the other.
//! - **Round k+1** separates `p` and `q` when some symbol `a` sends them into blocks that
//!   were already separated. The witness is then `a` followed by the witness for
//!   `(δ(p,a), δ(q,a))`, which exists because that pair split at an earlier round.
//!
//! The recursion always terminates because each step strictly decreases the round.

use std::collections::{BTreeMap, BTreeSet, HashMap};

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use crate::automaton::{Automaton, State, StateId};
use crate::convert::complete::complete;
use crate::convert::prune::retaining;
use crate::notation::Notation;
use crate::trace::{Step, StepKind, Traced};

/// A pair of distinct states, ordered so `(p, q)` and `(q, p)` are the same key.
pub type Pair = (StateId, StateId);

fn pair(p: StateId, q: StateId) -> Pair {
    if p < q { (p, q) } else { (q, p) }
}

/// Why and when two states were shown to be different.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Mark {
    /// The refinement round at which the pair first separated. Round 0 is accepting vs not.
    pub round: usize,
    /// A shortest string accepted from exactly one of the two states.
    ///
    /// Empty means the empty string itself distinguishes them — one is accepting and the
    /// other is not.
    pub witness: String,
}

impl Mark {
    /// The witness rendered for display, using the empty-string glyph when it is empty.
    pub fn witness_display(&self, notation: Notation) -> String {
        if self.witness.is_empty() {
            notation.empty_string().to_string()
        } else {
            self.witness.clone()
        }
    }
}

/// The states grouped into blocks after one refinement round.
pub type Partition = Vec<BTreeSet<StateId>>;

/// Everything one refinement pass discovered.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Refinement {
    /// The partition after each round, starting with the accepting/non-accepting split.
    pub rounds: Vec<Partition>,
    /// Every distinguishable pair, with the round it separated and its witness.
    pub marks: BTreeMap<Pair, Mark>,
    /// The machine the refinement ran on: reachable-only and completed.
    pub source: Automaton,
}

impl Refinement {
    /// The final partition — the blocks that become states of the minimal DFA.
    pub fn blocks(&self) -> &Partition {
        self.rounds
            .last()
            .expect("refinement always records round 0")
    }

    /// Whether two states are distinguishable.
    pub fn distinguishable(&self, p: StateId, q: StateId) -> bool {
        p != q && self.marks.contains_key(&pair(p, q))
    }

    /// The Myhill–Nerode marking table, as a view over this refinement.
    ///
    /// Not a second algorithm — the same marks, arranged as the lower triangle a course
    /// draws. See the module docs on why the two are dual.
    pub fn marking_table(&self) -> MarkingTable {
        let states: Vec<StateId> = self.source.states.keys().copied().collect();
        let mut cells = Vec::new();

        // Lower triangle only: the relation is symmetric and a state is never
        // distinguishable from itself, so the diagonal and upper half carry no information.
        for (i, &row) in states.iter().enumerate() {
            for &col in &states[..i] {
                cells.push(Cell {
                    row,
                    col,
                    mark: self.marks.get(&pair(row, col)).cloned(),
                });
            }
        }

        MarkingTable { states, cells }
    }
}

/// One cell of the marking table.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Cell {
    /// The row state.
    pub row: StateId,
    /// The column state.
    pub col: StateId,
    /// `None` means the pair is equivalent — an unmarked cell.
    pub mark: Option<Mark>,
}

/// The triangular table students fill in by hand.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct MarkingTable {
    /// States in row/column order.
    pub states: Vec<StateId>,
    /// The lower triangle, row-major.
    pub cells: Vec<Cell>,
}

impl MarkingTable {
    /// Look up one pair.
    pub fn get(&self, p: StateId, q: StateId) -> Option<&Mark> {
        let (a, b) = pair(p, q);
        self.cells
            .iter()
            .find(|c| pair(c.row, c.col) == (a, b))
            .and_then(|c| c.mark.as_ref())
    }
}

/// Run partition refinement, recording every split and its witness.
///
/// The input is first restricted to reachable states — unreachable states would otherwise be
/// merged into blocks and inflate the result — and then completed, since refinement needs
/// δ to be total to compare signatures.
pub fn refine(dfa: &Automaton) -> Traced<Refinement> {
    let reachable = dfa.reachable();
    let source = complete(&retaining(dfa, &reachable)).result;

    let mut steps = Vec::new();
    let mut marks: BTreeMap<Pair, Mark> = BTreeMap::new();

    // Round 0: accepting versus not. Empty blocks are dropped — a machine with no accepting
    // states has one block, not two.
    let (accepting, rejecting): (BTreeSet<StateId>, BTreeSet<StateId>) =
        source.states.iter().partition_map_ids();

    let mut partition: Partition = [accepting.clone(), rejecting.clone()]
        .into_iter()
        .filter(|b| !b.is_empty())
        .collect();

    // Every accepting/non-accepting pair is distinguished by ε itself.
    for &p in &accepting {
        for &q in &rejecting {
            marks.insert(
                pair(p, q),
                Mark {
                    round: 0,
                    witness: String::new(),
                },
            );
        }
    }

    steps.push(
        Step::new(
            StepKind::PartitionSplit,
            format!(
                "Round 0 — split by acceptance: {}. Any accepting state and any non-accepting \
                 state are already told apart by the empty string.",
                render_partition(&partition, &source)
            ),
        )
        .highlighting(source.states.keys().copied()),
    );

    let mut rounds = vec![partition.clone()];

    for round in 1.. {
        let block_of = index_of_block(&partition);
        let mut next: Partition = Vec::new();
        let mut split_happened = false;

        for block in &partition {
            // Group by where each state goes: two states stay together only while every
            // symbol sends them into the same block.
            let mut groups: IndexMap<Vec<usize>, BTreeSet<StateId>> = IndexMap::new();
            for &s in block {
                groups
                    .entry(signature(&source, s, &block_of))
                    .or_default()
                    .insert(s);
            }

            if groups.len() == 1 {
                next.push(block.clone());
                continue;
            }

            split_happened = true;
            let parts: Vec<BTreeSet<StateId>> = groups.into_values().collect();

            // Record a witness for every pair this split separates.
            for (i, left) in parts.iter().enumerate() {
                for right in &parts[i + 1..] {
                    for &p in left {
                        for &q in right {
                            let key = pair(p, q);
                            if !marks.contains_key(&key) {
                                let mark = witness_for(&source, p, q, &block_of, &marks, round);
                                marks.insert(key, mark);
                            }
                        }
                    }
                }
            }

            steps.push(split_step(&source, block, &parts, &marks, round));
            next.extend(parts);
        }

        if !split_happened {
            steps.push(
                Step::new(
                    StepKind::PartitionSplit,
                    format!(
                        "Round {round} — no block splits, so the partition is stable. The {} \
                         remaining {} the states of the minimal DFA.",
                        partition.len(),
                        if partition.len() == 1 {
                            "block becomes"
                        } else {
                            "blocks become"
                        },
                    ),
                )
                .highlighting(source.states.keys().copied()),
            );
            break;
        }

        partition = next;
        rounds.push(partition.clone());
    }

    Traced::new(
        Refinement {
            rounds,
            marks,
            source,
        },
        steps,
    )
}

/// Which block each state is currently in.
fn index_of_block(partition: &Partition) -> HashMap<StateId, usize> {
    partition
        .iter()
        .enumerate()
        .flat_map(|(i, block)| block.iter().map(move |&s| (s, i)))
        .collect()
}

/// Where `s` goes on each symbol, as block indices — two states with equal signatures are
/// indistinguishable so far.
fn signature(dfa: &Automaton, s: StateId, block_of: &HashMap<StateId, usize>) -> Vec<usize> {
    dfa.alphabet
        .iter()
        .map(|sym| {
            dfa.transitions_from(s, Some(sym))
                .next()
                .and_then(|t| block_of.get(&t.to).copied())
                // Unreachable on a completed machine, but a sentinel is safer than a panic
                // if a caller hands us something partial.
                .unwrap_or(usize::MAX)
        })
        .collect()
}

/// Build the distinguishing string for a pair separated this round.
///
/// Finds the symbol whose targets were already separated, then prepends it to that pair's
/// witness. Terminates because the recursive lookup is always to a strictly earlier round.
fn witness_for(
    dfa: &Automaton,
    p: StateId,
    q: StateId,
    block_of: &HashMap<StateId, usize>,
    marks: &BTreeMap<Pair, Mark>,
    round: usize,
) -> Mark {
    for symbol in &dfa.alphabet {
        let (Some(pt), Some(qt)) = (
            dfa.transitions_from(p, Some(symbol)).next().map(|t| t.to),
            dfa.transitions_from(q, Some(symbol)).next().map(|t| t.to),
        ) else {
            continue;
        };

        if block_of.get(&pt) != block_of.get(&qt) {
            let rest = marks
                .get(&pair(pt, qt))
                .map(|m| m.witness.as_str())
                .unwrap_or_default();
            return Mark {
                round,
                witness: format!("{symbol}{rest}"),
            };
        }
    }

    // Only reachable if the caller separated a pair the signatures agree on, which would be
    // a bug in the refinement loop rather than in the input.
    Mark {
        round,
        witness: String::new(),
    }
}

/// The prose for one block splitting.
fn split_step(
    dfa: &Automaton,
    block: &BTreeSet<StateId>,
    parts: &[BTreeSet<StateId>],
    marks: &BTreeMap<Pair, Mark>,
    round: usize,
) -> Step {
    // Pick one separated pair to name concretely. An explanation that says "these split"
    // without saying *why* is the thing this whole module exists to avoid.
    let example = parts
        .first()
        .and_then(|l| l.first())
        .zip(parts.get(1).and_then(|r| r.first()))
        .and_then(|(&p, &q)| marks.get(&pair(p, q)).map(|m| (p, q, m)));

    // Naming which side accepts, rather than hedging with "or the other way round". The
    // direction is knowable and is half the diagnostic information; making a student work
    // it out themselves is the job this tool exists to do for them.
    let reason = match example {
        Some((p, q, mark)) => {
            let (yes, no) = if accepts_from(dfa, p, &mark.witness) {
                (p, q)
            } else {
                (q, p)
            };
            format!(
                " The string `{}` is accepted from {} but rejected from {}, which is what \
                 tells them apart.",
                mark.witness_display(Notation::default()),
                label(dfa, yes),
                label(dfa, no),
            )
        }
        None => String::new(),
    };

    Step::new(
        StepKind::PartitionSplit,
        format!(
            "Round {round} — {} splits into {}.{reason}",
            render_block(block, dfa),
            parts
                .iter()
                .map(|p| render_block(p, dfa))
                .collect::<Vec<_>>()
                .join(" and "),
        ),
    )
    .highlighting(block.iter().copied())
}

fn label(dfa: &Automaton, id: StateId) -> String {
    dfa.state(id)
        .map_or_else(|| format!("#{id}"), |s| s.label.clone())
}

/// Run `input` from `from`, reporting whether it ends on an accepting state.
///
/// Only meaningful on a deterministic, complete machine — which is what `refine` works on.
/// A missing transition counts as rejection rather than a panic, so a caller passing a
/// partial machine gets a wrong answer rather than a crash.
fn accepts_from(dfa: &Automaton, from: StateId, input: &str) -> bool {
    let mut at = from;
    for ch in input.chars() {
        match dfa.transitions_from(at, Some(&ch.to_string())).next() {
            Some(t) => at = t.to,
            None => return false,
        }
    }
    dfa.state(at).is_some_and(|s| s.accepting)
}

fn render_block(block: &BTreeSet<StateId>, dfa: &Automaton) -> String {
    format!(
        "{{{}}}",
        block
            .iter()
            .map(|&id| label(dfa, id))
            .collect::<Vec<_>>()
            .join(", ")
    )
}

fn render_partition(partition: &Partition, dfa: &Automaton) -> String {
    partition
        .iter()
        .map(|b| render_block(b, dfa))
        .collect::<Vec<_>>()
        .join(" | ")
}

/// Minimize a DFA, merging every pair of states no string can tell apart.
///
/// The result is a **complete** minimal DFA: it keeps the trap state, because that is what
/// the strict definition requires. Follow with [`prune`](fn@super::prune) for the partial
/// form most courses draw.
///
/// ```
/// use kleene_core::{parse, thompson, convert::{determinize, minimize}};
///
/// // Four states describing a language that needs only two.
/// let dfa = determinize(&thompson(&parse("(a+b)*").unwrap()).result).result;
/// let minimal = minimize(&dfa).result;
/// assert_eq!(minimal.state_count(), 1);
/// ```
pub fn minimize(dfa: &Automaton) -> Traced<Automaton> {
    let traced = refine(dfa);
    let Refinement { rounds, source, .. } = &traced.result;
    let blocks = rounds.last().expect("at least one round");

    // Block containing the start state becomes the new start.
    let start = blocks
        .iter()
        .position(|b| b.contains(&source.start))
        .unwrap_or(0) as StateId;

    let block_of = index_of_block(blocks);
    let mut states = IndexMap::with_capacity(blocks.len());

    for (i, block) in blocks.iter().enumerate() {
        let members: Vec<String> = block.iter().map(|&id| label(source, id)).collect();
        let representative = block.first().copied().unwrap_or_default();

        let mut state = State::new(members.join(","));
        // Every state in a block agrees on acceptance — that was round 0's split.
        state.accepting = source.state(representative).is_some_and(|s| s.accepting);
        state.origin = Some(block.clone());
        states.insert(i as StateId, state);
    }

    let mut transitions = Vec::new();
    for (i, block) in blocks.iter().enumerate() {
        let representative = block.first().copied().unwrap_or_default();
        for symbol in &source.alphabet {
            if let Some(t) = source.transitions_from(representative, Some(symbol)).next()
                && let Some(&target) = block_of.get(&t.to)
            {
                transitions.push(crate::Transition::on(
                    i as StateId,
                    target as StateId,
                    symbol,
                ));
            }
        }
    }

    let minimal = Automaton {
        alphabet: source.alphabet.clone(),
        states,
        start,
        transitions,
    };

    let mut steps = traced.steps;
    steps.push(Step::new(
        StepKind::PartitionSplit,
        format!(
            "{} states became {}.",
            source.state_count(),
            minimal.state_count()
        ),
    ));

    Traced::new(minimal, steps)
}

/// Split states into accepting and non-accepting id sets.
trait PartitionMapIds {
    fn partition_map_ids(self) -> (BTreeSet<StateId>, BTreeSet<StateId>);
}

impl<'a, I: Iterator<Item = (&'a StateId, &'a State)>> PartitionMapIds for I {
    fn partition_map_ids(self) -> (BTreeSet<StateId>, BTreeSet<StateId>) {
        let mut accepting = BTreeSet::new();
        let mut rejecting = BTreeSet::new();
        for (&id, state) in self {
            if state.accepting {
                accepting.insert(id);
            } else {
                rejecting.insert(id);
            }
        }
        (accepting, rejecting)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::builder::AutomatonBuilder;
    use crate::convert::subset::determinize;
    use crate::regex::{parse, thompson::thompson};

    fn dfa_of(regex: &str) -> Automaton {
        determinize(&thompson(&parse(regex).expect("parses")).result).result
    }

    /// A four-state machine for `(a+b)*` — every state is equivalent to every other.
    fn redundant() -> Automaton {
        AutomatonBuilder::new(["a", "b"])
            .accepting("q0")
            .accepting("q1")
            .accepting("q2")
            .accepting("q3")
            .edge("q0", "q1", "a")
            .edge("q0", "q2", "b")
            .edge("q1", "q3", "a")
            .edge("q1", "q0", "b")
            .edge("q2", "q0", "a")
            .edge("q2", "q3", "b")
            .edge("q3", "q2", "a")
            .edge("q3", "q1", "b")
            .build()
    }

    #[test]
    fn equivalent_states_all_merge() {
        assert_eq!(minimize(&redundant()).result.state_count(), 1);
    }

    #[test]
    fn the_textbook_example_minimizes_five_states_to_four() {
        // (a+b)*abb is the canonical worked example: subset construction gives five states,
        // two of which turn out to be equivalent. Four is the published answer.
        let dfa = dfa_of("(a+b)*abb");
        assert_eq!(dfa.state_count(), 5);
        assert_eq!(minimize(&dfa).result.state_count(), 4);
    }

    #[test]
    fn an_already_minimal_machine_keeps_its_size() {
        // ends_with_ab is minimal by construction — three states, none equivalent.
        let dfa = crate::examples::ends_with_ab();
        assert_eq!(minimize(&dfa).result.state_count(), dfa.state_count());
    }

    #[test]
    fn minimization_is_idempotent() {
        let once = minimize(&dfa_of("(a+b)*abb")).result;
        assert_eq!(minimize(&once).result.state_count(), once.state_count());
    }

    #[test]
    fn every_pair_that_separates_gets_a_witness() {
        // The point of the module. A mark without a witness is the JFLAP behaviour this
        // project exists to improve on.
        let r = refine(&dfa_of("(a+b)*abb")).result;
        assert!(!r.marks.is_empty());
        for (&(p, q), mark) in &r.marks {
            assert!(
                mark.witness.len() < 20,
                "witness for ({p},{q}) is implausibly long: {}",
                mark.witness
            );
        }
    }

    #[test]
    fn a_witness_really_does_distinguish_its_pair() {
        // The strongest check here: run the witness from both states and assert exactly one
        // of them accepts. A witness that does not distinguish is a lie told to a student.
        let dfa = dfa_of("(a+b)*abb");
        let r = refine(&dfa).result;

        for (&(p, q), mark) in &r.marks {
            let from_p = accepts_from(&r.source, p, &mark.witness);
            let from_q = accepts_from(&r.source, q, &mark.witness);
            assert_ne!(
                from_p, from_q,
                "witness {:?} fails to separate {p} and {q}",
                mark.witness
            );
        }
    }

    #[test]
    fn round_zero_witnesses_are_the_empty_string() {
        let r = refine(&dfa_of("(a+b)*abb")).result;
        let zero: Vec<_> = r.marks.values().filter(|m| m.round == 0).collect();
        assert!(!zero.is_empty());
        assert!(zero.iter().all(|m| m.witness.is_empty()));
    }

    #[test]
    fn witness_length_matches_the_round_it_separated_at() {
        // The invariant that makes the two presentations dual: a pair separated at round k
        // is distinguished by a string of length exactly k.
        let r = refine(&dfa_of("(a+b)*abb")).result;
        for mark in r.marks.values() {
            assert_eq!(
                mark.witness.chars().count(),
                mark.round,
                "round {} but witness {:?}",
                mark.round,
                mark.witness
            );
        }
    }

    #[test]
    fn the_marking_table_agrees_with_the_refinement() {
        // D3: the table is a view over the refinement, not a second algorithm. If these
        // ever disagree, one of them is lying to a student revising from their notes.
        let r = refine(&dfa_of("(a+b)*abb")).result;
        let table = r.marking_table();

        for &p in &table.states {
            for &q in &table.states {
                if p == q {
                    continue;
                }
                assert_eq!(
                    table.get(p, q).is_some(),
                    r.distinguishable(p, q),
                    "table and refinement disagree about ({p},{q})"
                );
                if let Some(mark) = table.get(p, q) {
                    assert_eq!(Some(mark), r.marks.get(&pair(p, q)));
                }
            }
        }
    }

    #[test]
    fn the_table_is_a_lower_triangle_with_no_diagonal() {
        let table = refine(&dfa_of("(a+b)*abb")).result.marking_table();
        let n = table.states.len();
        assert_eq!(table.cells.len(), n * (n - 1) / 2);
        assert!(table.cells.iter().all(|c| c.row != c.col));
    }

    #[test]
    fn merged_states_record_the_block_they_came_from() {
        let minimal = minimize(&redundant()).result;
        let origin = minimal
            .states
            .values()
            .next()
            .expect("one state")
            .origin
            .as_ref()
            .expect("origin recorded");
        assert_eq!(origin.len(), 4, "all four originals merged into one block");
    }

    #[test]
    fn the_start_state_survives_minimization() {
        let minimal = minimize(&dfa_of("(a+b)*abb")).result;
        assert!(minimal.state(minimal.start).is_some());
    }

    #[test]
    fn the_result_is_a_valid_complete_dfa() {
        for input in ["a", "(a+b)*abb", "a*b*", "(ab)*+b", "ε"] {
            let minimal = minimize(&dfa_of(input)).result;
            assert!(minimal.is_complete(), "{input} left δ partial");
            assert!(!minimal.validate().has_errors(), "{input} did not validate");
        }
    }

    #[test]
    fn the_narration_names_the_distinguishing_string() {
        // The exam question, in the trace.
        let t = refine(&dfa_of("(a+b)*abb"));
        assert!(
            t.steps
                .iter()
                .any(|s| s.detail.contains("but rejected from")),
            "no step named which side accepts the witness"
        );
    }

    #[test]
    fn refinement_starts_by_splitting_on_acceptance() {
        let t = refine(&dfa_of("(a+b)*abb"));
        assert!(t.steps[0].detail.contains("Round 0"));
        assert!(t.steps[0].detail.contains("empty string"));
    }

    #[test]
    fn unreachable_states_are_dropped_before_refining() {
        // Otherwise they join blocks and inflate the minimal machine.
        let mut a = dfa_of("ab");
        a.states.insert(99, State::new("ghost"));
        let minimal = minimize(&a).result;
        assert!(minimal.states.values().all(|s| s.label != "ghost"));
    }
}
