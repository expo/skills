# Expo Project Structure Eval Shape

## Status

Approved for a draft, shape-only pull request. The eval is intentionally not executable yet.

## Goal

Show how a normal skill in `expo/skills` could own a colocated, task-oriented TypeScript eval using the style introduced for the `expo-sqlite` skill. The draft gives Expo maintainers concrete files to review before `eval-experiments` learns how to discover and execute them.

## Decisions

- Pilot only `expo-project-structure`.
- Put the eval under the skill's hidden `.evals/` directory.
- Define the task and its checks together in TypeScript.
- Reuse Kudo's `agentEval(..., defineChecks)` style rather than copying the central JSON registry.
- Keep common scanning, glob, AST, skip, and reporting machinery reusable in `@expo/skill-eval-kit`; do not introduce a global registry of named checks in this repository.
- Treat this as a draft consumer-contract proposal. Do not vendor an agent runner or create a second implementation of the harness.

## Proposed Files

```text
plugins/expo/skills/expo-project-structure/
  .evals/
    README.md
    setup.ts
    001-scaffold-project.eval.ts
```

`README.md` explains the experimental status, the unavailable dependency, the missing skill-only setup support, and the intended `eval-experiments` follow-up.

`setup.ts` returns a plain setup descriptor for a plugin-owned skill. Unlike the current module-oriented `ProjectSetup`, it identifies the skill directory and base Expo template but has no npm package under test. This is intentionally the consumer-side shape that the eval kit will need to support.

`001-scaffold-project.eval.ts` contains the user task and case-local assertions. It imports the proposed `agentEval` and `expect` surface from `@expo/skill-eval-kit`, matching the SQLite cases.

## Task

The task starts from a blank TypeScript Expo project and asks the agent to scaffold a small Expo Router application with home and settings routes, a reusable button, and a date-formatting utility with a unit test. It asks for a maintainable layout without spelling out the exact directories that the skill recommends.

The same task is intended to run with and without the skill once execution support exists.

## Checks

The case keeps the intent of the current `eval-experiments` coverage but expresses it in task context:

1. Router files live under `src/app/`.
2. Reusable UI lives under `src/components/` rather than the route directory.
3. The route directory contains routes and layouts, not reusable components or utilities.
4. Styles remain in component files; no separate `*.styles.*` files are introduced.
5. The date utility and its test are colocated; no `__tests__/` directory is introduced.
6. `tsconfig.json` configures an `@/*` path alias for `src/*`.

These are case-local assertions, not globally registered check IDs. If identical implementation logic recurs in later evals, it can be extracted into typed helper functions without separating the assertions from their tasks.

## Dependency Boundary

`@expo/skill-eval-kit` is not published, and its current draft contract assumes an npm package under test. Therefore this draft does not add a package dependency, run the eval in CI, or claim that the TypeScript compiles against the current kit.

The follow-up work in `eval-experiments` must:

- support plugin-owned skills that have no package to link;
- discover colocated `.evals` cases from a supplied skills repository;
- run the coding agent through the shared EAS harness;
- collect traces, workspaces, structured check results, and reports; and
- preserve with-skill and without-skill conditions.

## Repository and Packaging Effects

The `.evals` directory will sit inside the skill directory and will currently be copied by `npx skills`; it may also be included in installed plugin payloads. It has no `SKILL.md`, so it is not discovered as a separate skill or automatically loaded into agent context, but the files are still distributed on disk.

This draft accepts that small temporary cost so reviewers can evaluate true colocation. The pull request must call the behavior out explicitly. Before this pattern is rolled out across more skills, move eval assets outside the distributed plugin area unless the supported installation paths gain a reliable shared exclusion mechanism.

The existing central uptake checks in `eval-experiments` remain operational and unchanged. They are not removed until a later integration reads the colocated TypeScript case.

## Verification

For this first PR:

- run the existing `expo/skills` repository validation;
- format the new TypeScript and Markdown files;
- inspect that every assertion follows an instruction in `expo-project-structure/SKILL.md`;
- confirm that the new `.evals` directory is not included by any existing TypeScript build or test suite; and
- state clearly in the PR body that the eval is illustrative and not yet runnable.

No agent run, EAS workflow run, or uplift result is claimed by this PR.

## Pull Request Positioning

Open the pull request as a draft. The review question is whether this is the right maintainer-owned task/check shape for normal Expo skills. Runtime integration and API finalization belong in follow-up work after maintainers agree on that shape.

The pull request body must also identify distribution of `.evals` as a known temporary compromise and record moving eval assets outside the distributed plugin area as follow-up work.
