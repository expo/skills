#!/usr/bin/env python3
"""Writes and verifies the manifest.json for a skill-eval result bundle (a
cached baseline, in the initial implementation -- see
BASELINE_RESULT_CACHE_AND_PROMOTION.md). One script owns the manifest shape
so the writer (the workflow that just computed a fresh result) and the
reader (a later workflow deciding whether to trust a restored cache entry)
can never drift apart.

Two modes:

  python3 scripts/validate-result-bundle.py write \\
    --bundle-dir <dir> \\
    --fingerprint-json <path to calculate-eval-fingerprint.py's output> \\
    --status success|failure \\
    --kind baseline|candidate \\
    --source-repo <owner/repo> --source-commit <sha> \\
    --workflow-run-id <id> \\
    [--pr-number <n>] [--pr-head-sha <sha>]

  python3 scripts/validate-result-bundle.py verify \\
    --bundle-dir <dir> \\
    --expect-fingerprint <fingerprint string>

`verify` exits 0 (bundle is trustworthy, safe to reuse) or 1 (reject --
caller should treat this exactly like a cache miss and recompute). It never
executes anything from the bundle; it only reads and parses JSON.
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

SUPPORTED_SCHEMA_VERSIONS = {1}


def manifest_path(bundle_dir: Path) -> Path:
    return bundle_dir / "manifest.json"


def metrics_path(bundle_dir: Path) -> Path:
    return bundle_dir / "metrics.json"


def cmd_write(args: argparse.Namespace) -> None:
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


def cmd_verify(args: argparse.Namespace) -> None:
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

    if manifest.get("schema_version") not in SUPPORTED_SCHEMA_VERSIONS:
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


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="mode", required=True)

    write_parser = subparsers.add_parser("write")
    write_parser.add_argument("--bundle-dir", required=True)
    write_parser.add_argument("--fingerprint-json", required=True)
    write_parser.add_argument("--status", required=True)
    write_parser.add_argument("--kind", required=True)
    write_parser.add_argument("--source-repo")
    write_parser.add_argument("--source-commit")
    write_parser.add_argument("--pr-number")
    write_parser.add_argument("--pr-head-sha")
    write_parser.add_argument("--workflow-run-id")
    write_parser.set_defaults(func=cmd_write)

    verify_parser = subparsers.add_parser("verify")
    verify_parser.add_argument("--bundle-dir", required=True)
    verify_parser.add_argument("--expect-fingerprint", required=True)
    verify_parser.set_defaults(func=cmd_verify)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 -- CLI entrypoint, want a clean message
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
