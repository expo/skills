#!/usr/bin/env python3
"""Shared fingerprint calculation for skill-eval-ci.yml and any workflow that
needs to know whether a previously computed skill-eval result is still valid
for the current inputs. Called identically from the PR-side cache lookup and
the trusted main-baseline producer so the two never drift.

A fingerprint covers every input that can change the evaluation result:
skill plugin content, the eval-harness revision, the PRD/scenario/ground
truth, and the coding agent + model. Two runs with an identical fingerprint
are expected to be comparable; anything else must not reuse a cached result.
See BASELINE_RESULT_CACHE_AND_PROMOTION.md for the design.

Implemented in Python (not this repo's usual bun/TypeScript dev-script
convention) because python3 is the runtime already confirmed present on the
EAS Workflows linux-medium runner that executes skill-eval-ci.yml -- bun is
not confirmed there, and this script runs inside paid CI jobs, not locally.

Usage:
  python3 scripts/calculate-eval-fingerprint.py \\
    --skill-dir plugins/expo \\
    --harness-dir eval-harness \\
    --prd eval-harness/dataset/prds/notes/prd/mvp.txt \\
    --prd-skills eval-harness/dataset/prd_skills.json \\
    --prd-id notes \\
    --scenario skills_available_unmentioned \\
    --agent claude-code \\
    [--model <model-id>] [--repetitions 1]

Prints a single JSON object to stdout.
"""

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

SCHEMA_VERSION = 1


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hash_directory(directory: Path) -> str:
    """Content hash of a directory tree: sort files by relative path, hash
    each file's bytes, then hash the ordered "path\\0filehash" list. Stable
    across checkouts/clones -- no reliance on mtimes or permissions -- and
    intentionally excludes VCS metadata."""
    files = sorted(
        p for p in directory.rglob("*") if p.is_file() and ".git" not in p.parts
    )
    lines = [
        f"{p.relative_to(directory).as_posix()}\0{sha256_hex(p.read_bytes())}"
        for p in files
    ]
    return sha256_hex("\n".join(lines).encode("utf-8"))


def harness_revision(harness_dir: Path) -> str:
    # The harness is vendored as a pinned git submodule -- the pinned commit
    # SHA already uniquely identifies its full tree content, so there is no
    # need to separately hash the harness's files.
    result = subprocess.run(
        ["git", "-C", str(harness_dir), "rev-parse", "HEAD"],
        capture_output=True,
        text=True,
        check=True,
    )
    sha = result.stdout.strip()
    if len(sha) != 40 or not all(c in "0123456789abcdef" for c in sha):
        raise ValueError(f"Could not resolve a commit SHA for harness dir {harness_dir}: {sha!r}")
    return sha


def eval_config_hash(prd_path: Path, prd_skills_path: Path, prd_id: str, scenario: str) -> str:
    prd_content = prd_path.read_text(encoding="utf-8")
    prd_skills = json.loads(prd_skills_path.read_text(encoding="utf-8"))
    ground_truth = prd_skills.get(prd_id)
    if ground_truth is None:
        raise ValueError(f'No ground-truth entry for PRD id "{prd_id}" in {prd_skills_path}')
    canonical = json.dumps(
        {
            "prd_content_sha256": sha256_hex(prd_content.encode("utf-8")),
            "prd_id": prd_id,
            "ground_truth": ground_truth,
            "scenario": scenario,
        },
        sort_keys=True,
    )
    return sha256_hex(canonical.encode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skill-dir", required=True, type=Path)
    parser.add_argument("--harness-dir", required=True, type=Path)
    parser.add_argument("--prd", required=True, type=Path)
    parser.add_argument("--prd-skills", required=True, type=Path)
    parser.add_argument("--prd-id", required=True)
    parser.add_argument("--scenario", required=True)
    parser.add_argument("--agent", required=True)
    parser.add_argument("--model", default="unspecified")
    parser.add_argument("--repetitions", default="1")
    args = parser.parse_args()

    description = {
        "schema_version": SCHEMA_VERSION,
        "skill_content_sha256": hash_directory(args.skill_dir),
        "harness_sha256": harness_revision(args.harness_dir),
        "eval_config_sha256": eval_config_hash(args.prd, args.prd_skills, args.prd_id, args.scenario),
        "agent": args.agent,
        "model": args.model,
        "scenario": args.scenario,
        "prd_id": args.prd_id,
        "repetitions": args.repetitions,
    }

    # Every field above is an input to the final digest -- do not add a field
    # without also covering it in the acceptance-criteria test ("X change
    # invalidates the old baseline").
    digest_input = json.dumps(description, sort_keys=True)
    fingerprint = f"sha256:{sha256_hex(digest_input.encode('utf-8'))}"

    print(json.dumps({**description, "fingerprint": fingerprint}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001 -- CLI entrypoint, want a clean message
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
