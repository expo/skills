"""Read changed Expo skills from commit trees without checking out the PR."""

import os
import re
import subprocess


SKILL_ROOTS = ("plugins/expo/skills/", "plugins/expo-experiments/skills/")
SLUG = re.compile(r"(?:expo|eas)-[a-z0-9]+(?:-[a-z0-9]+)*")
GIT = ("git", "--no-replace-objects", "--literal-pathspecs", "-c", "core.fsmonitor=false")


def _git(*args):
    return subprocess.check_output([*GIT, *args])


def _directories(commit):
    result = {}
    for entry in _git("ls-tree", "-dz", commit, "--", *SKILL_ROOTS).split(b"\0"):
        if entry:
            metadata, path = entry.split(b"\t", 1)
            directory = os.fsdecode(path)
            name = directory.rsplit("/", 1)[-1]
            if len(name) <= 64 and SLUG.fullmatch(name):
                result[directory] = metadata.split()[2].decode("ascii")
    return result


def changed_skills(base_sha, head_sha):
    """Return added and edited skills relative to the PR's merge base."""
    for sha in (base_sha, head_sha):
        if not re.fullmatch(r"(?:[0-9a-f]{40}|[0-9a-f]{64})", sha):
            raise ValueError("expected a full Git commit SHA")
    base = _git("merge-base", base_sha, head_sha).decode("ascii").strip()
    before = _directories(base)
    after = _directories(head_sha)
    skills = []
    for directory, tree in sorted(after.items()):
        if before.get(directory) == tree:
            continue
        # Git also stores symlinks as blobs. Only a regular file defines a skill.
        entry = _git("ls-tree", "-z", tree, "--", "SKILL.md")
        if not entry.startswith((b"100644 blob ", b"100755 blob ")):
            continue
        skills.append({"name": directory.rsplit("/", 1)[-1], "directory": directory})
    return skills
