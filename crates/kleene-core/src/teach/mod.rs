//! The teaching layer: problems, checking, and the games (roadmap §9).
//!
//! Everything here obeys one rule that is not negotiable and not a preference: **no server.**
//! A problem travels in a link, an answer is checked in the browser that drew it, and progress
//! lives in the student's own storage. The moment something in this module needs a database,
//! the feature is wrong rather than the constraint — holding a class list means data-protection
//! duties, and a submission deadline is an uptime promise landing in the week of finals.
//!
//! What that buys is not only simplicity. A lecturer can hand out a link without an account,
//! without a purchase order, and without asking anyone's IT department for anything.

pub mod problem;
pub mod set;

pub use problem::{Failure, Feedback, ProblemSpec, SPEC_VERSION, check};
pub use set::{SetProblem, Tier, problem_set};
