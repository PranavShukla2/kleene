//! The `kleene` command-line tool.
//!
//! Convert, minimize, simulate and compare finite automata from a terminal.
//!
//! ## The design rule
//!
//! **The CLI never explains anything itself.** Every `--verbose` line is a `Step` that
//! `kleene-core` already produced while doing the work. That is the same rule the web UI
//! follows, and it is why one implementation of "why did that happen" serves a browser
//! scrubber, a terminal, and the generated docs (roadmap §2.1).
//!
//! ## Exit codes
//!
//! Chosen so `kleene equiv` can drive a grading script:
//!
//! | Code | Meaning |
//! |---|---|
//! | 0 | Success — and for `equiv`, the two machines agree |
//! | 1 | The question was answered and the answer is "no" |
//! | 2 | Something went wrong: unreadable file, bad regex |

#![forbid(unsafe_code)]

mod grade;
mod input;

use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::process::ExitCode;

use clap::{Parser, Subcommand, ValueEnum};
use kleene_core::io::tikz::Point as TikzPoint;
use kleene_core::io::{Document, to_dot, to_tikz};
use kleene_core::notation::Notation;
use kleene_core::teach::ProblemSpec;
use kleene_core::{Automaton, StateId, Traced, convert, counterexample, examples, simulate};

use crate::input::{From as InputKind, Input};

/// Exit code for "answered, and the answer is no".
const NEGATIVE: u8 = 1;
/// Exit code for "could not answer".
const FAILURE: u8 = 2;

#[derive(Parser)]
#[command(
    name = "kleene",
    version,
    about = "Automata theory from the command line",
    long_about = "Convert, minimize, simulate and compare finite automata.\n\n\
                  Most commands take an INPUT, which may be a regular expression, a path to a \
                  .kln file, or `-` for standard input. An existing file is read as .kln and \
                  anything else is treated as a regular expression; use --from to be explicit.\n\n\
                  Every command accepts --verbose, which prints the reasoning the engine \
                  produced while doing the work."
)]
struct Cli {
    #[command(subcommand)]
    command: Command,

    /// Print the step-by-step reasoning behind the result.
    #[arg(long, short, global = true)]
    verbose: bool,

    /// Emit machine-readable JSON instead of prose.
    #[arg(long, global = true)]
    json: bool,

    /// How to interpret INPUT.
    #[arg(long, global = true, value_enum, default_value_t = InputKind::Auto)]
    from: InputKind,
}

#[derive(Subcommand)]
enum Command {
    /// Convert between representations.
    Convert {
        /// A regular expression, a .kln file, or `-`.
        input: String,
        /// What to produce.
        #[arg(long, value_enum, default_value_t = Target::Dfa)]
        to: Target,
    },
    /// Minimize a machine, merging states no string can tell apart.
    Minimize {
        /// A regular expression, a .kln file, or `-`.
        input: String,
    },
    /// Run a string and report whether it is accepted.
    Run {
        /// A regular expression, a .kln file, or `-`.
        input: String,
        /// The string to run. Use `""` for the empty string.
        string: String,
    },
    /// Check whether two machines accept the same language.
    ///
    /// Exits 0 when they agree and 1 when they do not, so it can drive a grading script.
    Equiv {
        /// The reference — typically the expected answer.
        reference: String,
        /// The candidate — typically a submission.
        candidate: String,
        /// On disagreement, print the shortest string they differ on.
        #[arg(long, short)]
        counterexample: bool,
    },
    /// Write a machine out in another format.
    Export {
        /// A regular expression, a .kln file, or `-`.
        input: String,
        /// The format to write.
        #[arg(long, value_enum, default_value_t = Format::Kln)]
        format: Format,
    },
    /// List the built-in example automata.
    Examples,
    /// Build a problem a student can open from a link.
    ///
    /// Prints the link on stdout, so a set of problems is a shell loop rather than an
    /// afternoon of clicking.
    Problem {
        /// What to ask for, in words. Shown to the student.
        #[arg(long)]
        prompt: String,
        /// The target language, as a regular expression.
        #[arg(long)]
        target: String,
        /// The most states an accepted answer may use.
        #[arg(long)]
        budget: Option<usize>,
        /// Where the solve page lives. Override to point at a local build.
        #[arg(long, default_value = "https://kleene.pranavmshukla.in")]
        origin: String,
    },
    /// Grade a directory of submissions against a reference.
    ///
    /// Exits 0 when every submission was read, whatever the verdicts — a grader's exit code
    /// reports whether *grading* worked, not whether the class passed.
    Grade {
        /// A directory of `.kln` and `.jff` files. Searched recursively.
        directory: String,
        /// The expected answer: a regular expression, a `.kln` file, or an example key.
        #[arg(long)]
        against: String,
        /// How to print the results.
        #[arg(long, value_enum, default_value_t = GradeFormat::Csv)]
        format: GradeFormat,
    },
}

/// How `grade` reports.
#[derive(Clone, Copy, Debug, PartialEq, Eq, ValueEnum)]
enum GradeFormat {
    /// A spreadsheet, which is what a marks upload usually wants.
    Csv,
    /// Machine-readable, for a script that does something else with it.
    Json,
    /// A table that reads well in a pull request or an email.
    Md,
}

/// What `convert` should produce.
#[derive(Clone, Copy, Debug, PartialEq, Eq, ValueEnum)]
enum Target {
    /// The ε-NFA as built, without determinizing.
    Nfa,
    /// A deterministic machine.
    Dfa,
    /// The minimal deterministic machine.
    Min,
    /// A regular expression.
    Regex,
}

/// What `export` should write.
#[derive(Clone, Copy, Debug, PartialEq, Eq, ValueEnum)]
enum Format {
    /// Kleene's own document format.
    Kln,
    /// Graphviz.
    Dot,
    /// A TikZ picture, for LaTeX.
    Tikz,
}

fn main() -> ExitCode {
    let cli = Cli::parse();

    match run(&cli) {
        Ok(code) => code,
        Err(message) => {
            eprintln!("error: {message}");
            ExitCode::from(FAILURE)
        }
    }
}

fn run(cli: &Cli) -> Result<ExitCode, String> {
    match &cli.command {
        Command::Convert { input, to } => convert_command(cli, input, *to),
        Command::Minimize { input } => minimize_command(cli, input),
        Command::Run { input, string } => run_command(cli, input, string),
        Command::Equiv {
            reference,
            candidate,
            counterexample,
        } => equiv_command(cli, reference, candidate, *counterexample),
        Command::Export { input, format } => export_command(cli, input, *format),
        Command::Examples => {
            examples_command(cli);
            Ok(ExitCode::SUCCESS)
        }
        Command::Problem {
            prompt,
            target,
            budget,
            origin,
        } => problem_command(prompt, target, *budget, origin),
        Command::Grade {
            directory,
            against,
            format,
        } => grade_command(cli, directory, against, *format),
    }
}

/// Read an input, turning failures into a message the caller prints.
fn load(cli: &Cli, argument: &str) -> Result<Input, String> {
    Input::resolve(argument, cli.from).map_err(|e| e.to_string())
}

/// How to refer to an input in a sentence.
///
/// A grading loop passes absolute paths, and a counterexample explanation reading
/// "`baabb` is in /home/.../submissions/2024/student-02.kln" buries the one word that
/// matters. A regular expression is already short and is shown as typed.
fn display_name(argument: &str) -> &str {
    if std::path::Path::new(argument).is_file() {
        std::path::Path::new(argument)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(argument)
    } else {
        argument
    }
}

/// Print the reasoning behind a result, when asked for.
///
/// The steps come from the engine; this only decides where they go.
fn trace<T>(cli: &Cli, traced: &Traced<T>) {
    if !cli.verbose {
        return;
    }
    for (i, step) in traced.steps.iter().enumerate() {
        eprintln!("{:>3}. {}", i + 1, step.detail);
    }
    if !traced.steps.is_empty() {
        eprintln!();
    }
}

fn convert_command(cli: &Cli, argument: &str, to: Target) -> Result<ExitCode, String> {
    let input = load(cli, argument)?;

    let automaton = match to {
        Target::Nfa => input.automaton.clone(),
        Target::Dfa => {
            let traced = convert::determinize(&input.automaton);
            trace(cli, &traced);
            traced.result
        }
        Target::Min => {
            let dfa = input.as_dfa();
            let traced = convert::minimize(&dfa);
            trace(cli, &traced);
            traced.result
        }
        Target::Regex => {
            let dfa = convert::minimize(&input.as_dfa()).result;
            let traced = convert::to_regex(&dfa);
            trace(cli, &traced);
            println!("{}", traced.result);
            return Ok(ExitCode::SUCCESS);
        }
    };

    print_automaton(cli, &automaton);
    Ok(ExitCode::SUCCESS)
}

fn minimize_command(cli: &Cli, argument: &str) -> Result<ExitCode, String> {
    let input = load(cli, argument)?;
    let dfa = input.as_dfa();
    let traced = convert::minimize(&dfa);
    trace(cli, &traced);

    if !cli.json {
        eprintln!(
            "{} states → {} states",
            dfa.state_count(),
            traced.result.state_count()
        );
    }

    print_automaton(cli, &traced.result);
    Ok(ExitCode::SUCCESS)
}

fn run_command(cli: &Cli, argument: &str, string: &str) -> Result<ExitCode, String> {
    let input = load(cli, argument)?;
    let traced = simulate::simulate(&input.automaton, string);
    trace(cli, &traced);

    let run = &traced.result;
    let accepted = run.verdict.is_accepted();

    if cli.json {
        println!(
            "{}",
            serde_json::to_string_pretty(run).map_err(|e| e.to_string())?
        );
    } else {
        let shown = if string.is_empty() {
            "the empty string".to_string()
        } else {
            format!("`{string}`")
        };
        println!(
            "{shown} is {}",
            match run.verdict {
                simulate::Verdict::Accepted => "accepted",
                simulate::Verdict::Rejected => "rejected",
                simulate::Verdict::Stuck => "rejected — the machine got stuck partway",
            }
        );
    }

    Ok(if accepted {
        ExitCode::SUCCESS
    } else {
        ExitCode::from(NEGATIVE)
    })
}

fn equiv_command(
    cli: &Cli,
    reference: &str,
    candidate: &str,
    show_counterexample: bool,
) -> Result<ExitCode, String> {
    let left = load(cli, reference)?;
    let right = load(cli, candidate)?;

    let found = counterexample::counterexample(&left.automaton, &right.automaton);

    if cli.json {
        let report = serde_json::json!({
            "equivalent": found.is_none(),
            "reference": reference,
            "candidate": candidate,
            "counterexample": found,
        });
        println!(
            "{}",
            serde_json::to_string_pretty(&report).map_err(|e| e.to_string())?
        );
        return Ok(match found {
            None => ExitCode::SUCCESS,
            Some(_) => ExitCode::from(NEGATIVE),
        });
    }

    match found {
        None => {
            println!("equivalent");
            Ok(ExitCode::SUCCESS)
        }
        Some(found) => {
            println!("not equivalent");
            // Printed by default as well as under the flag: a grader that says "wrong"
            // and stops is exactly the JFLAP behaviour this project exists to improve on.
            // The flag stays for scripts that want only the verdict line.
            if show_counterexample || !cli.json {
                println!(
                    "  {}",
                    found.explain(display_name(reference), display_name(candidate))
                );
            }
            Ok(ExitCode::from(NEGATIVE))
        }
    }
}

/// A left-to-right row, for a machine nobody has arranged.
///
/// `to_tikz` needs coordinates and a regular expression does not come with any. A row is the
/// one automatic arrangement that is never actively wrong: TikZ computes the bounding box
/// from its content, so a wide picture scales rather than overflowing, and anyone who wants
/// better has the editor.
///
/// Ordered by breadth-first search from the start state, not by creation order. Thompson's
/// construction numbers states in the order the *parser* met the operators, which for
/// `(a|b)*abb` puts the start state seventh — a figure whose first node is somewhere in the
/// middle reads as a mistake even though every edge in it is right. Walking the machine
/// instead puts the start on the left and each state near the one that reaches it.
///
/// The spacing matches the canvas's own, so a row from here and a row from the editor produce
/// the same figure.
fn row(automaton: &Automaton) -> BTreeMap<StateId, TikzPoint> {
    /// One canvas grid step, in the units `to_tikz` scales from.
    const SPACING: f64 = 96.0;

    let mut order: Vec<StateId> = Vec::with_capacity(automaton.states.len());
    let mut seen: BTreeSet<StateId> = BTreeSet::new();
    let mut queue: VecDeque<StateId> = VecDeque::new();

    if automaton.states.contains_key(&automaton.start) {
        queue.push_back(automaton.start);
        seen.insert(automaton.start);
    }

    while let Some(id) = queue.pop_front() {
        order.push(id);
        // Transition order, not sorted: it is the order the machine was written in, which is
        // the closest thing to an author's intent available here.
        for next in automaton
            .transitions
            .iter()
            .filter(|t| t.from == id)
            .map(|t| t.to)
        {
            if seen.insert(next) {
                queue.push_back(next);
            }
        }
    }

    // Anything the start state cannot reach still needs a position — an unreachable state is
    // a thing this tool exists to point out, and dropping it from the figure would hide it.
    order.extend(automaton.states.keys().filter(|id| !seen.contains(id)));

    order
        .into_iter()
        .enumerate()
        .map(|(index, id)| {
            (
                id,
                TikzPoint {
                    #[expect(
                        clippy::cast_precision_loss,
                        reason = "a machine with 2^53 states has other problems"
                    )]
                    x: index as f64 * SPACING,
                    y: 0.0,
                },
            )
        })
        .collect()
}

fn export_command(cli: &Cli, argument: &str, format: Format) -> Result<ExitCode, String> {
    let input = load(cli, argument)?;

    match format {
        Format::Dot => println!("{}", to_dot(&input.automaton)),
        Format::Tikz => {
            // A saved document carries the arrangement someone made, and that is the whole
            // promise of this export: the figure looks like the diagram they were reading.
            // A machine built from a regular expression has never been arranged, so it gets
            // a row — predictable, and honest about being automatic.
            // `io::Point` and `tikz::Point` are deliberately different types — one is part
            // of the file format, the other an argument to a function — so a document's
            // layout is converted rather than passed through.
            let layout = match &input.document {
                Some(document) if !document.layout.is_empty() => document
                    .layout
                    .iter()
                    .map(|(&id, at)| (id, TikzPoint { x: at.x, y: at.y }))
                    .collect(),
                _ => row(&input.automaton),
            };
            println!(
                "{}",
                to_tikz(&input.automaton, &layout, Notation::default())
            );
        }
        Format::Kln => {
            // Round-tripping a document preserves its layout and title; a machine built
            // from a regex has neither.
            let document = input
                .document
                .clone()
                .unwrap_or_else(|| Document::new(input.automaton.clone()));
            println!("{}", document.to_json());
        }
    }

    Ok(ExitCode::SUCCESS)
}

fn examples_command(cli: &Cli) {
    for (name, automaton) in [
        ("even_number_of_as", examples::even_number_of_as()),
        ("ends_with_ab", examples::ends_with_ab()),
    ] {
        if cli.json {
            println!(
                "{}",
                Document::new(automaton).titled(name).to_json_compact()
            );
        } else {
            println!(
                "{name:<20} {:>2} states  {}",
                automaton.state_count(),
                automaton.determinism().label()
            );
        }
    }
}

/// Write a machine to stdout in whichever form was asked for.
fn print_automaton(cli: &Cli, automaton: &Automaton) {
    if cli.json {
        println!("{}", Document::new(automaton.clone()).to_json());
    } else {
        println!("{}", to_dot(automaton));
    }
}

/// Build a problem link.
///
/// The target is parsed here rather than trusted, so a typo becomes an error at the moment a
/// lecturer makes the link rather than a broken page for thirty students. A budget is checked
/// against the language for the same reason: a problem that cannot be solved is not hard, it
/// is broken, and finding that out from a student is the expensive way.
fn problem_command(
    prompt: &str,
    target: &str,
    budget: Option<usize>,
    origin: &str,
) -> Result<ExitCode, String> {
    let mut spec = ProblemSpec::new(prompt, target);
    if let Some(limit) = budget {
        spec = spec.with_budget(limit);
    }

    let minimum = spec
        .minimum_states()
        .ok_or_else(|| format!("the target `{target}` is not a regular expression I can read"))?;

    if let Some(limit) = budget {
        if limit < minimum {
            return Err(format!(
                "a budget of {limit} cannot be met: the smallest machine for `{target}` has \
                 {minimum} states"
            ));
        }
    }

    let json = serde_json::to_string(&spec).map_err(|error| error.to_string())?;
    let payload = encode_payload(json.as_bytes());
    println!("{}/solve#p={}", origin.trim_end_matches('/'), payload);

    eprintln!("smallest possible answer: {minimum} states");
    Ok(ExitCode::SUCCESS)
}

/// Base64url without padding, matching what the web codec reads.
///
/// The `u` marker is the web share format's "not compressed" case, which exists precisely
/// because `CompressionStream` is not available everywhere. Using it here means the CLI needs
/// no compressor at all — a problem spec is a few hundred bytes, and the link is short either
/// way.
fn encode_payload(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    let mut out = String::from("u");
    for chunk in bytes.chunks(3) {
        let b = [
            chunk[0],
            chunk.get(1).copied().unwrap_or(0),
            chunk.get(2).copied().unwrap_or(0),
        ];
        let n = (u32::from(b[0]) << 16) | (u32::from(b[1]) << 8) | u32::from(b[2]);
        let indices = [n >> 18, (n >> 12) & 63, (n >> 6) & 63, n & 63];
        for (position, index) in indices.iter().enumerate() {
            if position <= chunk.len() {
                out.push(ALPHABET[*index as usize] as char);
            }
        }
    }
    out
}

/// Grade a directory.
fn grade_command(
    cli: &Cli,
    directory: &str,
    against: &str,
    format: GradeFormat,
) -> Result<ExitCode, String> {
    let reference = Input::resolve(against, cli.from)
        .map_err(|error| error.to_string())?
        .as_dfa();

    let root = std::path::Path::new(directory);
    if !root.is_dir() {
        return Err(format!("{directory} is not a directory"));
    }

    let rows = grade::grade_all(root, &reference);
    if rows.is_empty() {
        return Err(format!(
            "no .kln or .jff files under {directory} — is that the right directory?"
        ));
    }

    print!(
        "{}",
        match format {
            GradeFormat::Csv => grade::as_csv(&rows),
            GradeFormat::Json => grade::as_json(&rows),
            GradeFormat::Md => grade::as_markdown(&rows),
        }
    );

    // On stderr, so it never lands in the middle of a CSV being piped into a spreadsheet.
    eprintln!("{}", grade::summary(&rows));

    // Zero whatever the verdicts are: a grader's exit code reports whether *grading* worked,
    // not whether the class passed. A non-zero exit for "someone got it wrong" would make
    // every CI wrapper around this fail on a normal Tuesday.
    Ok(ExitCode::SUCCESS)
}

#[cfg(test)]
mod tests {
    use super::*;
    use kleene_core::builder::AutomatonBuilder;

    /// A chain whose creation order is deliberately not its reading order: `c` is built first,
    /// and the start state `a` is built last.
    fn out_of_order() -> Automaton {
        AutomatonBuilder::new(["x"])
            .state("c")
            .state("b")
            .accepting("a")
            .start("a")
            .edge("a", "b", "x")
            .edge("b", "c", "x")
            .build()
    }

    #[test]
    fn the_start_state_is_leftmost() {
        let machine = out_of_order();
        let laid_out = row(&machine);

        // The whole reason this is a walk rather than an enumeration. A figure whose first
        // node is in the middle reads as a mistake even when every edge in it is correct.
        assert_eq!(laid_out[&machine.start].x, 0.0);
    }

    #[test]
    fn states_follow_the_ones_that_reach_them() {
        let machine = out_of_order();
        let laid_out = row(&machine);

        let at = |label: &str| {
            let id = machine
                .states
                .iter()
                .find(|(_, state)| state.label == label)
                .map(|(id, _)| *id)
                .expect("the state exists");
            laid_out[&id].x
        };

        assert!(at("a") < at("b"), "a reaches b");
        assert!(at("b") < at("c"), "b reaches c");
    }

    #[test]
    fn a_row_is_flat_and_evenly_spaced() {
        let machine = out_of_order();
        let laid_out = row(&machine);

        let mut xs: Vec<f64> = laid_out.values().map(|at| at.x).collect();
        xs.sort_by(f64::total_cmp);

        assert_eq!(xs, vec![0.0, 96.0, 192.0]);
        assert!(laid_out.values().all(|at| at.y == 0.0));
    }

    #[test]
    fn a_state_nothing_reaches_still_gets_a_position() {
        // An unreachable state is something this tool exists to point out. Dropping it from
        // the export would hide the very thing the validator flags.
        let machine = AutomatonBuilder::new(["x"])
            .accepting("start")
            .state("orphan")
            .start("start")
            .build();

        let laid_out = row(&machine);
        assert_eq!(laid_out.len(), machine.states.len());
    }

    #[test]
    fn every_state_is_placed_exactly_once() {
        let machine = out_of_order();
        let laid_out = row(&machine);

        let mut xs: Vec<f64> = laid_out.values().map(|at| at.x).collect();
        xs.sort_by(f64::total_cmp);
        xs.dedup();

        assert_eq!(xs.len(), machine.states.len(), "no two states share a slot");
    }
}
