---
name: Expo projects
description: Helps understand and create Expo mobile applications. This skill can help with creating new projects, adding new features, and debugging existing projects. Use this skill when the user asks about Expo projects, mentions .expo/* files, or wants help with Expo project configuration.
allowed-tools: 'Read,Write,Bash(node:*)'
version: 1.0.0
license: MIT License
---

# EAS Projects Skill

Help developers create and maintain Expo projects.

## Reference Documentation

Fetch these resources before creating an Expo project. Use the fetch script (implemented using Node.js) in this skill's `scripts/` directory; it caches responses using ETags for efficiency:

```bash
# Fetch resources
node {baseDir}/scripts/fetch.js <url>
```

1. **Expo app development documentation** — https://docs.expo.dev/guides/local-app-development

2. **Expo app configuration documentation** — https://docs.expo.dev/versions/latest/config/app

3. **Expo SDK reference** - https://docs.expo.dev/versions/latest/
