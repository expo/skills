# Expo project structure evals

This directory sketches the maintainer-owned TypeScript eval shape proposed for the `expo-project-structure` skill. It follows the colocated `agentEval()` style used by the `expo-sqlite` skill in the Expo SDK repository.

## Experimental status

This eval is **not runnable yet**:

- `@expo/skill-eval-kit` is not published.
- The current draft kit assumes every skill belongs to an npm package under test. This plugin-owned skill has no package to link.
- The existing `eval-experiments` EAS workflow does not discover or execute evals from `expo/skills`.

The files intentionally show the consumer API we want to discuss before finalizing that runtime contract. Do not vendor an agent runner here.

## Intended execution

Once the shared harness supports plugin-owned skills, it should run this task in both with-skill and without-skill conditions. `eval-experiments` should continue to own agent launch, authentication, traces, artifacts, repetitions, and reporting.

## Distribution note

Because `.evals` currently lives inside the skill directory, `npx skills` copies it and installed plugin payloads may include it. The directory has no `SKILL.md`, so it is not discovered as a separate skill or automatically loaded into agent context.

This is a temporary compromise for reviewing true colocation. Before this pattern is adopted across more skills, move eval assets outside the distributed plugin area unless every supported installer gains a reliable shared exclusion mechanism.
