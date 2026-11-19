import http.client
import unittest
from unittest.mock import Mock, patch

from scripts.firegoat import hosted


RUN_ID = "b28b4fad-432d-496f-a3d4-d445dc48ec2c"
RUN = {
    "runId": RUN_ID,
    "runUrl": f"https://firegoat.ai/evals/expo.dev/runs/{RUN_ID}",
    "status": "pending",
    "harness": "claude-code",
    "model": "claude-sonnet-4-6",
}
CASE_ID = "90165273-a27c-4763-8538-762a082d50db"
SOURCE = "contributor/skills/plugins#" + "a" * 40
SOURCE_ARGS = {"skill_owner": "contributor", "skill_repo": "skills", "skill_sha": "a" * 40}
EXPO_CREDENTIAL = {
    "key": "EXPO_TOKEN",
    "credentialName": "EXPO_TOKEN",
    "credentialId": "703881aa-2834-4408-b110-ad5fe12cb879",
}
CASE = {
    "id": CASE_ID,
    "title": "Build a working example",
    "text": "Build an example I can run.",
    "endGoal": "The example runs.",
    "status": "active",
    "tags": ["expo-example", "expo-skills-ci"],
    "templateVars": ["skill_sha", "skill_owner", "skill_repo"],
    "setupCommand": hosted.setup_command("expo-example") + "\nprintf 'fixture' > example.txt",
    "checks": {"skill-activation": "Claude loaded the skill.", "task-example": "The example works."},
    "envMode": "none",
    "env": [],
    "envCredentials": [],
    "loginHintsStatus": "none",
    "loginHints": "",
    "inheritedLoginHints": None,
    "loginHintsCredential": None,
}


class HostedTest(unittest.TestCase):
    def test_lists_only_active_reviewed_cases_across_pages(self):
        second = {**CASE, "title": "Diagnose an example"}
        pages = [[CASE, {**CASE, "status": "archived"}], [second, {**CASE, "tags": ["other"]}], []]
        with patch.object(hosted, "PAGE_SIZE", 2), patch.object(hosted, "_request", side_effect=pages) as request:
            self.assertEqual(hosted.list_cases("test"), [CASE, second])
        self.assertIn("tags=expo-skills-ci", request.call_args_list[0].args[2])
        self.assertIn("offset=4", request.call_args.args[2])

    def test_validates_full_reviewed_case_and_allows_a_fixture(self):
        checks = {**CASE["checks"], "build": None, "installed": "The dependencies are installed."}
        with patch.object(hosted, "_request", return_value={**CASE, "checks": checks}) as request:
            self.assertEqual(hosted.validate_case("test", CASE_ID, ["expo-example"]), ({
                "skill-activation", "task-example", "installed",
            }, False))
        request.assert_called_once_with("test", "GET", f"/prompts/{CASE_ID}")

    def test_long_skill_names_have_distinct_tags_within_the_firegoat_limit(self):
        self.assertNotEqual(hosted.skill_tag(hosted.CI_TAG), hosted.CI_TAG)
        self.assertEqual(hosted.skill_tag("eas-12345678901234567890"), "eas-12345678901234567890")
        for skill, tag in (("expo-example-with-long-name", "expo-exampl-c1a6f2e806b6"),
                           ("expo-example-with-long-link", "expo-exampl-2a05cc3ce8d6")):
            self.assertEqual(hosted.skill_tag(skill), tag)
            case = {**CASE, "tags": ["expo-skills-ci", tag], "setupCommand": hosted.setup_command(skill)}
            with self.subTest(skill=skill), patch.object(hosted, "_request", return_value=case):
                self.assertEqual(hosted.validate_case("test", CASE_ID, [skill]), (set(CASE["checks"]), False))

    def test_checks_each_changed_target_of_a_shared_case(self):
        names = ["expo-example", "expo-ui"]
        case = {**CASE, "tags": ["expo-skills-ci", *names, "nightly"]}
        with patch.object(hosted, "_request", return_value=case):
            with self.assertRaisesRegex(ValueError, "installation block for expo-ui"):
                hosted.validate_case("test", CASE_ID, names)
            case["setupCommand"] += "\n" + hosted.setup_command("expo-ui")
            self.assertEqual(hosted.validate_case("test", CASE_ID, names), (set(CASE["checks"]), False))
            case["tags"].remove("expo-ui")
            with self.assertRaisesRegex(ValueError, "expo-ui tag"):
                hosted.validate_case("test", CASE_ID, names)

    def test_accepts_a_reference_to_the_saved_expo_token(self):
        case = {**CASE, "envMode": "set", "env": ["EXPO_TOKEN"], "envCredentials": [EXPO_CREDENTIAL]}
        with patch.object(hosted, "_request", return_value=case):
            self.assertEqual(hosted.validate_case("test", CASE_ID, ["expo-example"]), (set(CASE["checks"]), True))

    def test_rejects_missing_or_blank_prompt_text_and_end_goal(self):
        for field in ("text", "endGoal"):
            case = CASE.copy()
            del case[field]
            for override in ({}, {field: None}, {field: ""}, {field: "  \n"}, {field: 42}):
                with self.subTest(field=field, override=override), patch.object(hosted, "_request", return_value={**case, **override}):
                    with self.assertRaisesRegex(ValueError, field):
                        hosted.validate_case("test", CASE_ID, ["expo-example"])

    def test_handles_template_variables_only_present_in_setup(self):
        case = {**CASE, "templateVars": []}
        with patch.object(hosted, "_request", return_value=case):
            self.assertEqual(hosted.validate_case("test", CASE_ID, ["expo-example"]), (set(CASE["checks"]), False))
        with patch.object(hosted, "_request", return_value={**case, "setupCommand": case["setupCommand"] + "\necho '{{other}}'"}):
            with self.assertRaisesRegex(ValueError, "exactly these"):
                hosted.validate_case("test", CASE_ID, ["expo-example"])

    def test_rejects_literal_inherited_extra_or_malformed_token_bindings(self):
        case = {**CASE, "envMode": "set", "env": ["EXPO_TOKEN"], "envCredentials": [EXPO_CREDENTIAL]}
        for override in (
            {"envMode": "none"}, {"envMode": "inherit"},
            {"env": []}, {"env": ["EXPO_TOKEN", "OTHER"]}, {"envCredentials": []},
            {"envCredentials": {"EXPO_TOKEN": EXPO_CREDENTIAL["credentialId"]}},
            {"envCredentials": [EXPO_CREDENTIAL, {**EXPO_CREDENTIAL, "key": "OTHER"}]},
            {"envCredentials": [{**EXPO_CREDENTIAL, "key": "OTHER"}]},
            {"envCredentials": [{**EXPO_CREDENTIAL, "credentialName": "OTHER"}]},
            {"envCredentials": [{**EXPO_CREDENTIAL, "credentialId": "invalid"}]},
            {"envCredentials": [{"key": "EXPO_TOKEN", "credentialName": "EXPO_TOKEN"}]},
            {"envCredentials": [None]}, {"loginHints": "Use the test account."},
            {"loginHintsStatus": "inherited"}, {"loginHintsCredential": EXPO_CREDENTIAL},
            {"inheritedLoginHints": {"from": "parent"}},
            {"loginHintsHasSecrets": True},
        ):
            with self.subTest(override), patch.object(hosted, "_request", return_value={**case, **override}):
                with self.assertRaises(ValueError):
                    hosted.validate_case("test", CASE_ID, ["expo-example"])

    def test_installs_all_skills_for_every_agent_regardless_of_target(self):
        for skill in ("expo-overview", "expo-example"):
            with self.subTest(skill):
                self.assertEqual(hosted.setup_command(skill).splitlines(), [
                    "set -eu", "cd /app",
                    "npx --yes skills@1.9.0 add '{{skill_owner}}/{{skill_repo}}/plugins#{{skill_sha}}' --all --copy",
                    f"test -s '.agents/skills/{skill}/SKILL.md'",
                    f"test -s '.claude/skills/{skill}/SKILL.md'",
                ])

    def test_rejects_mismatched_or_unsafe_cases(self):
        for override in (
            {"tags": ["expo-example"]}, {"tags": ["expo-skills-ci"], "title": "[expo-example] Former convention"},
            {"tags": ["expo-skills-ci", "expo-examples"]}, {"tags": "expo-skills-ci expo-example"}, {"status": "archived"},
            {"templateVars": ["skill_source"]}, {"templateVars": ["skill_owner", "skill_repo"]},
            {"templateVars": ["skill_owner", "skill_sha", "skill_sha"]},
            {"templateVars": None}, {"setupCommand": hosted.setup_command("expo-other")},
            {"setupCommand": CASE["setupCommand"].replace(hosted.SOURCE_TEMPLATE, "{{skill_source}}")},
            {"setupCommand": CASE["setupCommand"].replace("--all", "--skill 'expo-example' --agent claude-code --yes")},
            {"setupCommand": CASE["setupCommand"].replace(" --copy", "")},
            {"checks": {"skill-activation": "Proof"}}, {"checks": {"task-result": "Proof", "skill-activation": " "}},
            {"envMode": "inherit"}, {"env": ["TOKEN"]}, {"envCredentials": [{"key": "TOKEN"}]},
            {"loginHintsStatus": "inherited"}, {"loginHintsCredential": {"credentialId": "1"}},
            {"hasSecrets": True},
        ):
            with self.subTest(override), patch.object(hosted, "_request", return_value={**CASE, **override}):
                with self.assertRaises(ValueError):
                    hosted.validate_case("test", CASE_ID, ["expo-example"])

    def test_reuses_existing_run_across_pages(self):
        matched = {**RUN, "status": "failed", "templateArgs": SOURCE_ARGS}
        pages = [[{**RUN, "templateArgs": None}], [matched]]
        with patch.object(hosted, "PAGE_SIZE", 1), patch.object(hosted, "_request", side_effect=pages) as request:
            self.assertEqual(hosted.start_run("test", CASE_ID, SOURCE)["id"], RUN_ID)
        self.assertTrue(all(c.args[1] == "GET" for c in request.call_args_list))
        self.assertIn("offset=1", request.call_args.args[2])

    def test_explicit_rerun_reuses_an_in_flight_run(self):
        matched = {**RUN, "templateArgs": SOURCE_ARGS}
        with patch.object(hosted, "_request", return_value=[matched]) as request:
            self.assertEqual(hosted.start_run("test", CASE_ID, SOURCE, rerun=True)["id"], RUN_ID)
        self.assertEqual(request.call_count, 1)

    def test_different_harness_or_model_never_supplies_the_ci_result(self):
        matched_source = {**RUN, "templateArgs": SOURCE_ARGS}
        experiments = [{**matched_source, "harness": "opencode"}, {**matched_source, "model": "claude-opus-5"}]
        with patch.object(hosted, "_request", side_effect=[experiments, RUN]) as request:
            hosted.start_run("test", CASE_ID, SOURCE)
        self.assertEqual(request.call_args.args[1:3], ("POST", f"/prompts/{CASE_ID}/run"))

    def test_requests_only_an_existing_reviewed_case(self):
        old = {**RUN, "status": "completed", "templateArgs": SOURCE_ARGS}
        responses = [[old], {"runId": RUN_ID, "runUrl": RUN["runUrl"]}]
        with patch.object(hosted, "_request", side_effect=responses) as request:
            result = hosted.start_run("test", CASE_ID, SOURCE, rerun=True)
        self.assertEqual(result["status"], "pending")
        self.assertEqual(request.call_args.args[1:], ("POST", f"/prompts/{CASE_ID}/run", {
            "templateArgs": SOURCE_ARGS,
            "harnessModel": {"harness": "claude-code", "model": "claude-sonnet-4-6"},
        }))

    def test_ignores_runs_with_old_or_different_source_arguments(self):
        for args in (
            {"skill_source": SOURCE},
            {**SOURCE_ARGS, "skill_owner": "another-fork"},
            {**SOURCE_ARGS, "skill_repo": "another.repo"},
            {**SOURCE_ARGS, "skill_sha": "b" * 40},
        ):
            existing = {**RUN, "templateArgs": args}
            with self.subTest(args=args), patch.object(hosted, "_request", side_effect=[[existing], RUN]) as request:
                hosted.start_run("test", CASE_ID, SOURCE)
                self.assertEqual(request.call_args.args[1], "POST")
                self.assertEqual(request.call_args.args[3]["templateArgs"], SOURCE_ARGS)

    def test_rejects_invalid_source_before_request(self):
        for source in (
            "owner/repo/plugins#main", "owner/repo#" + "a" * 40, "owner/repo/other#" + "a" * 40,
            "owner/repo;echo/plugins#" + "a" * 40, "owner/../plugins#" + "f" * 40,
            "owner/./plugins#" + "a" * 40, "owner!/repo/plugins#" + "a" * 40,
            "owner/repo/name/plugins#" + "a" * 40, "owner/repo/plugins#" + "z" * 40,
            "owner/repo/plugins#" + "a" * 40 + "\n",
        ):
            with self.subTest(source), patch.object(hosted, "_request") as request:
                with self.assertRaises(ValueError):
                    hosted.start_run("test", CASE_ID, source)
                request.assert_not_called()

    def test_does_not_replay_a_post_if_the_connection_drops(self):
        connection = Mock()
        connection.getresponse.side_effect = http.client.RemoteDisconnected()
        with patch.object(hosted.http.client, "HTTPSConnection", return_value=connection):
            with self.assertRaises(hosted.FiregoatError):
                hosted._request("test", "POST", f"/prompts/{CASE_ID}/run", {"templateArgs": SOURCE_ARGS})
        connection.request.assert_called_once()

    def test_reads_unpublished_report_using_the_report_slug(self):
        run = {**RUN, "status": "completed", "reportSlug": "attempt-one", "report": None}
        report = {"outcome": "goal_not_met", "reward": {"checklist": {"working": 0, "skill-activation": 1}}}
        with patch.object(hosted, "_request", side_effect=[run, report]) as request:
            result = hosted.read_run("test", RUN_ID)
        self.assertEqual(request.call_args.args[2], "/reports/attempt-one")
        self.assertEqual(result["outcome"], "goal_not_met")
        self.assertEqual(result["checks"], report["reward"]["checklist"])
        self.assertEqual(result["report_url"], "https://firegoat.ai/evals/expo.dev/reports/attempt-one")

    def test_pending_publication_and_failed_setup(self):
        with patch.object(hosted, "_request", side_effect=[
            {**RUN, "status": "completed", "reportSlug": "pending"},
            hosted.FiregoatError("report unavailable", 404),
        ]):
            self.assertEqual(hosted.read_run("test", RUN_ID)["checks"], {})
        next_attempt = "328d0ef2-5446-4b83-9783-26b1be6dec3b"
        run = {**RUN, "status": "failed", "failureReason": "setup failed", "retriedAs": next_attempt}
        with patch.object(hosted, "_request", return_value=run):
            result = hosted.read_run("test", RUN_ID)
        self.assertEqual(result["retried_as"], next_attempt)
        self.assertEqual(result["failure_reason"], "setup failed")
        self.assertIsNone(result["outcome"])

    def test_rejects_a_non_firegoat_run_url(self):
        with patch.object(hosted, "_request", return_value={**RUN, "runUrl": "https://other.example/"}):
            with self.assertRaisesRegex(ValueError, "dashboard URL"):
                hosted.read_run("test", RUN_ID)


if __name__ == "__main__":
    unittest.main()
