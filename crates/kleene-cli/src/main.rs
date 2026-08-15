//! The `kleene` command-line tool.
//!
//! Phase 0 scaffolding: the argument surface exists and `--version` works, so the release
//! pipeline has something real to cross-compile. The subcommands that do the work arrive in
//! Phase 1.
//!
//! The design intent worth preserving as this grows: every subcommand takes `--verbose`,
//! which prints the `Traced` steps the algorithm already produced. The CLI never explains
//! anything itself — it renders reasoning that `kleene-core` generated.

#![forbid(unsafe_code)]

use clap::{Parser, Subcommand};
use kleene_core::examples;

#[derive(Parser)]
#[command(
    name = "kleene",
    version,
    about = "Automata theory from the command line",
    long_about = "Convert, minimize, simulate and compare finite automata.\n\
                  Every algorithm can show its reasoning with --verbose."
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// List the built-in example automata.
    Examples,
    /// Print the engine version.
    Engine,
}

fn main() {
    match Cli::parse().command {
        Command::Examples => {
            for (name, automaton) in [
                ("even_number_of_as", examples::even_number_of_as()),
                ("ends_with_ab", examples::ends_with_ab()),
            ] {
                println!(
                    "{name:<20} {:>2} states  {}",
                    automaton.state_count(),
                    automaton.determinism().label()
                );
            }
        }
        Command::Engine => println!("kleene-core {}", kleene_core::VERSION),
    }
}
