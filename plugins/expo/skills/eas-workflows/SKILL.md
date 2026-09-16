---
name: eas-workflows
description: "EAS service (paid). Create, debug, or explain EAS Workflows YAML in .eas/workflows/, including EAS build and deployment automation. Use for EAS Workflows adoption, not unrelated CI configuration."
allowed-tools: "Read,Write,Bash(node:*),Bash(npx *eas-cli@*)"
version: 1.0.1
license: MIT License
---

# EAS Workflows Skill

> **EAS service - costs apply.** EAS Workflows run on Expo Application Services, a paid product with free-tier limits. Each workflow job consumes your plan's build/compute minutes; store distribution can also require Apple Developer or Google Play accounts. Review https://expo.dev/pricing before triggering runs.

Help developers write and edit EAS CI/CD workflow YAML files.

## Reference Documentation

For authoring or syntax changes, fetch the current schema with the bundled Node
helper; it caches responses with ETags. Resolve this skill's directory first:

```bash
node <skill-dir>/scripts/fetch.js https://api.expo.dev/v2/workflows/schema
```

- **[Schema](https://api.expo.dev/v2/workflows/schema):** current structure, job parameters, required fields, enums, and limits. Required when generating or changing workflow YAML.
- **[Syntax](https://docs.expo.dev/eas/workflows/syntax/):** read for expressions, contexts, and trigger semantics relevant to the task.
- **[Pre-packaged jobs](https://docs.expo.dev/eas/workflows/pre-packaged-jobs/):** read the selected jobs' input/output contracts when wiring them together.

Reuse applicable evidence already fetched for the task. A high-level explanation
does not require every source. If live sources are unavailable, inspect local
examples/help and clearly identify unverified fields; do not invent schema values.

## Workflow File Location

Workflows live in `.eas/workflows/*.yml` (or `.yaml`). Each file must be 16 KiB or smaller.

## Generating Workflows

When generating or editing workflows:

1. Fetch the schema to get current job types, parameters, and allowed values
2. Validate that required fields are present for each job type
3. Verify job references in `needs` and `after` exist in the workflow
4. Check that expressions reference valid contexts and outputs
5. Ensure `if` conditions respect the schema's length constraints

## Validation

After generating or editing a workflow file, validate it with EAS CLI from the Expo project root:

```sh
npx -y eas-cli@latest workflow:validate .eas/workflows/<workflow.yml> --non-interactive
```

Run the command separately for each changed workflow file. It requires a logged-in EAS CLI session and a linked Expo project. Unlike schema-only validation, it also checks build profile references against the project's `eas.json` and performs EAS server-side validation. Fix every reported error and rerun the command until it prints `Workflow configuration YAML is valid.` Do not replace this command with a local YAML or JSON Schema validator.

If authentication, project linking, or EAS availability blocks validation, finish
independently checkable YAML work and report EAS CLI validation as incomplete.
Do not initiate login, create a project, or run a workflow solely to complete an
authoring request without authorization. Local checks can catch errors while
blocked, but do not establish that EAS validation passed.

## Answering Questions

When users ask about available options (job types, triggers, runner types, etc.), fetch the schema and derive the answer from it rather than relying on potentially outdated information.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "eas-workflows" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
