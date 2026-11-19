import os
import subprocess
import tempfile
import unittest
from pathlib import Path

from changes import changed_skills


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

        result = changed_skills(base, head)
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

        result = changed_skills(base, head)
        self.assertEqual(result, [{"name": "eas-example", "directory": self.experimental.as_posix()}])

    def test_no_changed_skills_and_option_rejection(self):
        self.add_skill(self.skill)
        base = self.commit("initial")
        self.write(Path("README.md"), "Updated docs.\n")
        head = self.commit("docs")
        self.assertEqual(changed_skills(base, head), [])
        with self.assertRaises(ValueError):
            changed_skills("--help", head)

    def test_copy_edit_in_either_plugin_counts(self):
        for directory in (self.skill, self.experimental):
            self.add_skill(directory)
        base = self.commit("initial")
        for directory in (self.skill, self.experimental):
            self.add_skill(directory, "A test skill.")
        head = self.commit("add punctuation")
        self.assertEqual({s["name"] for s in changed_skills(base, head)}, {"expo-ui", "eas-example"})


if __name__ == "__main__":
    unittest.main()
