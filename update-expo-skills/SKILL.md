---
name: Update Expo Skills
description: Updates the Expo skills installed on your computer. Supports switching between stable and main release branches.
allowed-tools: "Bash(**/update-expo-skills/scripts/update.sh:*)"
version: 1.0.0
license: MIT License
---

# Update Expo Skills

Updates the local clone of [expo/skills](https://github.com/expo/skills) and reinstalls all skills.

## Updating

To update skills on the user's current branch:

```bash
{baseDir}/scripts/update.sh
```

## Switching Branches

To switch to the stable branch (recommended for most users):

```bash
{baseDir}/scripts/update.sh --branch stable
```

To switch to the main branch (latest development changes):

```bash
{baseDir}/scripts/update.sh --branch main
```

## Branch Strategy

- **stable**: Release branch with stable, tested versions. Recommended for most users.
- **main**: Development branch with the latest changes. May contain experimental features.

The update script keeps you on your current branch by default. Use `--branch` to switch.

## Handling Local Changes

If the user has uncommitted local changes, the script will not proceed. The user has several options:

1. **Stash changes**: Run `git stash` to temporarily save your changes, update, then `git stash pop` to restore them.
2. **Discard changes**: Run `git checkout -- .` to discard all uncommitted changes (cannot be undone).
3. **Commit changes**: If you want to keep them, commit them first with `git add -A && git commit -m "message"`.
