# Expo Agent Skills

This repository contains a collection of AI agent skills for Expo developers.

## Skills

- [Update Expo Skills](./update-expo-skills/): updates the Expo skills installed on your computer.
- [Expo CI/CD Workflows](./expo-cicd-workflows/): write YAML configuration files to define CI/CD workflows that run on EAS.

## Installation

Your system's default version of Node must be version 22.18.0 or newer.

Clone this repository and run `./install`. The installation script creates symlinks in `~/.claude/skills` to your clone of this repository.

You can update your skills by running `git pull` and `./install` again.

## Updating

To update your Expo skills, ask your AI agent to "update Expo skills." This runs the "Update Expo Skills" skill, which pulls the latest changes and reinstalls the skills.
