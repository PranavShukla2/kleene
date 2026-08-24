//! TikZ export.
//!
//! Roadmap §2.7 calls this the highest-value feature per line of code in the project, and the
//! reason is narrow: it is the one output nothing else in this space produces. A student who
//! can paste a machine straight into their assignment does not go back to drawing by hand.
//!
//! ## The one rule this module is built around
//!
//! **What the student arranged on screen is what comes out.** Not a re-layout, not a tidied
//! version — the same picture. That is why this takes a layout as a parameter, and why the
//! coordinate mapping has no fudge factor: 96px is 2.4cm because design-system §4.4 chose the
//! on-screen node distance so that it would be (§4.4, and roadmap §2.3).
//!
//! `kleene-core` still does not know what a pixel is. It knows that a caller has positions in
//! *some* unit and a scale to convert them, and [`TIKZ_SCALE`] is the one this project uses.
//!
//! ## Why it is not simply "draw the nodes and the edges"
//!
//! Three cases make a naïve export produce a picture that is wrong rather than merely plain:
//!
//! - **Self-loops** need a side, and the side has to be one that is free — a loop drawn over
//!   a neighbouring state reads as an edge between them.
//! - **Bidirectional pairs** drawn straight land on top of each other, so `p → q` and `q → p`
//!   become one arrow with two heads.
//! - **Labels** go through LaTeX. A state named `q_{0}` is ordinary in this subject and is a
//!   compile error unescaped, and a student who hits a compile error does not debug it.

use std::collections::{BTreeMap, BTreeSet};

use crate::automaton::{Automaton, StateId};
use crate::notation::Notation;

/// Centimetres per layout unit.
///
/// 96 layout units → 2.4cm, which is design-system §4.4's default node distance mapped onto
/// TikZ's. The correspondence is the whole point: it is why a machine spread out on screen is
/// spread out on the page, without anyone tuning a multiplier until it looks right.
pub const TIKZ_SCALE: f64 = 2.4 / 96.0;

/// How far from a loop's anchor another feature must be for that side to count as free.
///
/// Matches `LOOP_CLEARANCE` in the renderer's geometry, in the same units, because these two
/// answers have to agree — see the note on [`loop_direction`].
const LOOP_CLEARANCE: f64 = 40.0;

/// State radius plus loop radius, in layout units. The renderer's `GEOM.radius + loopRadius`.
const LOOP_REACH: f64 = 24.0 + 16.0;

/// A position in the caller's layout units.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Point {
    /// Rightwards.
    pub x: f64,
    /// **Downwards**, as screen coordinates run. `to_tikz` negates it, because TikZ's y grows
    /// the other way and a machine exported without the flip comes out mirrored.
    pub y: f64,
}

/// Which side of a state its self-loop sits on.
///
/// Ordered as the renderer orders them, because "the first free side" is only a stable answer
/// if both agree on what *first* means.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Loop {
    /// The default, and the fallback when every side is blocked.
    Above,
    /// To the right of the state.
    Right,
    /// Below it.
    Below,
    /// To its left.
    Left,
}

impl Loop {
    /// The TikZ option that draws it.
    fn option(self) -> &'static str {
        match self {
            Self::Above => "loop above",
            Self::Right => "loop right",
            Self::Below => "loop below",
            Self::Left => "loop left",
        }
    }

    /// Where the loop sits relative to the state's centre.
    fn anchor(self, at: Point) -> Point {
        match self {
            Self::Above => Point {
                x: at.x,
                y: at.y - LOOP_REACH,
            },
            Self::Below => Point {
                x: at.x,
                y: at.y + LOOP_REACH,
            },
            Self::Left => Point {
                x: at.x - LOOP_REACH,
                y: at.y,
            },
            Self::Right => Point {
                x: at.x + LOOP_REACH,
                y: at.y,
            },
        }
    }

    /// Every side, in the order a free one is looked for.
    const ORDER: [Self; 4] = [Self::Above, Self::Right, Self::Below, Self::Left];
}

/// Pick the side of `at` whose loop clears every other state.
///
/// The first side in [`Loop::ORDER`] with nothing within [`LOOP_CLEARANCE`] of its anchor,
/// falling back to `above` when a state is hemmed in on all four — a crowded loop is worse
/// than one overlapping something, and an invisible loop is worse than both.
///
/// **This is the renderer's rule, written twice.** The renderer's copy is in TypeScript
/// (`web/src/canvas/geometry.ts`) and this one is in Rust, and they have to agree or the
/// export stops matching the screen — which is the one promise this module makes. The
/// duplication is deliberate for now: routing the renderer through wasm to ask would make
/// every frame of a drag an FFI call. `matches_the_renderer` in the tests is what holds them
/// together, and it is written to fail loudly rather than drift quietly.
pub fn loop_direction(at: Point, neighbours: &[Point]) -> Loop {
    Loop::ORDER
        .into_iter()
        .find(|side| {
            let anchor = side.anchor(at);
            !neighbours
                .iter()
                .any(|o| (o.x - anchor.x).hypot(o.y - anchor.y) < LOOP_CLEARANCE)
        })
        .unwrap_or(Loop::Above)
}

/// Escape a label for LaTeX maths-free text.
///
/// Every character LaTeX treats as syntax. `q_{0}` is an ordinary state name in this subject
/// and an unescaped `_` is a compile error outside maths mode — and a student who pastes a
/// snippet that will not compile does not debug it, they go back to drawing by hand.
///
/// `\` is replaced first and with `\textbackslash{}` rather than `\\`, because in text mode
/// `\\` is a line break: a state named `a\b` would silently split the node label in two.
fn escape(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for character in text.chars() {
        match character {
            '\\' => out.push_str(r"\textbackslash{}"),
            '~' => out.push_str(r"\textasciitilde{}"),
            '^' => out.push_str(r"\textasciicircum{}"),
            '_' | '{' | '}' | '$' | '#' | '&' | '%' => {
                out.push('\\');
                out.push(character);
            }
            other => out.push(other),
        }
    }
    out
}

/// A TikZ-safe node name.
///
/// Node names go inside `\node (name)` and are referenced by `\path (a) edge (b)`. A user's
/// label cannot be used directly — `q 0` and `q,0` both break the syntax — so nodes are named
/// by id and the label is carried separately, where it is escaped.
fn node_name(id: StateId) -> String {
    format!("s{id}")
}

/// Render an automaton and a layout as a standalone `tikzpicture`.
///
/// ```
/// use std::collections::BTreeMap;
/// use kleene_core::{examples, io::tikz::{to_tikz, Point}};
///
/// let machine = examples::even_number_of_as();
/// let layout: BTreeMap<_, _> = machine
///     .states
///     .keys()
///     .enumerate()
///     .map(|(i, &id)| (id, Point { x: i as f64 * 96.0, y: 0.0 }))
///     .collect();
///
/// let tex = to_tikz(&machine, &layout, Default::default());
/// assert!(tex.contains(r"\begin{tikzpicture}"));
/// // The packages it needs are named, because the commonest failure is a correct picture
/// // that will not compile in the document it was pasted into.
/// assert!(tex.contains(r"\usetikzlibrary{automata,positioning}"));
/// ```
pub fn to_tikz(
    automaton: &Automaton,
    layout: &BTreeMap<StateId, Point>,
    notation: Notation,
) -> String {
    let mut out = String::new();

    // Task A7. A snippet that compiles only in a preamble the reader has to guess at is a
    // snippet that gets abandoned, so the requirement is stated in the output itself.
    out.push_str("% Requires, in your preamble:\n");
    out.push_str("%   \\usepackage{tikz}\n");
    out.push_str("%   \\usetikzlibrary{automata,positioning}\n");
    out.push_str(
        "\\begin{tikzpicture}[shorten >=1pt,node distance=2.4cm,on grid,auto,>=stealth]\n",
    );

    for (&id, state) in &automaton.states {
        let Some(at) = layout.get(&id) else { continue };

        let mut options = vec!["state".to_string()];
        if id == automaton.start {
            options.push("initial".to_string());
        }
        if state.accepting {
            options.push("accepting".to_string());
        }

        // y is flipped: screen coordinates grow downward and TikZ's grow upward, so a machine
        // laid out left-to-right would otherwise come out mirrored top-to-bottom.
        //
        // Written as `0.0 - v` rather than `-v` on purpose. Negating a zero gives *negative*
        // zero, which formats as `-0.00` — valid TikZ, and a distracting thing to find in a
        // snippet you are about to hand in.
        out.push_str(&format!(
            "  \\node[{}] ({}) at ({:.2},{:.2}) {{${}$}};\n",
            options.join(","),
            node_name(id),
            at.x * TIKZ_SCALE,
            0.0 - at.y * TIKZ_SCALE,
            escape(&state.label),
        ));
    }

    let edges = grouped_edges(automaton, notation);
    if edges.is_empty() {
        out.push_str("\\end{tikzpicture}\n");
        return out;
    }

    let neighbours: Vec<(StateId, Point)> = layout.iter().map(|(&id, &p)| (id, p)).collect();

    out.push_str("  \\path[->]\n");
    for ((from, to), symbols) in &edges {
        let label = escape(&symbols.join(", "));

        let option = if from == to {
            // A self-loop's side is chosen from where the *other* states are, so it never
            // lands on top of one.
            let at = layout
                .get(from)
                .copied()
                .unwrap_or(Point { x: 0.0, y: 0.0 });
            let others: Vec<Point> = neighbours
                .iter()
                .filter(|(id, _)| id != from)
                .map(|(_, p)| *p)
                .collect();
            loop_direction(at, &others).option().to_string()
        } else if edges.contains_key(&(*to, *from)) {
            // Task A4. Drawn straight, `p → q` and `q → p` land on the same line and read as
            // one arrow with two heads. Both bend left, and the direction vector flipping
            // between them is what separates the pair.
            "bend left=20".to_string()
        } else {
            String::new()
        };

        let options = if option.is_empty() {
            String::new()
        } else {
            format!("[{option}]")
        };

        out.push_str(&format!(
            "    ({}) edge{} node{{${}$}} ({})\n",
            node_name(*from),
            options,
            label,
            node_name(*to),
        ));
    }
    out.push_str("  ;\n");

    out.push_str("\\end{tikzpicture}\n");
    out
}

/// Transitions collapsed to one entry per ordered pair, symbols sorted (task A5).
///
/// `BTreeMap` and `BTreeSet` rather than hash containers: the output is snapshot-tested and
/// pasted into documents, and an export whose edge order changed between runs would produce a
/// diff every time it was regenerated.
fn grouped_edges(
    automaton: &Automaton,
    notation: Notation,
) -> BTreeMap<(StateId, StateId), Vec<String>> {
    let mut grouped: BTreeMap<(StateId, StateId), BTreeSet<String>> = BTreeMap::new();

    for transition in &automaton.transitions {
        grouped
            .entry((transition.from, transition.to))
            .or_default()
            .insert(
                transition
                    .on
                    .clone()
                    .unwrap_or_else(|| notation.empty_string().to_string()),
            );
    }

    grouped
        .into_iter()
        .map(|(pair, symbols)| (pair, symbols.into_iter().collect()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::builder::AutomatonBuilder;

    /// A layout that spreads states along a row at the default node distance.
    fn row(automaton: &Automaton) -> BTreeMap<StateId, Point> {
        automaton
            .states
            .keys()
            .enumerate()
            .map(|(i, &id)| {
                (
                    id,
                    Point {
                        x: i as f64 * 96.0,
                        y: 0.0,
                    },
                )
            })
            .collect()
    }

    #[test]
    fn ninety_six_units_is_two_point_four_centimetres() {
        // Design-system §4.4's correspondence, asserted rather than assumed. It is the whole
        // reason a machine spread out on screen is spread out on the page.
        assert!((96.0 * TIKZ_SCALE - 2.4).abs() < 1e-12);
        assert!((192.0 * TIKZ_SCALE - 4.8).abs() < 1e-12);
    }

    #[test]
    fn a_zero_coordinate_is_not_negative_zero() {
        // `-0.00` is valid TikZ and a distracting thing to find in a snippet you are about to
        // hand in.
        let machine = AutomatonBuilder::new(["a"]).state("q0").build();
        let tex = to_tikz(&machine, &row(&machine), Notation::default());
        assert!(!tex.contains("-0.00"), "{tex}");
    }

    #[test]
    fn the_picture_is_not_mirrored() {
        // Screen y grows downward and TikZ's grows upward. Without the flip, a machine drawn
        // with an accepting state below the start comes out with it above.
        let machine = AutomatonBuilder::new(["a"]).edge("q0", "q1", "a").build();
        let mut layout = row(&machine);
        let ids: Vec<StateId> = machine.states.keys().copied().collect();
        layout.insert(ids[1], Point { x: 96.0, y: 96.0 });

        let tex = to_tikz(&machine, &layout, Notation::default());
        assert!(tex.contains("(2.40,-2.40)"), "{tex}");
    }

    #[test]
    fn every_latex_special_character_is_escaped() {
        // `q_{0}` is an ordinary state name in this subject and a compile error unescaped.
        let machine = AutomatonBuilder::new(["a"])
            .edge("q_{0}", "100%&#$", "a")
            .build();
        let tex = to_tikz(&machine, &row(&machine), Notation::default());

        assert!(tex.contains(r"q\_\{0\}"), "{tex}");
        assert!(tex.contains(r"100\%\&\#\$"), "{tex}");
    }

    #[test]
    fn a_backslash_does_not_become_a_line_break() {
        // In text mode `\\` *is* a line break, so escaping a backslash as `\\` would silently
        // split a node label in two rather than print it.
        let machine = AutomatonBuilder::new(["a"]).edge(r"a\b", "q1", "a").build();
        let tex = to_tikz(&machine, &row(&machine), Notation::default());

        assert!(tex.contains(r"a\textbackslash{}b"), "{tex}");
        assert!(
            !tex.contains(r"{$a\\b$}"),
            "a line break in a node label: {tex}"
        );
    }

    #[test]
    fn parallel_transitions_collapse_to_one_edge() {
        // Task A5. Two arrows between the same pair is a picture of the data structure, not
        // of the machine.
        let machine = AutomatonBuilder::new(["a", "b"])
            .edge("q0", "q1", "a")
            .edge("q0", "q1", "b")
            .build();

        let tex = to_tikz(&machine, &row(&machine), Notation::default());
        assert_eq!(tex.matches("edge").count(), 1, "{tex}");
        assert!(tex.contains("{$a, b$}"), "{tex}");
    }

    #[test]
    fn a_bidirectional_pair_bends_apart() {
        // Drawn straight, both arrows land on the same line and read as one with two heads.
        let machine = AutomatonBuilder::new(["a", "b"])
            .edge("q0", "q1", "a")
            .edge("q1", "q0", "b")
            .build();

        let tex = to_tikz(&machine, &row(&machine), Notation::default());
        assert_eq!(tex.matches("bend left").count(), 2, "{tex}");
    }

    #[test]
    fn a_one_way_edge_does_not_bend() {
        let machine = AutomatonBuilder::new(["a"]).edge("q0", "q1", "a").build();
        let tex = to_tikz(&machine, &row(&machine), Notation::default());
        assert!(!tex.contains("bend"), "{tex}");
    }

    #[test]
    fn a_self_loop_takes_a_side_that_is_free() {
        let machine = AutomatonBuilder::new(["a"]).edge("q0", "q0", "a").build();
        let tex = to_tikz(&machine, &row(&machine), Notation::default());
        assert!(tex.contains("loop above"), "{tex}");
    }

    #[test]
    fn a_loop_avoids_the_side_a_neighbour_is_on() {
        // The rule that stops a loop being drawn over the state next to it, which reads as an
        // edge between the two rather than as a loop at all.
        let at = Point { x: 0.0, y: 0.0 };
        let above = Point { x: 0.0, y: -40.0 };

        assert_eq!(loop_direction(at, &[]), Loop::Above);
        assert_eq!(loop_direction(at, &[above]), Loop::Right);
    }

    #[test]
    fn a_hemmed_in_state_still_gets_a_loop() {
        // An invisible loop is worse than one overlapping something.
        let at = Point { x: 0.0, y: 0.0 };
        let boxed_in: Vec<Point> = Loop::ORDER
            .into_iter()
            .map(|side| side.anchor(at))
            .collect();

        assert_eq!(loop_direction(at, &boxed_in), Loop::Above);
    }

    #[test]
    fn matches_the_renderer() {
        // **The test that holds two implementations together.** `loop_direction` here and
        // `chooseLoopDirection` in `web/src/canvas/geometry.ts` are the same rule written
        // twice, and the export's whole promise is that it matches the screen.
        //
        // The cases below are the renderer's own unit tests, restated. If either side changes
        // its ordering, its clearance or its fallback, this fails — which is the point, since
        // the alternative is the two drifting silently and nobody noticing until a student's
        // assignment does not look like their screen.
        let at = Point { x: 100.0, y: 100.0 };

        assert_eq!(loop_direction(at, &[]), Loop::Above, "no neighbours");
        assert_eq!(
            loop_direction(at, &[Point { x: 100.0, y: 60.0 }]),
            Loop::Right,
            "something directly above"
        );
        assert_eq!(
            loop_direction(
                at,
                &[Point { x: 100.0, y: 60.0 }, Point { x: 140.0, y: 100.0 }]
            ),
            Loop::Below,
            "above and right taken"
        );
        // Just outside the clearance is not blocking.
        assert_eq!(
            loop_direction(at, &[Point { x: 100.0, y: 19.0 }]),
            Loop::Above,
            "41 units away is clear"
        );
    }

    #[test]
    fn an_epsilon_transition_uses_the_notation_setting() {
        let machine = AutomatonBuilder::new(["a"]).epsilon("q0", "q1").build();
        let tex = to_tikz(&machine, &row(&machine), Notation::default());
        assert!(tex.contains(Notation::default().empty_string()), "{tex}");
    }

    #[test]
    fn a_machine_with_no_transitions_still_closes_its_picture() {
        // The empty path would be `\path[->] ;`, which is a TikZ syntax error.
        let machine = AutomatonBuilder::new(["a"]).state("q0").build();
        let tex = to_tikz(&machine, &row(&machine), Notation::default());

        assert!(!tex.contains(r"\path"), "{tex}");
        assert!(tex.trim_end().ends_with(r"\end{tikzpicture}"), "{tex}");
    }

    #[test]
    fn the_output_is_stable_between_runs() {
        // Snapshot-tested and pasted into documents, so an export whose edge order changed
        // between runs would produce a diff every time it was regenerated.
        let machine = crate::examples::ends_with_ab();
        let layout = row(&machine);
        let once = to_tikz(&machine, &layout, Notation::default());
        let twice = to_tikz(&machine, &layout, Notation::default());
        assert_eq!(once, twice);
    }

    #[test]
    fn renders_the_ends_with_ab_dfa() {
        let machine = crate::examples::ends_with_ab();
        insta::assert_snapshot!(to_tikz(&machine, &row(&machine), Notation::default()));
    }

    #[test]
    fn renders_a_machine_with_loops_and_a_bidirectional_pair() {
        let machine = AutomatonBuilder::new(["a", "b"])
            .edge("q0", "q0", "a")
            .edge("q0", "q1", "b")
            .edge("q1", "q0", "a")
            .accepting("q1")
            .build();
        insta::assert_snapshot!(to_tikz(&machine, &row(&machine), Notation::default()));
    }
}
