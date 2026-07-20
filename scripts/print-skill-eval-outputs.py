#!/usr/bin/env python3
"""Read a skill-eval metrics.json and print shell variable assignments for
`report`/`expected`/`detected`/`recall`/`precision`/`lexical`/`structural`/
`syntax_ok`/`bundle_ok` -- the 9 fields skill-eval-ci.yml's per-PRD "Analyze"
steps turn into job outputs via `set-output`.

Extracted out of skill-eval-ci.yml because 6 near-identical copies of this
parsing logic (one per PRD x main/pr) as inline `python3 -c "..."` one-liners
were, on their own, over a third of that file's total size -- enough to trip
EAS Workflows' workflow-file-size limit once the baseline-cache steps were
added on top.

Usage:
  eval "$(python3 scripts/print-skill-eval-outputs.py path/to/metrics.json)"
  set-output report "$report"
  set-output expected "$expected"
  ... (etc, one per field above)

Never fails the calling step: on any read/parse error, every field falls
back to "?" (or "no report" for `report`), matching the previous inline
one-liners' `2>/dev/null || echo "?"` behavior exactly.
"""

import json
import sys


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


def main() -> None:
    metrics_path = sys.argv[1]

    try:
        data = json.loads(open(metrics_path, encoding="utf-8").read())
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
    except Exception:
        report = "no report"
        expected = detected = recall = precision = "?"
        lexical = structural = syntax_ok = bundle_ok = "?"

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
    }

    for key, value in fields.items():
        print(f"{key}={shell_quote(value)}")


if __name__ == "__main__":
    main()
