//! Reasoning as a first-class output.
//!
//! This module exists before any algorithm does, deliberately. Every conversion in this
//! crate returns a [`Traced<T>`] rather than a bare `T`, so that explanation is something
//! the algorithm *produces* rather than something a caller reconstructs afterwards.
//!
//! The practical consequence: the browser's step scrubber, the CLI's `--verbose` output,
//! and the generated documentation all read the same `Vec<Step>`. There is no second
//! implementation of "why did that happen" to keep in sync with the first.

use serde::{Deserialize, Serialize};

/// A result paired with the ordered reasoning that produced it.
///
/// ```
/// use kleene_core::trace::{Step, Traced};
///
/// let doubled = Traced::new(21, vec![Step::note("start with 21")]).map(|n| n * 2);
/// assert_eq!(doubled.result, 42);
/// assert_eq!(doubled.steps.len(), 1);
/// ```
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "Traced")
)]
pub struct Traced<T> {
    /// What the algorithm computed.
    pub result: T,
    /// How it got there, in order.
    pub steps: Vec<Step>,
}

impl<T> Traced<T> {
    /// Pair a result with its reasoning.
    pub fn new(result: T, steps: Vec<Step>) -> Self {
        Self { result, steps }
    }

    /// A result that needed no explaining. Used at the leaves, never to skip a trace
    /// that an algorithm ought to be producing.
    pub fn untraced(result: T) -> Self {
        Self {
            result,
            steps: Vec::new(),
        }
    }

    /// Transform the result, keeping the reasoning that produced it.
    pub fn map<U, F: FnOnce(T) -> U>(self, f: F) -> Traced<U> {
        Traced {
            result: f(self.result),
            steps: self.steps,
        }
    }

    /// Chain another traced computation, concatenating both sets of steps.
    ///
    /// This is what keeps a pipeline like regex → NFA → DFA → minimal DFA readable, and
    /// what stops call sites from turning into a pile of `.result`.
    pub fn and_then<U, F: FnOnce(T) -> Traced<U>>(self, f: F) -> Traced<U> {
        let mut next = f(self.result);
        let mut steps = self.steps;
        steps.append(&mut next.steps);
        Traced {
            result: next.result,
            steps,
        }
    }

    /// Discard the reasoning. Named awkwardly on purpose — reaching for this usually
    /// means the reasoning should have been rendered somewhere instead.
    pub fn into_result(self) -> T {
        self.result
    }
}

/// The most steps any trace crossing the boundary may carry (decision D18).
///
/// A pathological regular expression forces exponential blow-up in subset construction, and
/// the trace grows with it — measured at roughly 0.36 KB of JSON per step, so an uncapped run
/// reaches megabytes and locks the tab.
///
/// The cap is on the **explanation**, never on the computation. The machine is still built in
/// full and every answer stays correct; what is lost is the narration past step 500, which is
/// the right thing to lose — nobody scrubs to step 4,000, and a reader who has got that far
/// has long since understood the pattern.
pub const STEP_CAP: usize = 500;

/// Truncate a trace to [`STEP_CAP`], saying so if it truncated.
///
/// Returns the steps and how many were dropped, because several results carry an array that
/// runs *parallel* to their steps — one frame, split or GNFA snapshot each — and every one of
/// them has to be cut to the same length. A helper that silently returned only the steps would
/// leave those arrays longer than the trace they index, which is the alignment bug every
/// consumer of those types is written to rely on not happening.
pub fn cap(mut steps: Vec<Step>) -> (Vec<Step>, usize) {
    if steps.len() <= STEP_CAP {
        return (steps, 0);
    }

    // One short, so the note that replaces the tail still fits inside the cap.
    let dropped = steps.len() - (STEP_CAP - 1);
    steps.truncate(STEP_CAP - 1);
    steps.push(Step::note(format!(
        "…and {dropped} further steps, not recorded. The machine above is complete and \
         correct — only the explanation stops here, because a trace this long costs more to \
         send than it can possibly teach."
    )));

    (steps, dropped)
}

/// One unit of reasoning: what happened, and why it happened.
///
/// The `detail` field is what a UI renders as prose. It is generated *here*, in the core,
/// rather than assembled by a frontend — a sentence that cannot be built from a `Step` is
/// a missing field on `Step`, not a frontend problem.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "Step")
)]
pub struct Step {
    /// Which algorithm produced this step, and what kind of move it was.
    pub kind: StepKind,
    /// One sentence of plain-language reasoning, ready to render.
    pub detail: String,
    /// State ids this step is about, for the UI to highlight. Empty when not applicable.
    ///
    /// These name states of the algorithm's **input**. A subset-construction step highlights
    /// the NFA states in the subset it is talking about; [`frame`](Self::frame) is what names
    /// states of the machine being built.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub highlight: Vec<u32>,
    /// How much of the result existed once this step finished, when the algorithm can say.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub frame: Option<Frame>,
    /// The input states this step *began* from, when it began from a set.
    ///
    /// Almost always this is the seed set of an ε-closure — the states you are in before
    /// closing over ε, as opposed to [`highlight`](Self::highlight), which is where you ended
    /// up. Recorded because a closure cannot be recomputed from its own answer: `{q0, q2, q4}`
    /// says nothing about whether it grew from `q0` or from `q4`, and "expand it one state at
    /// a time" is a question about the seeds.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub seeds: Vec<u32>,
}

impl Step {
    /// A step that carries only prose — used for narration around real work.
    pub fn note(detail: impl Into<String>) -> Self {
        Self {
            kind: StepKind::Note,
            detail: detail.into(),
            highlight: Vec::new(),
            frame: None,
            seeds: Vec::new(),
        }
    }

    /// A step of a given kind, with prose.
    pub fn new(kind: StepKind, detail: impl Into<String>) -> Self {
        Self {
            kind,
            detail: detail.into(),
            highlight: Vec::new(),
            frame: None,
            seeds: Vec::new(),
        }
    }

    /// Attach the state ids this step concerns, so the UI knows what to light up.
    #[must_use]
    pub fn highlighting(mut self, ids: impl IntoIterator<Item = u32>) -> Self {
        self.highlight = ids.into_iter().collect();
        self
    }

    /// Attach the state of the half-built result, so the UI can draw it mid-construction.
    #[must_use]
    pub fn framed(mut self, frame: Frame) -> Self {
        self.frame = Some(frame);
        self
    }

    /// Attach the set this step started from, so a UI can offer to expand it in slow motion.
    #[must_use]
    pub fn seeded(mut self, ids: impl IntoIterator<Item = u32>) -> Self {
        self.seeds = ids.into_iter().collect();
        self
    }
}

/// How much of the result exists, part-way through building it.
///
/// This is what lets a diagram *grow* rather than only re-highlight. Without it a scrubber can
/// show which states a step is talking about but not which states had been discovered yet, so
/// step 3 of a twelve-step construction draws the finished twelve-state machine — the answer,
/// while claiming to show the working.
///
/// ## Why counts rather than a snapshot
///
/// Every algorithm that emits frames appends to its result in discovery order and never
/// rewrites what it has already appended. So "what existed after step *n*" is exactly a
/// *prefix* of the result, and a prefix is two integers. Storing a copy of the machine per
/// step instead would put an O(states) clone on every step: a 250-state construction runs to
/// hundreds of steps, and half a megabyte would cross the FFI boundary to say what two numbers
/// say. The prefix property is not incidental — it is asserted in tests, because a future
/// algorithm that renumbered states mid-run would break this silently.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "Frame")
)]
pub struct Frame {
    /// How many of the result's states existed, counting in the result's own order.
    pub states: u32,
    /// How many of the result's transitions existed, likewise.
    pub transitions: u32,
    /// Result states still waiting to be expanded, in the order they will be taken.
    ///
    /// The worklist *is* subset construction; a UI that shows it has explained most of the
    /// algorithm. Carried per step rather than recomputed because the queue is the one piece
    /// of algorithm state that leaves no trace in the finished machine.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub pending: Vec<u32>,
    /// The result state being expanded, when the step sits inside a round.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current: Option<u32>,
    /// The result state this step arrived at, when it arrived anywhere.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<u32>,
    /// Whether [`target`](Self::target) was created by this step rather than recognised.
    ///
    /// New-versus-already-seen is the distinction students most reliably get wrong, so the UI
    /// draws it differently — and reads it from here rather than by matching on prose.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub fresh: bool,
}

/// The kind of reasoning a [`Step`] represents.
///
/// Deliberately an enum rather than a string: the UI switches on it to choose an icon and a
/// highlight colour, and a typo in a string would fail silently at render time.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(
    feature = "ts",
    derive(ts_rs::TS),
    ts(export, export_to = "generated/", rename = "StepKind")
)]
#[serde(rename_all = "kebab-case")]
#[non_exhaustive]
pub enum StepKind {
    /// Narration with no state change.
    Note,
    /// An ε-closure grew by one state.
    EpsilonClosure,
    /// A subset-construction round.
    SubsetRound,
    /// A partition block was split during minimization.
    PartitionSplit,
    /// A state was eliminated while converting to a regular expression.
    StateElimination,
    /// One step of running an input string through a machine.
    Simulation,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn map_preserves_steps() {
        let t = Traced::new(2, vec![Step::note("two")]).map(|n| n * 3);
        assert_eq!(t.result, 6);
        assert_eq!(t.steps.len(), 1);
    }

    #[test]
    fn and_then_concatenates_reasoning_in_order() {
        let t = Traced::new(1, vec![Step::note("first")])
            .and_then(|n| Traced::new(n + 1, vec![Step::note("second")]));

        assert_eq!(t.result, 2);
        let details: Vec<_> = t.steps.iter().map(|s| s.detail.as_str()).collect();
        assert_eq!(
            details,
            ["first", "second"],
            "steps must stay in causal order"
        );
    }

    #[test]
    fn highlight_is_omitted_from_json_when_empty() {
        // Steps cross the FFI boundary in bulk. An empty array per step is pure waste
        // against a 400 KB budget, so it must not be serialized.
        let json = serde_json::to_string(&Step::note("hello")).unwrap();
        assert!(
            !json.contains("highlight"),
            "empty highlight should be skipped: {json}"
        );

        let json = serde_json::to_string(&Step::note("hi").highlighting([1, 2])).unwrap();
        assert!(json.contains("highlight"));
    }

    #[test]
    fn a_step_without_a_frame_does_not_carry_an_empty_one() {
        // Same budget argument as `highlight`: most steps of most algorithms have nothing to
        // say about a half-built result, and `"frame":null` on every one of them is waste.
        let json = serde_json::to_string(&Step::note("hello")).unwrap();
        assert!(!json.contains("frame"), "{json}");
    }

    #[test]
    fn a_frame_omits_the_fields_it_has_nothing_to_say_about() {
        let step = Step::note("hi").framed(Frame {
            states: 3,
            transitions: 2,
            ..Frame::default()
        });
        let json = serde_json::to_string(&step).unwrap();

        assert!(json.contains("\"states\":3"), "{json}");
        // A round that expanded nothing, arrived nowhere and left an empty queue should say
        // so by silence rather than by three nulls and an empty array.
        for absent in ["pending", "current", "target", "fresh"] {
            assert!(!json.contains(absent), "{absent} should be omitted: {json}");
        }
    }

    #[test]
    fn seeds_are_omitted_when_a_step_started_from_nothing_in_particular() {
        let json = serde_json::to_string(&Step::note("hello")).unwrap();
        assert!(!json.contains("seeds"), "{json}");

        let json = serde_json::to_string(&Step::note("hi").seeded([4, 5])).unwrap();
        assert!(json.contains("seeds"));
    }

    #[test]
    fn a_frame_survives_a_round_trip() {
        let frame = Frame {
            states: 4,
            transitions: 6,
            pending: vec![2, 3],
            current: Some(1),
            target: Some(3),
            fresh: true,
        };
        let step = Step::new(StepKind::SubsetRound, "round").framed(frame);

        let json = serde_json::to_string(&step).unwrap();
        let back: Step = serde_json::from_str(&json).unwrap();
        assert_eq!(back, step);
    }
}
