import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import mock_open, patch

import pr_evals


class ChangedSkillsTest(unittest.TestCase):
    def setUp(self):
        work = tempfile.TemporaryDirectory()
        self.addCleanup(work.cleanup)
        self.addCleanup(os.chdir, os.getcwd())
        os.chdir(work.name)
        self.git("init", "-qb", "main")
        self.git("config", "user.name", "Test")
        self.git("config", "user.email", "test@example.org")
        self.git("config", "commit.gpgsign", "false")
        self.skill = Path("plugins/expo/skills/expo-ui")
        self.experimental = Path("plugins/expo-experiments/skills/eas-example")

    def git(self, *args):
        return subprocess.check_output(["git", *args], text=True).strip()

    def write(self, path, text):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def add_skill(self, directory, description="A test skill"):
        self.write(directory / "SKILL.md", f"---\nname: {directory.name}\ndescription: {description}\n---\n\n# Example\n")

    def commit(self, message):
        self.git("add", "-A")
        self.git("commit", "-qm", message)
        return self.git("rev-parse", "HEAD")

    def test_uses_merge_base_and_reads_pr_objects_without_checkout(self):
        self.add_skill(self.skill)
        self.write(self.skill / "references/setup.md", "Configure the app.\nSet timeout to 2.\nRestart it.\n")
        self.write(self.skill / "scripts/old.sh", "retired command\n")
        self.add_skill(self.experimental)
        self.commit("initial")
        self.git("branch", "candidate")
        self.add_skill(self.experimental, "Change that landed on main only")
        base = self.commit("main advanced")
        self.git("switch", "-q", "candidate")
        self.write(self.skill / "references/setup.md", "Configure the app.\nSet timeout to 3.\nRestart it.\n")
        (self.skill / "scripts/old.sh").unlink()
        head = self.commit("edit reference and remove script")
        self.git("switch", "-q", "main")

        result = pr_evals.changed_skills(base, head)
        self.assertEqual(result, [{"name": "expo-ui", "directory": self.skill.as_posix()}])
        self.assertEqual(self.git("rev-parse", "HEAD"), base)

    def test_new_skill_in_existing_directory_and_removed_skills(self):
        self.add_skill(self.skill)
        self.write(self.experimental / "README.md", "A placeholder.\n")
        base = self.commit("initial")
        (self.skill / "SKILL.md").unlink()
        self.add_skill(self.experimental)
        self.add_skill(Path("plugins/expo/skills/expo-Upper"))
        self.add_skill(Path("plugins/expo/skills/eas-example-"))
        self.add_skill(Path("plugins/other/skills/expo-other"))
        link = self.skill.parent / "expo-link/SKILL.md"
        link.parent.mkdir()
        link.symlink_to("../../../expo-experiments/skills/eas-example/SKILL.md")
        head = self.commit("add new skill")

        result = pr_evals.changed_skills(base, head)
        self.assertEqual(result, [{"name": "eas-example", "directory": self.experimental.as_posix()}])

    def test_no_changed_skills_and_option_rejection(self):
        self.add_skill(self.skill)
        base = self.commit("initial")
        self.write(Path("README.md"), "Updated docs.\n")
        head = self.commit("docs")
        self.assertEqual(pr_evals.changed_skills(base, head), [])
        with self.assertRaises(ValueError):
            pr_evals.changed_skills("--help", head)

    def test_copy_edit_in_either_plugin_counts(self):
        for directory in (self.skill, self.experimental):
            self.add_skill(directory)
        base = self.commit("initial")
        for directory in (self.skill, self.experimental):
            self.add_skill(directory, "A test skill.")
        head = self.commit("add punctuation")
        self.assertEqual({s["name"] for s in pr_evals.changed_skills(base, head)}, {"expo-ui", "eas-example"})


class PullRequestEvalsTest(unittest.TestCase):
    def setUp(self):
        self.sha = "a" * 40
        self.repo = "expo/skills"
        self.fork = {"id": 42, "full_name": "contributor/skills", "owner": {"login": "contributor"}}
        self.base_repo = {"id": 81, "full_name": self.repo, "owner": {"login": "expo"}}
        self.pr = {"number": 7, "state": "open", "labels": [], "user": {"type": "User"},
                   "base": {"sha": "b" * 40, "repo": self.base_repo},
                   "head": {"repo": self.fork, "sha": self.sha}}
        run = {"head_repository": self.fork, "head_sha": self.sha, "head_branch": "topic"}
        self.enterContext(patch.dict(pr_evals.os.environ, {
            "GITHUB_REPOSITORY": self.repo, "GITHUB_EVENT_PATH": "/event", "GITHUB_RUN_ID": "73",
            "GITHUB_STEP_SUMMARY": "/summary", "FIREGOAT_API_KEY": "test-key",
        }, clear=True))
        self.enterContext(patch.object(pr_evals, "Path")).return_value.read_text.return_value = json.dumps({"workflow_run": run})
        self.summary = self.enterContext(patch("builtins.open", mock_open())).return_value
        self.fetch = self.enterContext(patch.object(pr_evals.subprocess, "run"))
        self.fetch_head = self.enterContext(patch.object(pr_evals.subprocess, "check_output", return_value=self.sha))
        for name in ("publish", "changed_skills", "list_cases", "validate_case", "start_run", "read_run"):
            setattr(self, name, self.enterContext(patch.object(pr_evals, name)))
        self.enterContext(patch.object(pr_evals, "github", side_effect=self.github))
        self.statuses = []
        self.skill = {"name": "expo-router", "directory": "plugins/expo/skills/expo-router", "added": False}
        self.changed_skills.return_value = [self.skill]
        self.router_case = {"id": "case-id", "title": "Open a page", "tags": ["expo-skills-ci", "expo-router"]}
        self.list_cases.return_value = [self.router_case]
        self.required = {"skill-activation", "task-page"}
        self.validate_case.return_value = self.required, False
        self.start_run.return_value = {"id": "run-id", "url": "https://firegoat.ai/evals/expo.dev/runs/example"}
        self.read_run.return_value = {**self.start_run.return_value, "status": "completed", "outcome": "succeeded",
                                      "checks": {"skill-activation": 1, "task-page": 1}}

    def github(self, path, *, method="GET", fields=None, body=None):
        if path == f"repos/{self.repo}/pulls":
            self.assertEqual(fields, {"head": "contributor:topic", "base": "main", "state": "open"})
            return [self.pr]
        if path == f"repos/{self.repo}/pulls/7":
            return self.pr
        self.assertEqual((method, path), ("POST", f"repos/{self.repo}/statuses/{self.sha}"))
        self.assertEqual(body["context"], pr_evals.CONTEXT)
        self.statuses.append(body["state"])

    def test_no_eval_bypasses_fetch_and_firegoat_without_credentials(self):
        self.pr["labels"] = [{"name": "no-eval"}]
        del pr_evals.os.environ["FIREGOAT_API_KEY"]
        pr_evals.main()
        self.assertEqual(self.statuses, ["pending", "success"])
        self.publish.assert_called_once_with(self.repo, 7, "")
        for operation in (self.fetch, self.fetch_head, self.changed_skills, self.list_cases,
                          self.validate_case, self.start_run, self.read_run):
            operation.assert_not_called()

    def test_missing_coverage_blocks_all_runs_and_offers_copyable_prompt(self):
        # One covered skill and one uncovered modification exercise all-or-nothing preflight.
        missing = {"name": "eas-update", "directory": "plugins/expo/skills/eas-update", "added": False}
        self.changed_skills.return_value = [self.skill, missing]
        with self.assertRaises(SystemExit):
            pr_evals.main()
        self.assertEqual(self.statuses, ["pending", "failure"])
        self.start_run.assert_not_called()
        self.read_run.assert_not_called()
        comment = self.publish.call_args.args[2]
        self.assertIn("Missing eval", comment)
        self.assertIn("Copy this prompt into your coding agent.", comment)
        self.assertIn("````text", comment)
        self.assertIn("Wait for my approval", comment)
        self.assertIn(f"https://github.com/contributor/skills/blob/{self.sha}/{missing['directory']}/SKILL.md", comment)
        self.assertIn(f"https://github.com/expo/skills/compare/{self.pr['base']['sha']}...{self.sha}", comment)
        self.assertIn(f"npx --yes skills@1.9.0 add 'contributor/skills/plugins#{self.sha}' --all --copy", comment)
        setup = comment.split("```sh\n", 1)[1].split("\n```", 1)[0]
        self.assertNotIn("{{", setup)
        self.assertIn("{{skill_owner}}/{{skill_repo}}/plugins#{{skill_sha}}", comment)

    def test_large_comment_keeps_complete_prompts_and_links_to_the_full_summary(self):
        names = [f"expo-example-{i}" for i in range(30)]
        self.changed_skills.return_value = [{"name": name, "directory": f"plugins/expo/skills/{name}"} for name in names]
        with self.assertRaises(SystemExit):
            pr_evals.main()
        summary = self.summary.write.call_args_list[0].args[0]
        comment = self.publish.call_args.args[2]
        self.assertGreater(len(summary), pr_evals.COMMENT_LIMIT)
        self.assertLessEqual(len(comment), pr_evals.COMMENT_LIMIT)
        self.assertTrue(comment.endswith("in the run summary.](https://github.com/expo/skills/actions/runs/73)"))
        self.assertEqual(comment.count("<details>"), comment.count("</details>"))
        self.assertGreater(comment.count("<details>"), 0)
        self.assertLess(comment.count("<details>"), len(names))
        for name in names:
            self.assertIn(f"| `{name}` |", comment)
            block = f"<details><summary>Prepare a reviewed eval for {name}</summary>"
            self.assertIn(block, summary)
            if block in comment:
                self.assertIn(block + summary.split(block)[1].split("</details>")[0] + "</details>", comment)

    def test_oversized_table_fits_in_pending_and_final_comments(self):
        self.router_case["title"] = "x" * pr_evals.COMMENT_LIMIT
        self.list_cases.return_value.append({**self.router_case, "id": "short-case", "title": "Open settings"})
        pr_evals.main()
        self.assertEqual(self.statuses, ["pending", "success"])
        summary = self.summary.write.call_args_list[0].args[0]
        self.assertIn("x" * pr_evals.COMMENT_LIMIT, summary)
        for call in self.publish.call_args_list:
            comment = call.args[2]
            self.assertLessEqual(len(comment), pr_evals.COMMENT_LIMIT)
            self.assertTrue(comment.startswith(pr_evals.MARKER))
            self.assertIn("Open settings", comment)
            self.assertNotIn("xxxxxxxx", comment)
            self.assertIn("in the run summary.", comment)

    def test_fork_runs_credential_free_case_while_token_case_waits(self):
        self.list_cases.return_value.append({**self.router_case, "id": "auth-case", "title": "Publish an update"})
        self.validate_case.side_effect = [(self.required, False), (self.required, True)]
        with self.assertRaisesRegex(SystemExit, "rerun to authorize EXPO_TOKEN"):
            pr_evals.main()
        self.assertEqual(self.statuses, ["pending", "failure"])
        self.start_run.assert_called_once_with("test-key", "case-id", f"contributor/skills/plugins#{self.sha}", rerun=False)
        comment = self.publish.call_args.args[2]
        self.assertIn("Passed", comment)
        self.assertIn("Awaiting EXPO_TOKEN approval", comment)
        self.assertIn(self.sha, comment)
        self.assertIn("https://github.com/expo/skills/actions/runs/73", comment)

    def test_fork_rerun_authorizes_token_for_its_original_sha(self):
        pr_evals.os.environ["GITHUB_RUN_ATTEMPT"] = "2"
        self.validate_case.return_value = self.required, True
        pr_evals.main()
        self.assertEqual(self.statuses, ["pending", "success"])
        self.start_run.assert_called_once_with("test-key", "case-id", f"contributor/skills/plugins#{self.sha}", rerun=True)

        self.pr["head"]["sha"] = "c" * 40
        self.start_run.reset_mock()
        pr_evals.main()
        self.start_run.assert_not_called()

    def test_token_cases_on_same_repo_branches_require_a_rerun_only_for_bot_prs(self):
        self.pr["head"]["repo"] = self.base_repo
        self.validate_case.return_value = self.required, True
        self.pr["user"]["type"] = "Bot"
        self.assertEqual(pr_evals.evaluate(self.repo, self.pr, "/actions")[0], "failure")
        self.start_run.assert_not_called()
        self.assertIn("Awaiting EXPO_TOKEN approval", self.publish.call_args.args[2])

        self.pr["user"]["type"] = "User"
        self.assertEqual(pr_evals.evaluate(self.repo, self.pr, "/actions")[0], "success")
        self.start_run.assert_called_once_with("test-key", "case-id", f"{self.repo}/plugins#{self.sha}", rerun=False)

    def test_grading_checks_activation_and_each_task_at_the_exact_fork_revision(self):
        scenarios = [
            ("succeeded", {"skill-activation": 1, "task-page": 1}, "Passed", ""),
            ("succeeded", {"skill-activation": 1, "task-page": 0}, "Task checks failed", " (failed `task-page`)"),
            ("succeeded", {"skill-activation": 1}, "Task checks failed", ""),
            ("succeeded", {"skill-activation": 0, "task-page": 1}, "Skill use unverified", " (failed `skill-activation`)"),
            ("goal_not_met", {"end_goal": 0, "task-page": 0, "other-check": 0},
             "Goal not met", " (failed `end_goal`, `task-page`)"),
        ]
        report_url = "https://firegoat.ai/evals/expo.dev/reports/recipe"
        for outcome, checks, label, details in scenarios:
            with self.subTest(checks=checks, outcome=outcome):
                self.statuses.clear()
                self.start_run.reset_mock()
                self.publish.reset_mock()
                self.read_run.return_value = {**self.start_run.return_value, "status": "completed",
                                              "outcome": outcome, "checks": checks, "report_url": report_url,
                                              "failure_reason": "Private verifier detail"}
                if label == "Passed":
                    pr_evals.main()
                    state = "success"
                else:
                    with self.assertRaises(SystemExit):
                        pr_evals.main()
                    state = "failure"
                self.assertEqual(self.statuses, ["pending", state])
                queued, final = [c.args[2] for c in self.publish.call_args_list]
                self.assertIn(f"| [Queued]({self.start_run.return_value['url']}) |", queued)
                self.assertIn(f"| [{label}]({report_url}){details} |", final)
                self.assertNotIn("Private verifier detail", final)
                self.assertNotIn("other-check", final)
                self.start_run.assert_called_once_with("test-key", "case-id", f"contributor/skills/plugins#{self.sha}", rerun=False)

    def test_runs_every_exactly_tagged_case_and_shows_full_titles_as_literal_text(self):
        unusual = "[expo-router] Handle | deep links\r\nwith ``segments``, <b>@expo</b> and [links](https://example.com)"
        self.list_cases.return_value += [
            {**self.router_case, "id": "second-case", "title": unusual},
            {"id": "unrelated-case", "title": "[expo-router] Other skill", "tags": ["expo-skills-ci", "expo-router-tabs"]},
            {"id": "legacy-case", "title": "[expo-router] Title only", "tags": ["expo-skills-ci"]},
        ]
        pr_evals.main()
        self.assertEqual(self.start_run.call_count, 2)
        for update in self.publish.call_args_list:
            comment = update.args[2]
            self.assertIn("| `expo-router` | ` Open a page ` |", comment)
            self.assertIn(r"| `expo-router` | ``` [expo-router] Handle \| deep links with ``segments``, "
                          "<b>@expo</b> and [links](https://example.com) ``` |", comment)
            self.assertNotIn("Other skill", comment)
            self.assertNotIn("Title only", comment)

    def test_event_for_obsolete_head_leaves_new_revision_alone(self):
        self.pr["head"]["sha"] = "c" * 40
        pr_evals.main()
        self.assertEqual(self.statuses, [])
        self.fetch.assert_not_called()
        self.list_cases.assert_not_called()
        self.publish.assert_not_called()

    def test_shared_case_runs_once_for_both_changed_skills(self):
        long_name = "expo-example-with-long-name"
        self.changed_skills.return_value.append({"name": long_name, "directory": f"plugins/expo/skills/{long_name}"})
        self.router_case["tags"].extend(["nightly", "expo-exampl-c1a6f2e806b6"])
        pr_evals.main()
        self.assertEqual(self.statuses, ["pending", "success"])
        self.validate_case.assert_called_once_with("test-key", "case-id", ["expo-router", long_name])
        self.start_run.assert_called_once()
        self.read_run.assert_called_once()
        self.assertIn(f"| `expo-router`, `{long_name}` | ` Open a page ` | [Passed]", self.publish.call_args.args[2])


if __name__ == "__main__":
    unittest.main()
