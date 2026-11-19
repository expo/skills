"""Render the human-reviewed Firegoat authoring prompt for one PR skill."""

import re
from pathlib import Path
from string import Template

from hosted import SOURCE_TEMPLATE, setup_command


def authoring_prompt(skill, pr):
    name, directory = skill["name"], skill["directory"]
    if not re.fullmatch(r"(?:expo|eas)-[a-z0-9]+(?:-[a-z0-9]+)*", name) or directory not in (
        f"plugins/expo/skills/{name}", f"plugins/expo-experiments/skills/{name}",
    ):
        raise ValueError("Invalid skill directory")
    base, head = pr["base"], pr["head"]
    for revision in (base, head):
        if (not re.fullmatch(r"[a-zA-Z0-9-]+/[a-zA-Z0-9_.-]+", revision["repo"]["full_name"])
                or not re.fullmatch(r"[0-9a-f]{40}", revision["sha"])):
            raise ValueError("Invalid GitHub revision")

    template = Template(Path(__file__).with_name("authoring-prompt.md").read_text())
    return template.substitute(
        skill=name,
        source_template=SOURCE_TEMPLATE,
        skill_url=f"https://github.com/{head['repo']['full_name']}/blob/{head['sha']}/{directory}/SKILL.md",
        diff_url=f"https://github.com/{base['repo']['full_name']}/compare/{base['sha']}...{head['sha']}",
        setup=setup_command(name).replace(SOURCE_TEMPLATE, f"{head['repo']['full_name']}/plugins#{head['sha']}"),
    ).rstrip()
