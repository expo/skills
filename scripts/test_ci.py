"""Offline tests for evaluation cache identity; never launches an agent."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("ci", Path(__file__).with_name("ci.py"))
ci = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ci)


class FingerprintTests(unittest.TestCase):
    def test_runtime_prompt_and_runner_changes_invalidate_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            plugin = root / "plugin"
            plugin.mkdir()
            (plugin / "SKILL.md").write_text("skill body")
            prd = root / "prd.txt"
            prd.write_text("Build a notes app")
            labels = root / "skills.json"
            labels.write_text(json.dumps({"notes": {"required": ["expo-overview"], "unlisted": "observe"}}))
            argv = ["fingerprint", "--skill-dir", str(plugin), "--harness-dir", str(root),
                    "--prd", str(prd), "--prd-skills", str(labels), "--prd-id", "notes",
                    "--scenario", "skills_available_unmentioned", "--agent", "claude-code"]

            def fingerprint(extra):
                output = io.StringIO()
                with patch.object(ci, "harness_revision", return_value="a" * 40), contextlib.redirect_stdout(output):
                    ci.cmd_fingerprint(ci.build_parser().parse_args(argv + extra))
                return json.loads(output.getvalue())["fingerprint"]

            baseline = fingerprint([])
            self.assertEqual(baseline, fingerprint([]))
            for extra in [["--agent-version", "2.1.267"], ["--prompt-variant", "minimal"],
                          ["--runner-image", "sdk-57"], ["--model", "another-model"],
                          ["--repetitions", "3"]]:
                with self.subTest(extra=extra):
                    self.assertNotEqual(baseline, fingerprint(extra))


class LabelWorkflowTests(unittest.TestCase):
    def test_canonical_harness_report_is_copied_into_job_artifact(self):
        ci_script = str(Path(__file__).with_name("ci.sh").resolve())
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            analyzer = root / "eval-harness/eval_harness/evaluator/skill_invocation/scripts/eval-skill-use.sh"
            analyzer.parent.mkdir(parents=True)
            analyzer.write_text('''set -eu
test "$AUTHORED_ARTIFACT" = "$PWD/eval-harness/authored-app"
test "$SCENARIO" = skills_available_unmentioned
test "$OUT_DIR" = skill-eval-report
test "$PRD_SKILLS" = "$PWD/eval-harness/dataset/prd_skills.json"
mkdir -p eval-harness/skill-eval-report
echo '{"runs":[]}' > eval-harness/skill-eval-report/metrics.json
echo report > eval-harness/skill-eval-report/report.html
''')
            result = subprocess.run(
                ["bash", ci_script, "analyze_authored_app", "skills_available_unmentioned", "notes-report"],
                cwd=root, capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads((root / "notes-report/metrics.json").read_text()), {"runs": []})
            self.assertEqual((root / "notes-report/report.html").read_text(), "report\n")

    def test_cached_notes_jobs_run_focused_probe_and_upload_diagnostics(self):
        ci_script = str(Path(__file__).with_name("ci.sh").resolve())
        shell = r"""
source "$1" true
focused_smoke() { mkdir -p "$2"; echo smoke > "$2/report.html"; return "$focused_rc"; }
focused_rc="$3"
export PRD=dataset/prds/notes/prd/mvp.txt
cd "$2"
author_and_evaluate true cached plugin report skills_available_unmentioned report.tar.gz
"""
        for code in [0, 1]:
            with self.subTest(focused_exit=code), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / "cached").mkdir()
                (root / "cached/metrics.json").write_text("{}")
                result = subprocess.run(["bash", "-c", shell, "test", ci_script, directory, str(code)], capture_output=True, text=True)
                self.assertEqual(result.returncode, code, result.stderr)
                self.assertTrue((root / "report/focused/report.html").exists())
                self.assertTrue((root / "report.tar.gz").exists())


if __name__ == "__main__":
    unittest.main()
