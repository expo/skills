#!/usr/bin/env python3
"""Consolidated Python CI helper for skill-eval-ci.yml and
skill-eval-main-baseline.yml. One file, one subcommand per responsibility,
instead of one file per responsibility -- see scripts/ci.sh for the
shell-side counterpart these two workflows also depend on. Implemented in
Python (not this repo's usual bun/TypeScript dev-script convention) because
python3 is the runtime already confirmed present on the EAS Workflows
linux-medium runner -- bun is not, and this runs inside paid CI jobs, not
locally.

Subcommands:
  fingerprint     -- compute the cache-key fingerprint for a skill checkout
                     (see BASELINE_RESULT_CACHE_AND_PROMOTION.md for the design)
  bundle write    -- write a cache bundle's manifest.json
  bundle verify   -- verify a restored cache bundle is trustworthy before
                     reusing it (never executes anything from it, only
                     reads and parses JSON)
  print-outputs   -- parse a skill-eval metrics.json into shell variable
                     assignments for the caller to `eval`

Run `python3 scripts/ci.py <subcommand> --help` for each one's arguments.
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

FINGERPRINT_SCHEMA_VERSION = 1
SUPPORTED_MANIFEST_SCHEMA_VERSIONS = {1}


# ---------------------------------------------------------------------------
# fingerprint
# ---------------------------------------------------------------------------
#
# A fingerprint covers every input that can change the evaluation result:
# skill plugin content, the eval-harness revision, the PRD/scenario/ground
# truth, and the coding agent + model. Two runs with an identical
# fingerprint are expected to be comparable; anything else must not reuse a
# cached result. Called identically from the PR-side cache lookup and the
# trusted main-baseline producer so the two never drift.


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hash_directory(directory: Path) -> str:
    """Content hash of a directory tree: sort files by relative path, hash
    each file's bytes, then hash the ordered "path\\0filehash" list. Stable
    across checkouts/clones -- no reliance on mtimes or permissions -- and
    intentionally excludes VCS metadata.

    Walks with followlinks=False and skips every symlink outright (file or
    directory): this content is `main`'s already-merged skill tree, so a
    git-tracked symlink here would otherwise let a merged change read an
    arbitrary file elsewhere on the runner disk into the fingerprint, or --
    for a directory symlink pointing back at an ancestor -- send the walk
    into an infinite loop."""
    files = []
    for root, dirnames, filenames in os.walk(directory, followlinks=False):
        root_path = Path(root)
        dirnames[:] = [
            d for d in dirnames if d != ".git" and not (root_path / d).is_symlink()
        ]
        for filename in filenames:
            file_path = root_path / filename
            if file_path.is_symlink():
                continue
            if file_path.is_file():
                files.append(file_path)

    lines = [
        f"{p.relative_to(directory).as_posix()}\0{sha256_hex(p.read_bytes())}"
        for p in sorted(files)
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


def cmd_fingerprint(args: argparse.Namespace) -> None:
    description = {
        "schema_version": FINGERPRINT_SCHEMA_VERSION,
        "skill_content_sha256": hash_directory(args.skill_dir),
        "harness_sha256": harness_revision(args.harness_dir),
        "eval_config_sha256": eval_config_hash(args.prd, args.prd_skills, args.prd_id, args.scenario),
        "agent": args.agent,
        "model": args.model,
        "scenario": args.scenario,
        "prd_id": args.prd_id,
        "repetitions": args.repetitions,
    }

    # Every field above is an input to the final digest -- do not add a
    # field without also covering it in the acceptance-criteria test ("X
    # change invalidates the old baseline").
    digest_input = json.dumps(description, sort_keys=True)
    fingerprint = f"sha256:{sha256_hex(digest_input.encode('utf-8'))}"

    print(json.dumps({**description, "fingerprint": fingerprint}, indent=2))


# ---------------------------------------------------------------------------
# bundle write / verify
# ---------------------------------------------------------------------------
#
# Writes and verifies the manifest.json for a skill-eval result bundle (a
# cached baseline). One place owns the manifest shape so the writer (the
# workflow that just computed a fresh result) and the reader (a later
# workflow deciding whether to trust a restored cache entry) can never
# drift apart. `verify` never executes anything from the bundle; it only
# reads and parses JSON, and exits 1 (safe to treat exactly like a cache
# miss) rather than 0 whenever anything about it can't be trusted.


def manifest_path(bundle_dir: Path) -> Path:
    return bundle_dir / "manifest.json"


def metrics_path(bundle_dir: Path) -> Path:
    return bundle_dir / "metrics.json"


def cmd_bundle_write(args: argparse.Namespace) -> None:
    if args.status not in ("success", "failure"):
        raise ValueError(f'--status must be "success" or "failure", got "{args.status}"')
    if args.kind not in ("baseline", "candidate"):
        raise ValueError(f'--kind must be "baseline" or "candidate", got "{args.kind}"')

    fingerprint_description = json.loads(Path(args.fingerprint_json).read_text(encoding="utf-8"))

    manifest = {
        "schema_version": 1,
        "kind": args.kind,
        "fingerprint": fingerprint_description["fingerprint"],
        "fingerprint_inputs": fingerprint_description,
        "status": args.status,
        "source_repository": args.source_repo,
        "source_commit": args.source_commit,
        "pr_number": args.pr_number,
        "pr_head_sha": args.pr_head_sha,
        "workflow_run_id": args.workflow_run_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    bundle_dir = Path(args.bundle_dir)
    bundle_dir.mkdir(parents=True, exist_ok=True)
    manifest_path(bundle_dir).write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {manifest_path(bundle_dir)}")


def reject(reason: str) -> None:
    print(f"REJECT: {reason}", file=sys.stderr)
    sys.exit(1)


def cmd_bundle_verify(args: argparse.Namespace) -> None:
    bundle_dir = Path(args.bundle_dir)

    if not bundle_dir.exists():
        reject(f"bundle dir does not exist: {bundle_dir}")

    manifest_file = manifest_path(bundle_dir)
    if not manifest_file.exists():
        reject(f"missing manifest.json in {bundle_dir}")

    try:
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        reject(f"manifest.json does not parse: {exc}")
        return  # unreachable, keeps type checkers happy

    if manifest.get("schema_version") not in SUPPORTED_MANIFEST_SCHEMA_VERSIONS:
        reject(f"unsupported manifest schema_version: {manifest.get('schema_version')}")

    if manifest.get("fingerprint") != args.expect_fingerprint:
        reject(
            f"fingerprint mismatch: bundle has {manifest.get('fingerprint')}, "
            f"expected {args.expect_fingerprint}"
        )

    if manifest.get("status") != "success":
        reject(f'bundle evaluation status is "{manifest.get("status")}", not "success"')

    metrics_file = metrics_path(bundle_dir)
    if not metrics_file.exists():
        reject(f"missing metrics.json in {bundle_dir}")

    try:
        json.loads(metrics_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        reject(f"metrics.json does not parse: {exc}")
        return

    print(f"VALID: {bundle_dir} matches fingerprint {args.expect_fingerprint}")


# ---------------------------------------------------------------------------
# print-outputs
# ---------------------------------------------------------------------------
#
# Reads a skill-eval metrics.json and prints shell variable assignments for
# `report`/`expected`/`detected`/`recall`/`precision`/`lexical`/`structural`/
# `syntax_ok`/`bundle_ok`/`failing` -- the fields skill-eval-ci.yml's
# per-PRD jobs turn into job outputs via `set-output`. Never fails the
# calling step: on any read/parse error, every field falls back to "?" (or
# "no report" for `report`).
#
# `failing` is a comma-joined list of check ids with status "failed" in the
# top-level `static_checks` array -- deliberately excludes checks with
# status "not_applicable" (no `passed` verdict at all because the relevant
# skill wasn't engaged), which is a different thing from a genuine failure
# and must not be reported as one.


def shell_quote(value) -> str:
    """Single-quote a value for safe assignment/eval in a POSIX shell."""
    return "'" + str(value).replace("'", "'\\''") + "'"


def build_health_symbol(block) -> str:
    if block is None:
        return "➖"
    ok = block.get("ok")
    if ok is None:
        return "❔"
    return "✅" if ok else "❌"


def cmd_print_outputs(args: argparse.Namespace) -> None:
    try:
        data = json.loads(Path(args.metrics_path).read_text(encoding="utf-8"))
        run = (data.get("runs") or [{}])[0]
        expected = run.get("skill_id")
        detected = ",".join(run.get("detected_skills") or []) or "none"
        recall = run.get("trigger_recall")
        precision = run.get("trigger_precision")
        report = f"expected={expected} detected={detected} recall={recall} precision={precision}"

        lexical_block = data.get("check_category_breakdown", {}).get("lexical", {})
        lexical = f"{lexical_block.get('passed', '?')}/{lexical_block.get('total', '?')}"

        structural_block = data.get("check_category_breakdown", {}).get("structural", {})
        structural = f"{structural_block.get('passed', '?')}/{structural_block.get('total', '?')}"

        syntax_ok = build_health_symbol(data.get("build_health", {}).get("syntax"))
        bundle_ok = build_health_symbol(data.get("build_health", {}).get("bundle"))

        failing = ",".join(
            c["id"] for c in data.get("static_checks", []) if c.get("status") == "failed"
        ) or "none"
    except Exception:
        report = "no report"
        expected = detected = recall = precision = "?"
        lexical = structural = syntax_ok = bundle_ok = "?"
        failing = "?"

    fields = {
        "report": report,
        "expected": expected,
        "detected": detected,
        "recall": recall,
        "precision": precision,
        "lexical": lexical,
        "structural": structural,
        "syntax_ok": syntax_ok,
        "bundle_ok": bundle_ok,
        "failing": failing,
    }

    for key, value in fields.items():
        print(f"{key}={shell_quote(value)}")


# ---------------------------------------------------------------------------
# CLI wiring
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    fp = subparsers.add_parser("fingerprint")
    fp.add_argument("--skill-dir", required=True, type=Path)
    fp.add_argument("--harness-dir", required=True, type=Path)
    fp.add_argument("--prd", required=True, type=Path)
    fp.add_argument("--prd-skills", required=True, type=Path)
    fp.add_argument("--prd-id", required=True)
    fp.add_argument("--scenario", required=True)
    fp.add_argument("--agent", required=True)
    fp.add_argument("--model", default="unspecified")
    fp.add_argument("--repetitions", default="1")
    fp.set_defaults(func=cmd_fingerprint)

    bundle = subparsers.add_parser("bundle")
    bundle_sub = bundle.add_subparsers(dest="bundle_command", required=True)

    write_p = bundle_sub.add_parser("write")
    write_p.add_argument("--bundle-dir", required=True)
    write_p.add_argument("--fingerprint-json", required=True)
    write_p.add_argument("--status", required=True)
    write_p.add_argument("--kind", required=True)
    write_p.add_argument("--source-repo")
    write_p.add_argument("--source-commit")
    write_p.add_argument("--pr-number")
    write_p.add_argument("--pr-head-sha")
    write_p.add_argument("--workflow-run-id")
    write_p.set_defaults(func=cmd_bundle_write)

    verify_p = bundle_sub.add_parser("verify")
    verify_p.add_argument("--bundle-dir", required=True)
    verify_p.add_argument("--expect-fingerprint", required=True)
    verify_p.set_defaults(func=cmd_bundle_verify)

    po = subparsers.add_parser("print-outputs")
    po.add_argument("metrics_path")
    po.set_defaults(func=cmd_print_outputs)

    return parser


def main() -> None:
    args = build_parser().parse_args()
    args.func(args)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 -- CLI entrypoint, want a clean message
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
