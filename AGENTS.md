# Development and promotion rules

## Branches

- `dev`: development branch for coding agents. Start all implementation work here.
- `qa`: testing and acceptance branch. Promote completed changes from `dev` only after a successful build and explicit user approval for the proposed changes.
- `main`: production branch. Promote only changes that have completed QA testing, passed all required tests, and received explicit user approval for that production release.

## Required workflow

1. Use the existing checkout; cloud tasks already have isolated environments. Do not create another Git worktree unless the user requests one.
2. Check the working tree and branch before editing. Preserve existing user work and use `dev` for implementation.
3. Build the completed change using the project's documented commands. Report the result and present the specific changes for user review. Obtain explicit approval before updating `qa`.
4. Promote approved changes from `dev` to `qa`, preferably through a pull request. Test the exact QA revision and record the commands, results, and any manual acceptance checks.
5. After QA is complete and all required tests pass, present the tested revision and results to the user. Obtain separate, explicit approval before promoting that revision from `qa` to `main`.
6. If the proposed revision changes after testing or approval, repeat affected tests and obtain renewed approval for the changed revision.

Never push application code directly to `main`, promote untested changes, treat skipped or unavailable tests as passing, automatically merge promotions, or bypass branch protections. A request to develop a feature is not approval to promote it to QA or production. Never force-push or delete these environment branches without explicit user authorization.

## Enforcement and initial state

This repository was initialized with instructions only; no application, build command, or test suite exists yet. Application promotions remain blocked until real build and test checks are available and pass.

These instructions govern agents but do not enforce GitHub permissions. Configure GitHub branch rules for `qa` and `main` to require pull requests and human approval, prevent direct pushes, force pushes, and deletion, and disallow bypasses. Once application CI exists, require its actual build and test status checks before merging. Production approval must come from the user or a reviewer they explicitly designate.
