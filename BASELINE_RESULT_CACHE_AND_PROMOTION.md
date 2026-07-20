# Baseline Result Cache and Promotion

## Implementation status

This is the design for the skill-eval baseline cache that ships in
`kartik/skill-eval-main-vs-pr-comparison` (PR #111). What actually landed
differs from the original draft below in one important way: **this repo's
skill-eval CI runs on EAS Workflows** (`.eas/workflows/skill-eval-ci.yml`),
not GitHub Actions -- the mechanics section was rewritten around EAS's own
primitives (`eas/restore_cache`, `eas/save_cache`, `eas/upload_artifact`)
instead of `actions/cache` / `actions/upload-artifact`.

**Shipped (v1):**

- `scripts/calculate-eval-fingerprint.py` -- one script, called identically
  from both workflows.
- `scripts/validate-result-bundle.py` -- writes and verifies `manifest.json`.
- `.eas/workflows/skill-eval-ci.yml`'s three `author_app_<prd>_main` /
  `eval_skill_<prd>_main` job pairs now restore an exact-fingerprint cache
  entry before authoring anything, and skip authoring + re-analysis entirely
  on a hit. The `_pr` job pairs are untouched.
- `.eas/workflows/skill-eval-main-baseline.yml` -- a new trusted workflow,
  triggered on push to `main`, that populates that cache. It always
  recomputes on a miss (see "Deferred to v2" below) and is the only workflow
  permitted to write the shared cache.

**Deferred to v2 -- promoting an already-computed PR candidate without
recomputing:**

The original design's Workflow 2 step 3 ("find a matching candidate
artifact" so a merge can promote a PR's already-computed result instead of
recomputing on `main`) needs to read an artifact produced by a *different,
earlier* workflow run -- the PR run that computed it. EAS's
`eas/upload_artifact` / `eas/download_artifact` are documented for same-run,
cross-job use (see `eas/download_artifact`'s "retrieved in a later job"
wording); cross-run retrieval from a different, earlier run was not
confirmed against the available docs or the `eas` CLI (`eas workflow:runs`
and `eas workflow:view` list/inspect past runs and could plausibly be
scripted into a search, but that's unproven, not implemented). Per this
doc's own design principle -- "promotion is an optimization; recalculation
is always the correctness fallback" -- v1 ships with recomputation as the
*only* path on a cache miss, which is still a real win: a fresh authoring
run now happens once per merge to `main` instead of once per PR that
compares against that merge. Candidate promotion can be added later without
changing the fingerprint, manifest, or PR-side caching already shipped.

The rest of this document is the original design, updated in place to match
what actually ships.

## Objective

Reduce skill-evaluation compute by reusing the last valid evaluation of the
`main` branch as the "before" result for pull requests. When a pull request
is merged, automatically populate the next `main` baseline.

The system must never reuse a result produced from different skill content,
harness code, evaluation configuration, agent, or model.

## Desired Lifecycle

```text
main baseline A
      |
      v
PR compares A against candidate B
      |
      v
PR merges
      |
      v
trusted main workflow computes and caches B (or reuses a hit if nothing
relevant changed)
      |
      v
future PRs compare baseline B against their candidate
```

There are two workflows:

1. `.eas/workflows/skill-eval-ci.yml` (PR-triggered): restores the correct
   `main` baseline for each PRD's "main" variant, computing on a cache miss;
   evaluates the PR's own "pr" variant unconditionally; reports the
   comparison. It never writes the shared cache.
2. `.eas/workflows/skill-eval-main-baseline.yml` (trusted, push-to-`main`
   triggered): computes the fingerprint for main's current state; if the
   exact-match cache is already populated, does nothing; otherwise evaluates
   fresh and populates it. It is the only workflow permitted to write the
   shared cache.

## Non-Goals

Not part of this implementation:

- approximate or prefix-based baseline matching (`restore_keys` is
  deliberately never set on the exact-fingerprint restores);
- promoting an already-computed PR candidate without recomputing on `main`
  (see "Deferred to v2" above);
- changes to skill-evaluator scoring;
- changes to the EAS authoring or simulator evaluation design;
- a permanent benchmark database;
- reuse across different agents, models, PRDs, or harness revisions;
- executing code restored from a cache entry or artifact.

## Terminology

- **Baseline result**: Evaluation output for skill content on `main`.
- **Candidate result**: Evaluation output for the skill content in a pull
  request (not currently cached or promoted -- computed fresh on every PR
  run, as before this change).
- **Fingerprint**: An immutable identifier for every input that can affect an
  evaluation result. Computed by `scripts/calculate-eval-fingerprint.py`.
- **Result bundle**: A directory containing `manifest.json` + `metrics.json`
  for one PRD's baseline. This is what gets cached and restored.
- **Result manifest**: `manifest.json`, written by
  `scripts/validate-result-bundle.py write` and checked by
  `scripts/validate-result-bundle.py verify` before any cached bundle is
  trusted.

## Fingerprint Design

Never use a mutable cache key such as `skill-eval-baseline-main`.

The fingerprint (see `scripts/calculate-eval-fingerprint.py`) includes:

- a schema version controlled by this repository (`schema_version: 1`);
- a content hash of the evaluated skill plugin directory (`plugins/expo`,
  the same directory `SKILL_PLUGIN_DIR` points authoring at) -- hashing
  content rather than the Git commit SHA means a documentation-only commit,
  or a squash/rebase merge that preserves the same skill content under a new
  commit SHA, does not invalidate the cache;
- the eval-harness submodule's pinned commit SHA (`harness_sha256`) -- since
  it's a pinned commit, the SHA alone already uniquely identifies the
  harness's full tree, no separate content hash is needed;
- an `eval_config_sha256` covering the PRD file's content, the PRD id, its
  ground-truth entry from `eval-harness/dataset/prd_skills.json`, and the
  scenario string;
- the coding agent (`claude-code`) and the model input actually passed to
  the harness (`AGENT_MODEL`, defaulting to the rolling alias `sonnet` when
  unset -- see the known gap called out in
  `.eas/workflows/skill-eval-main-baseline.yml`'s header: this cannot detect
  Anthropic repointing that alias to a new underlying snapshot, only an
  explicit override);
- the PRD id and repetition count.

Implemented once, in `scripts/calculate-eval-fingerprint.py`, and called
identically from `skill-eval-ci.yml` and `skill-eval-main-baseline.yml` --
never duplicated inline in either workflow file.

The script emits a stable JSON description plus the final digest, for
example:

```json
{
  "schema_version": 1,
  "skill_content_sha256": "...",
  "harness_sha256": "...",
  "eval_config_sha256": "...",
  "agent": "claude-code",
  "model": "sonnet",
  "scenario": "skills_available_unmentioned",
  "prd_id": "notes",
  "repetitions": "1",
  "fingerprint": "sha256:..."
}
```

The digest is computed over the description's keys in sorted order, so the
same inputs always produce the same fingerprint regardless of object
construction order. Verified empirically: identical inputs produce identical
fingerprints across separate invocations; changing the scenario, the PRD, or
the skill content each changes the fingerprint; touching an unrelated file
(e.g. `README.md`) does not.

## Result Bundle

A cached bundle is a directory:

```text
cached-baseline-<prd>-main/
  manifest.json
  metrics.json
```

`manifest.json` (written by `validate-result-bundle.py write`) contains:

- `schema_version`, `kind` (`baseline` or `candidate` -- only `baseline` is
  produced in v1), `fingerprint`, and the full `fingerprint_inputs`;
- `status` (`success` or `failure` -- only `success` bundles pass
  verification);
- `source_repository`, `source_commit`, `workflow_run_id` (EAS Workflows
  exposes only `workflow.id`, not a GitHub-Actions-style run/attempt pair,
  so there is no separate attempt number to record);
- `pr_number` / `pr_head_sha` (present for a future `candidate` kind; always
  `null` for the `baseline` bundles v1 produces).

`validate-result-bundle.py verify` rejects (exit 1, safe to treat exactly
like a cache miss) whenever: the bundle directory is missing, `manifest.json`
is missing or doesn't parse, the schema version is unsupported, the
manifest's fingerprint doesn't match what's expected, `status` isn't
`success`, or `metrics.json` is missing or doesn't parse. It never executes
anything from the bundle -- only reads and parses JSON.

## Workflow 1: PR Comparison (`skill-eval-ci.yml`)

For each PRD's `_main` job pair:

1. `eas/checkout`, then extract `origin/main`'s `plugins/expo` via
   `git archive` into `/tmp/plugins-main` (unchanged from before this
   change -- still needed regardless of cache outcome, both to fingerprint
   and, on a miss, to author against).
2. Fetch the `eval-harness` submodule (needed to read its pinned commit SHA
   for the fingerprint, and for authoring/evaluating on a miss).
3. Compute the fingerprint via `calculate-eval-fingerprint.py`.
4. `eas/restore_cache` with the exact fingerprint as `key`. `restore_keys` is
   never set -- a partial match must not silently stand in for the real
   baseline.
5. `validate-result-bundle.py verify` against the restored path. A restored-
   but-invalid bundle (partial write, wrong fingerprint, unsupported schema)
   is treated exactly like a miss, not a hit.
6. On a hit: skip authoring and re-analysis. The `eval_skill_<prd>_main` job
   copies the restored bundle to the same `skill-eval-report-<prd>-main`
   directory the miss path would have produced, so the existing metrics-
   parsing and artifact-upload steps run unmodified either way.
7. On a miss: author and evaluate exactly as before this change. Nothing is
   written back to the shared cache -- only the trusted
   `skill-eval-main-baseline.yml` workflow does that.

The `_pr` job pairs (evaluating the PR's own skill content) are unchanged.
The final `comment` job's template and its 9 outputs per eval job
(`report`/`expected`/`detected`/`recall`/`precision`/`lexical`/`structural`/
`syntax_ok`/`bundle_ok`) are unchanged -- the cache hit/miss split is fully
contained inside the `_main` job pairs and invisible to the comment.

## Workflow 2: Main Baseline Producer (`skill-eval-main-baseline.yml`)

Triggered on `push: branches: [main]`, `paths: [plugins/expo/skills/**]`.

`concurrency: { cancel_in_progress: true, group: ${{ workflow.filename }}-${{ github.ref }} }`
means a fast follow-up push to `main` cancels an in-flight run for the same
workflow+branch rather than letting two runs race to populate the same
cache entry -- the newer push's evaluation is always the one that ends up
cached; a cancelled older run simply wastes no further compute.

For each PRD, one self-contained job:

1. `eas/checkout` (already on `main`, no `git archive` trick needed), fetch
   `eval-harness`.
2. Compute the fingerprint against the current checkout's `plugins/expo`.
3. `eas/restore_cache` with the exact key. If `validate-result-bundle.py
   verify` passes, stop -- the baseline is already correct and cached, no
   evaluation needed.
4. On a miss: author against `$(pwd)/plugins/expo` directly (no PR-side
   `/tmp` extraction needed), evaluate directly into the same directory that
   will become the cache path, write `manifest.json`, `eas/save_cache` under
   the exact fingerprint key (gated additionally on
   `github.ref_name == 'main'`, belt-and-suspenders on top of the trigger
   itself, matching Expo's own documented pattern for designated
   cache-writer jobs), and `eas/upload_artifact` the bundle for human
   inspection.

## Cache and Artifact Responsibilities

- **`eas/restore_cache` / `eas/save_cache`**: fast exact-key lookup for
  future PR comparisons and for skipping recomputation on `main` when
  nothing relevant changed. Confirmed to exist (`key`, `restore_keys`,
  `path` parameters) via the EAS Workflows syntax docs -- this is not a
  GitHub Actions concept carried over by assumption.
- **`eas/upload_artifact`**: auditable, human-downloadable copy of every
  freshly computed baseline bundle. Not used as a lookup mechanism in v1 (see
  "Deferred to v2").

Caches may be evicted; artifacts have finite retention. The system always
recomputes a missing baseline rather than serving a stale one -- there is no
durable, permanent store in v1.

## Security Requirements

- Only `skill-eval-main-baseline.yml` (a trusted `push`-to-`main` workflow)
  ever calls `eas/save_cache`. `skill-eval-ci.yml`'s `pull_request`-triggered
  jobs only ever call `eas/restore_cache`.
- EAS's own cache scoping already enforces the important half of this: a
  build/job can only restore caches from its current branch or the default
  branch, so a PR-branch cache write (even if one were attempted) would
  never be visible to `main`. The `github.ref_name == 'main'` check on the
  save step is defense in depth on top of that, not the only thing
  preventing a PR from polluting the shared baseline.
- EAS cache keys are **overwritable**, not immutable-on-first-write the way
  GitHub Actions cache keys are ("other jobs with the same environment
  variable can still save and overwrite the cache" -- Expo's own docs). The
  `concurrency.cancel_in_progress` group described above is what prevents
  two concurrent main-baseline runs from racing to overwrite the same key;
  do not rely on a save silently no-op'ing on collision the way you could on
  GitHub Actions.
- Never place secrets, API responses containing credentials, or agent home
  directories in a cached bundle or uploaded artifact.
- Never execute anything restored from a cache entry or downloaded artifact
  -- `validate-result-bundle.py verify` only ever reads and parses JSON.
- Use the minimum token/permission scope each job needs (unchanged from the
  existing `EVAL_HARNESS_ACCESS_TOKEN`/`EXPO_TOKEN` usage already in
  `skill-eval-ci.yml`).

## Failure Behavior

- **Exact cache hit** (PR side or main side): reuse it, skip authoring and
  re-analysis.
- **Cache miss or an invalid restored bundle** (PR side): compute for this
  comparison, same as before this change existed. Nothing is written back to
  the shared cache from a PR run.
- **Cache miss or an invalid restored bundle** (main side): compute fresh,
  write `manifest.json`, save to cache, upload the artifact.
- **Candidate validation failure**: not applicable in v1 -- there is no
  candidate-promotion path yet to fail.
- **Cache save failure**: the freshly computed bundle is still uploaded as
  an artifact regardless (`if: always()`), so a maintainer can recover it
  manually even if `eas/save_cache` itself fails.

Nothing silently falls back to a partial or fuzzy-matched cache entry --
`restore_keys` is never set on any `eas/restore_cache` call in either
workflow.

## Rebase and squash merges

Handled correctly by construction, independent of GitHub vs. EAS: the
fingerprint hashes skill content, not the Git commit SHA. A clean
rebase/squash merge (no conflicting change landed on the same skill content
in the meantime) produces the same fingerprint as whatever was last
evaluated for that content, so `skill-eval-main-baseline.yml` hits cache and
does nothing. A rebase/squash that does change the resulting content (a
conflict, or another PR touching the same skill landing first) produces a
different fingerprint, which correctly falls through to a fresh
recomputation -- not a promotion of stale results.

## Test Plan

Verified directly against the shipped scripts (not just asserted):

1. Deterministic fingerprints for identical input trees -- confirmed:
   running `calculate-eval-fingerprint.py` twice against the same inputs
   produces byte-identical output.
2. Fingerprint changes for scenario, PRD id, and skill-content changes --
   confirmed by direct test (see PR description / commit history for the
   exact commands run).
3. Fingerprint is stable across unrelated repository changes (touching
   `README.md` does not change the `plugins/expo` content hash) --
   confirmed.
4. `validate-result-bundle.py write` then `verify` round-trips successfully
   against a matching fingerprint -- confirmed.
5. `verify` rejects (exit 1) a fingerprint mismatch, a missing bundle
   directory, and a bundle with unparseable `metrics.json` -- all three
   confirmed independently.
6. Both workflow YAML files validate against the EAS Workflows JSON schema
   (`node plugins/expo/skills/eas-workflows/scripts/validate.js
   .eas/workflows/skill-eval-ci.yml .eas/workflows/skill-eval-main-baseline.yml`).

Not yet exercised -- neither workflow has actually run. This PR's own diff
(`.eas/workflows/*`, `scripts/*.py`, this doc) doesn't touch
`plugins/expo/skills/**`, so `skill-eval-ci.yml`'s `pull_request` trigger
won't fire on this PR by itself, and `skill-eval-main-baseline.yml` only
fires on push to `main`. Both files now also accept `workflow_dispatch`
(usable via `eas workflow:run` regardless of the `on` key, or the
dashboard), specifically so they can be exercised without waiting for a
qualifying event -- but that still needs someone to actually run them before
this can be called end-to-end verified, not just schema-valid and
unit-tested:

- An actual `eas/restore_cache` hit/miss round-trip inside a live workflow
  run.
- Whether `eas/restore_cache` correctly detects "nothing restored" in a way
  `validate-result-bundle.py verify`'s existence checks handle gracefully
  (the design assumes a miss simply leaves the target path absent or empty;
  this should be confirmed on the first real run).
- Whether `set-output` inside a job's steps correctly propagates through
  that job's own `outputs:` block into a dependent job's `needs.<job>.outputs.*`
  -- exercised locally only as far as the schema validator checks structure,
  not runtime propagation.
- The `concurrency.cancel_in_progress` behavior under two genuinely
  overlapping pushes to `main`.

One caught-before-runtime issue worth noting: an earlier draft referenced
`${{ workflow.run_id }}` / `${{ workflow.run_attempt }}` in the manifest-write
step, assuming a GitHub-Actions-style run/attempt pair. EAS Workflows'
`workflow` context only exposes `id`, `name`, `filename`, `url` -- confirmed
by reading the syntax doc's `WorkflowContext` type directly, not assumed.
Fixed to `${{ workflow.id }}` with no attempt field before this ever ran.
Similarly, every `if:` condition in both workflow files was restructured to
use only `==` (confirmed in the docs' own examples) instead of `!=` or `&&`
inside `${{ }}` -- compound/negation operators inside EAS expressions were
never confirmed as supported, so compound logic was pushed into plain bash
(`set-output` from an `if <cond> && [ ... ]`-style shell check) instead of
gambling on unconfirmed expression grammar.

## Recommended Implementation Order (as actually followed)

1. ~~Define and test the fingerprint and result-manifest schemas.~~ Done --
   `scripts/calculate-eval-fingerprint.py`, `scripts/validate-result-bundle.py`.
2. ~~Extract deterministic fingerprint calculation into one shared script.~~
   Done -- same script as above, called from both workflows.
3. ~~Add exact baseline restoration to the PR workflow.~~ Done -- the three
   `_main` job pairs in `skill-eval-ci.yml`.
4. ~~Add the trusted main workflow.~~ Done, in the reduced v1 form (always
   recomputes on miss; does not attempt candidate promotion) --
   `skill-eval-main-baseline.yml`.
5. Candidate-promotion-without-recompute -- deferred pending confirmation
   that EAS supports reading an artifact from a different, earlier workflow
   run (see "Deferred to v2" above).
6. Enable on a real PR run and monitor: does the first PR run against a
   fresh `main` (no cache yet) correctly fall through to computing inline,
   and does a subsequent PR against the same `main` state hit cache and skip
   authoring entirely.
