# Kleene for GitHub Classroom

A template for setting an automata assignment that marks itself, with no server, no account,
and nothing for a department to procure.

Copy this directory into a repository, make it a GitHub Classroom template, and every
submission is graded by the same engine the students used to draw their answers.

## What a student does

1. Accept the assignment. They get a repository containing `problems/` and this README.
2. Open [kleene.pranavmshukla.in/editor](https://kleene.pranavmshukla.in/editor), draw a
   machine, and press **Save**.
3. Commit the `.kln` file into `submission/` under the name the problem asks for.
4. Push. The Action runs and the checks tab says what is wrong, with a counterexample.

They never install anything. A `.jff` exported from JFLAP works too — the importer reads it.

## What you do

Put a reference answer in `reference/` for each problem. **The references are the answer key
and they live in your repository, not in the student's** — which is the point: the browser
check a student uses is inspectable by design, and this is the path that is not.

```
reference/even-as.kln       ← the answer
submission/even-as.kln      ← what the student commits
```

Generate a reference from an expression without drawing anything:

```sh
kleene export "(b + ab*a)*" --format kln > reference/even-as.kln
```

## Why the feedback is worth more than the mark

The Action reports the shortest string on which a submission and the reference disagree, and
which way. A student who is told *"`baabb` is in the reference and your machine rejects it"*
has somewhere to look; one who is told *"incorrect"* has to start again. Both cost you the same
to hand back.

## Grading locally instead

If you would rather not use Actions at all, the same thing is one command over a directory of
downloaded submissions:

```sh
kleene grade submissions/ --against reference/even-as.kln --format csv > marks.csv
```

It reports every file, including the ones that would not open — a grader that stops on
submission 47 of 200 is worse than no grader, so this one never stops.
