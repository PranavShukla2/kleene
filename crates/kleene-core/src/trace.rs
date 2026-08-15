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

/// One unit of reasoning: what happened, and why it happened.
///
/// The `detail` field is what a UI renders as prose. It is generated *here*, in the core,
/// rather than assembled by a frontend — a sentence that cannot be built from a `Step` is
/// a missing field on `Step`, not a frontend problem.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Step {
    /// Which algorithm produced this step, and what kind of move it was.
    pub kind: StepKind,
    /// One sentence of plain-language reasoning, ready to render.
    pub detail: String,
    /// State ids this step is about, for the UI to highlight. Empty when not applicable.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub highlight: Vec<u32>,
}

impl Step {
    /// A step that carries only prose — used for narration around real work.
    pub fn note(detail: impl Into<String>) -> Self {
        Self {
            kind: StepKind::Note,
            detail: detail.into(),
            highlight: Vec::new(),
        }
    }

    /// A step of a given kind, with prose.
    pub fn new(kind: StepKind, detail: impl Into<String>) -> Self {
        Self {
            kind,
            detail: detail.into(),
            highlight: Vec::new(),
        }
    }

    /// Attach the state ids this step concerns, so the UI knows what to light up.
    #[must_use]
    pub fn highlighting(mut self, ids: impl IntoIterator<Item = u32>) -> Self {
        self.highlight = ids.into_iter().collect();
        self
    }
}

/// The kind of reasoning a [`Step`] represents.
///
/// Deliberately an enum rather than a string: the UI switches on it to choose an icon and a
/// highlight colour, and a typo in a string would fail silently at render time.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
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
}
