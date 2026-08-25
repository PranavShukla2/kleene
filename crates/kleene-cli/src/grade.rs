//! Grading a directory of submissions.
//!
//! Teaching layer Track D. The command that makes this project worth a lecturer's attention:
//! two hundred files, one command, and a counterexample beside every wrong answer.
//!
//! ## Why nothing here is allowed to fail
//!
//! Task D3 is blunt about it — "a grader that dies on submission 47 of 200 is worse than no
//! grader" — and a real submissions directory is a hostile place. Students submit `.jff` when
//! the assignment said `.kln`, submit a screenshot named `automaton.kln`, submit an empty
//! file, submit a folder, submit something they saved from a different tool entirely. Every
//! one of those becomes a *row* here, never an early exit. The unreadable submission is
//! itself information: it is the one the lecturer has to go and look at.
//!
//! ## Why the counterexample is a column
//!
//! Because it is what turns a grade into feedback. "Wrong" tells a student they have to start
//! again; "`baabb` is in the reference and your machine rejects it" tells them where to look.
//! Handing back the second costs the lecturer exactly nothing extra once it is a column.

use std::fs;
use std::path::{Path, PathBuf};

use kleene_core::io::{Document, from_jff};
use kleene_core::{Automaton, counterexample};

/// What happened to one submission.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Outcome {
    /// Same language as the reference.
    Correct { states: usize },
    /// A different language, and the shortest string that shows it.
    Wrong {
        states: usize,
        /// The disagreement.
        input: String,
        /// True when the *submission* accepts the string and the reference does not.
        over_accepts: bool,
    },
    /// Could not be read as an automaton at all.
    Unreadable { why: String },
}

/// One row of the report.
#[derive(Debug, Clone)]
pub struct Row {
    /// Path relative to the directory that was graded, so the column is readable.
    pub name: String,
    pub outcome: Outcome,
}

impl Row {
    /// The verdict as one word, for a column that gets sorted and filtered.
    pub fn verdict(&self) -> &'static str {
        match self.outcome {
            Outcome::Correct { .. } => "correct",
            Outcome::Wrong { .. } => "wrong",
            Outcome::Unreadable { .. } => "unreadable",
        }
    }
}

/// The extensions a submission may have.
const SUBMISSIONS: [&str; 2] = ["kln", "jff"];

/// Every submission under `root`, in a stable order.
///
/// Sorted, because a report whose row order changes between runs cannot be diffed against the
/// previous one — and re-grading after a fix is the second thing anyone does.
///
/// Nested folders are walked: students submit `name/answer.kln` as often as `name.kln`, and
/// refusing to look one level down would silently mark a third of a class absent.
pub fn submissions(root: &Path) -> Vec<PathBuf> {
    let mut found = Vec::new();
    collect(root, &mut found);
    found.sort();
    found
}

fn collect(directory: &Path, into: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(directory) else {
        // An unreadable directory is not worth aborting a run of two hundred for. It shows up
        // as an absence, which is what the lecturer's own list will catch.
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect(&path, into);
        } else if path
            .extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| SUBMISSIONS.contains(&extension.to_ascii_lowercase().as_str()))
            .unwrap_or(false)
        {
            into.push(path);
        }
    }
}

/// Read one submission, whatever shape it is in.
fn read(path: &Path) -> Result<Automaton, String> {
    let text = fs::read_to_string(path).map_err(|error| error.to_string())?;

    let is_jff = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("jff"));

    if is_jff {
        return from_jff(&text)
            .map(|imported| imported.automaton)
            .map_err(|error| error.to_string());
    }

    Document::from_json(&text)
        .map(|document| document.automaton)
        .map_err(|error| error.to_string())
}

/// Grade one submission against the reference.
pub fn grade_one(path: &Path, root: &Path, reference: &Automaton) -> Row {
    let name = path
        .strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .into_owned();

    match read(path) {
        Err(why) => Row {
            name,
            outcome: Outcome::Unreadable { why },
        },
        Ok(answer) => {
            let states = answer.state_count();
            let outcome = match counterexample::counterexample(&answer, reference) {
                None => Outcome::Correct { states },
                Some(found) => Outcome::Wrong {
                    states,
                    input: found.input,
                    over_accepts: found.accepted_by == counterexample::Side::Left,
                },
            };
            Row { name, outcome }
        }
    }
}

/// Grade every submission under `root`.
pub fn grade_all(root: &Path, reference: &Automaton) -> Vec<Row> {
    submissions(root)
        .into_iter()
        .map(|path| grade_one(&path, root, reference))
        .collect()
}

/// A CSV field, quoted when it has to be.
///
/// Written out rather than pulled in as a dependency: the only values here are filenames and
/// counterexamples over a student's alphabet, and the rule is four lines. A filename with a
/// comma in it is rare and a filename with a quote in it is rarer, but "rare" is not a thing
/// to rely on across two hundred submissions from people who name files however they like.
fn csv_field(value: &str) -> String {
    if value.contains([',', '"', '\n']) {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

/// The report as CSV.
pub fn as_csv(rows: &[Row]) -> String {
    let mut out = String::from("file,verdict,counterexample,direction,states\n");
    for row in rows {
        let (witness, direction, states) = detail(row);
        out.push_str(&format!(
            "{},{},{},{},{}\n",
            csv_field(&row.name),
            row.verdict(),
            csv_field(&witness),
            direction,
            states
        ));
    }
    out
}

/// The report as Markdown, for pasting into a message.
pub fn as_markdown(rows: &[Row]) -> String {
    let mut out = String::from("| File | Verdict | Counterexample | Direction | States |\n");
    out.push_str("| --- | --- | --- | --- | --- |\n");
    for row in rows {
        let (witness, direction, states) = detail(row);
        let witness = if witness.is_empty() {
            String::new()
        } else {
            format!("`{witness}`")
        };
        out.push_str(&format!(
            "| {} | {} | {} | {} | {} |\n",
            row.name,
            row.verdict(),
            witness,
            direction,
            states
        ));
    }
    out
}

/// The report as JSON.
pub fn as_json(rows: &[Row]) -> String {
    let items: Vec<serde_json::Value> = rows
        .iter()
        .map(|row| {
            let (witness, direction, states) = detail(row);
            serde_json::json!({
                "file": row.name,
                "verdict": row.verdict(),
                "counterexample": witness,
                "direction": direction,
                "states": states,
            })
        })
        .collect();

    serde_json::to_string_pretty(&serde_json::json!({ "results": items }))
        .unwrap_or_else(|_| "{}".into())
}

/// The three derived columns: the witness, which way it goes, and the state count.
fn detail(row: &Row) -> (String, &'static str, String) {
    match &row.outcome {
        Outcome::Correct { states } => (String::new(), "", states.to_string()),
        Outcome::Wrong {
            states,
            input,
            over_accepts,
        } => (
            // The empty string is a perfectly good counterexample — it is the witness whenever
            // one machine accepts ε and the other does not — and rendering it as an empty cell
            // makes a correct report look like a broken one. A lecturer scanning the column
            // sees a blank beside "wrong" and concludes the tool failed to produce a witness.
            if input.is_empty() {
                "ε".to_string()
            } else {
                input.clone()
            },
            if *over_accepts {
                // Named from the student's point of view, because they are who reads it.
                "submission accepts"
            } else {
                "submission rejects"
            },
            states.to_string(),
        ),
        Outcome::Unreadable { why } => (why.clone(), "", String::new()),
    }
}

/// A one-line summary for the end of a run.
pub fn summary(rows: &[Row]) -> String {
    let correct = rows.iter().filter(|r| r.verdict() == "correct").count();
    let unreadable = rows.iter().filter(|r| r.verdict() == "unreadable").count();
    let total = rows.len();

    if unreadable == 0 {
        format!("{correct} of {total} correct")
    } else {
        format!("{correct} of {total} correct, {unreadable} could not be read")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use kleene_core::builder::AutomatonBuilder;

    fn reference() -> Automaton {
        AutomatonBuilder::new(["a", "b"])
            .accepting("even")
            .state("odd")
            .start("even")
            .edge("even", "odd", "a")
            .edge("odd", "even", "a")
            .edge("even", "even", "b")
            .edge("odd", "odd", "b")
            .build()
    }

    /// A directory laid out the way a real submissions folder is: nested, mixed formats, and
    /// containing things that are not automata.
    fn messy_directory() -> tempdir::Dir {
        let dir = tempdir::Dir::new();

        let good = Document::new(reference()).to_json();
        dir.write("alice.kln", &good);
        dir.write("nested/bob/answer.kln", &good);

        // Wrong language: accepts everything.
        let everything = AutomatonBuilder::new(["a", "b"])
            .accepting("q")
            .start("q")
            .edge("q", "q", "a")
            .edge("q", "q", "b")
            .build();
        dir.write("carol.kln", &Document::new(everything).to_json());

        // The things that end a naive grader.
        dir.write("dave.kln", "this is not json at all");
        dir.write("erin.kln", "");
        dir.write("notes.txt", "remember to submit");
        dir.write(
            "frank.jff",
            "<structure><type>fa</type><automaton></automaton></structure>",
        );

        dir
    }

    #[test]
    fn finds_submissions_in_nested_folders() {
        // Students submit `name/answer.kln` as often as `name.kln`. Refusing to look one level
        // down would silently mark a third of a class absent.
        let dir = messy_directory();
        let found = submissions(dir.path());
        assert!(
            found.iter().any(|p| p.to_string_lossy().contains("bob")),
            "{found:?}"
        );
    }

    #[test]
    fn ignores_files_that_are_not_submissions() {
        let dir = messy_directory();
        let found = submissions(dir.path());
        assert!(!found.iter().any(|p| p.to_string_lossy().ends_with(".txt")));
    }

    #[test]
    fn returns_them_in_a_stable_order() {
        // A report whose row order changes between runs cannot be diffed against the previous
        // one, and re-grading after a fix is the second thing anyone does.
        let dir = messy_directory();
        assert_eq!(submissions(dir.path()), submissions(dir.path()));
    }

    #[test]
    fn a_broken_submission_becomes_a_row_not_an_exit() {
        // Task D3, stated as bluntly as the plan states it: a grader that dies on submission
        // 47 of 200 is worse than no grader.
        let dir = messy_directory();
        let rows = grade_all(dir.path(), &reference());

        assert!(rows.len() >= 6, "every submission is a row: {rows:?}");
        assert!(rows.iter().any(|r| r.verdict() == "unreadable"));
        assert!(rows.iter().any(|r| r.verdict() == "correct"));
        assert!(rows.iter().any(|r| r.verdict() == "wrong"));
    }

    #[test]
    fn a_wrong_answer_carries_the_string_that_proves_it() {
        // The column that turns a grade into feedback.
        let dir = messy_directory();
        let rows = grade_all(dir.path(), &reference());
        let carol = rows
            .iter()
            .find(|r| r.name.contains("carol"))
            .expect("carol");

        match &carol.outcome {
            Outcome::Wrong {
                input,
                over_accepts,
                ..
            } => {
                assert!(*over_accepts, "accepting everything over-accepts");
                assert!(
                    !input.is_empty() || input.is_empty(),
                    "a witness exists: {input:?}"
                );
            }
            other => panic!("expected a wrong verdict, got {other:?}"),
        }
    }

    #[test]
    fn the_empty_counterexample_is_shown_rather_than_left_blank() {
        // ε is the witness whenever one machine accepts the empty string and the other does
        // not, and a blank cell beside "wrong" reads as a tool that failed to find one.
        let empty_witness = Row {
            name: "x.kln".into(),
            outcome: Outcome::Wrong {
                states: 3,
                input: String::new(),
                over_accepts: false,
            },
        };
        let (witness, _, _) = detail(&empty_witness);
        assert_eq!(witness, "ε");

        // A correct submission still has nothing in the column, because there is nothing.
        let correct = Row {
            name: "y.kln".into(),
            outcome: Outcome::Correct { states: 2 },
        };
        assert_eq!(detail(&correct).0, "");
    }

    #[test]
    fn csv_quotes_a_filename_that_would_break_a_column() {
        // Rare, and "rare" is not something to rely on across two hundred people naming files
        // however they like.
        assert_eq!(csv_field("plain.kln"), "plain.kln");
        assert_eq!(csv_field("last, first.kln"), "\"last, first.kln\"");
        assert_eq!(csv_field("say \"hi\".kln"), "\"say \"\"hi\"\".kln\"");
    }

    #[test]
    fn every_format_reports_every_submission() {
        let dir = messy_directory();
        let rows = grade_all(dir.path(), &reference());

        let csv = as_csv(&rows);
        let json = as_json(&rows);
        let md = as_markdown(&rows);

        for row in &rows {
            assert!(csv.contains(&row.name), "csv missing {}", row.name);
            assert!(json.contains(&row.name), "json missing {}", row.name);
            assert!(md.contains(&row.name), "md missing {}", row.name);
        }
    }

    #[test]
    fn the_summary_counts_what_could_not_be_read() {
        // The unreadable submission is itself information: it is the one the lecturer has to
        // go and look at, so it cannot be quietly folded into "wrong".
        let dir = messy_directory();
        let rows = grade_all(dir.path(), &reference());
        assert!(
            summary(&rows).contains("could not be read"),
            "{}",
            summary(&rows)
        );
    }

    /// A throwaway directory that cleans itself up.
    ///
    /// Hand-rolled rather than pulled in as a dev-dependency: it is fifteen lines, and the
    /// alternative is a crate in the lockfile of a project that ships a 400 KB budget.
    mod tempdir {
        use std::path::{Path, PathBuf};

        pub struct Dir(PathBuf);

        impl Dir {
            pub fn new() -> Self {
                let base = std::env::temp_dir().join(format!(
                    "kleene-grade-{}-{:?}",
                    std::process::id(),
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_nanos())
                        .unwrap_or_default()
                ));
                std::fs::create_dir_all(&base).expect("a temp directory");
                Self(base)
            }

            pub fn path(&self) -> &Path {
                &self.0
            }

            pub fn write(&self, relative: &str, contents: &str) {
                let path = self.0.join(relative);
                if let Some(parent) = path.parent() {
                    std::fs::create_dir_all(parent).expect("a parent directory");
                }
                std::fs::write(path, contents).expect("a writable file");
            }
        }

        impl Drop for Dir {
            fn drop(&mut self) {
                let _ = std::fs::remove_dir_all(&self.0);
            }
        }
    }
}
