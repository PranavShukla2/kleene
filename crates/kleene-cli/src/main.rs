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

mod input;

use std::process::ExitCode;

use clap::{Parser, Subcommand, ValueEnum};
use kleene_core::io::{Document, to_dot};
use kleene_core::{Automaton, Traced, convert, counterexample, examples, simulate};

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

fn export_command(cli: &Cli, argument: &str, format: Format) -> Result<ExitCode, String> {
    let input = load(cli, argument)?;

    match format {
        Format::Dot => println!("{}", to_dot(&input.automaton)),
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
