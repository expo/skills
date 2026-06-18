# Telemetry internals (maintainer reference)

Background for the scripts under `scripts/`. The runtime surface — what's sent, how to
submit feedback, how to turn it off — is in `../SKILL.md`; this file is for auditing or
changing the telemetry.

## Event shape

- `event`: `skill_invoked` | `skill_feedback`
- `distinct_id`: `expo-skills-installation:<installation_id_hash>`
- `properties.source`: `expo-skills` · `properties.$process_person_profile`: `false`
- `properties.skill`: skill folder name (e.g. `expo-deployment`)
- `properties.agent_harness`: `claude-code` (auto-detected), else `unknown`; `--agent-harness` overrides
- `properties.os` / `arch`: platform (e.g. `macos` / `arm64`), non-PII
- `properties.installation_id_hash`: anonymous hash of the local random install id (the raw id never leaves the machine)
- `skill_invoked` adds `properties.initiator`: `ai` (Skill tool) | `user` (`/slash`)
- `skill_feedback` adds `properties.rating`, `properties.feedback_text`, and `properties.about`: `skill` (default) | `expo` (the trouble is Expo itself, not the skill)

That list **is** the whole privacy surface: only the skill name, anonymous hashes, and
platform leave the machine — never prompts, chat history, code, file paths, or tool inputs.
Qualitative context is opt-in only, as a scrubbed note in `skill_feedback`'s `--text`.

## PostHog key

The `phc_…` key in `scripts/telemetry_common.cjs` is a **write-only, public** ingestion key
(safe to commit; it's what makes telemetry on by default). Override per environment with
`EXPO_SKILLS_POSTHOG_KEY`. Never put a *personal* key (`phx_…`) here. Strip the key (empty
or `phc_REPLACE_ME`, e.g. a fork) and the scripts go inert.

## Why Claude Code only

`skill_invoked` fires from `hooks/hooks.json` — `PostToolUse[Skill]` (→ `ai`) and
`UserPromptExpansion` (→ `user`), both verified end-to-end. Other harnesses get no automatic
signal and we ship no hooks file for them: on **Codex** (codex-cli 0.138 + the `openai/codex`
source) plugin hooks are a removed feature (`Feature::PluginHooks` = `Stage::Removed`) and
there's no skill event in `HookEventName`; **Cursor** has no plugin hooks. If OpenAI restores
`plugin_hooks` *and* adds a skill event, wiring is small — Codex already aliases
`${CLAUDE_PLUGIN_ROOT}`.

The *how* (detach, temp-file payload handoff, Windows fail-open) lives in the scripts' own
comments — read those before changing them.
