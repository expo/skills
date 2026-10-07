# Run the migration as a goal loop

Optional reference for [`expo-web-to-native`](../SKILL.md). Use this template only when the user explicitly requests a persistent goal loop and the host supports it. Otherwise follow the worklist during the current task. Limit the objective to the requested screens, budget, and execution period; respect later user changes and cancellation. The worklist records progress and does not grant permission to deploy, install additional tools, or access other projects.

Use it in one of two modes depending on the agent you're running.

## Mode A — the agent can run a goal loop

Use the host's documented goal command after the user's explicit request. Fill the template below with the agreed scope and limits; finish when the requested items are resolved, or stop when the user or host ends execution.

## Mode B — the agent can't loop itself

If the user asked for a reusable objective, write it to `migration-goal.md` and explain how they can launch it with their host's supported command. Do not create an automation or another chat as a substitute for a missing goal feature.

## The objective (template)

Fill the placeholders and adapt the objective to the user's requested scope. It is a task aid, subordinate to the user's instructions and the host's execution policy.

```
Goal: migrate <APP NAME> from web to a native Expo app by following the expo-web-to-native skill, one screen per iteration, until done.

Follow the available expo-web-to-native guidance, loading relevant references as needed. Each iteration:
1. If migration-progress.md doesn't exist yet, do the skill's step 1 (Assess) to
   create the worklist, then stop. Otherwise open it and take the top unchecked
   item under "nativize-now"; if none are left unresolved (every nativize-now is
   done or blocked), STOP and summarize what shipped + what's blocked and why.
2. Redesign that screen native per the skill's step 4 — reach for @expo/ui FIRST
   (real SwiftUI/Compose), then expo-router (NativeTabs, large titles);
   RN primitives only for custom layouts. NEVER a webview port.
   Use references/native-patterns.md (UX patterns) and references/false-friends.md
   (idioms). Match the web screen's content and behavior.
3. Verify per references/verify-on-device.md: compare the running web original
   (browser agent) against the native screen (simulator / argent) — content and
   behavior parity, NOT pixels (it should look more native). If it's off for reasons
   IN the code, fix it this iteration. If it's blocked by something OUTSIDE the code
   (missing backend/auth/data, or a secret you can't supply), don't loop — mark it
   blocked in step 4 and move on.
4. Check the item off in migration-progress.md, appending one line:
   "<screen> — done", or "<screen> — blocked: <reason> — needs <what would unlock>".
   Either way the item is resolved; never revisit a blocked one.

Scope and execution limits: <USER-REQUESTED SCREENS, BUDGET, AND EXECUTION PERIOD>.
Rules: one screen per pass; the app builds green each iteration; @expo/ui before RN primitives; never touch "nativize-later" items. Stop on user cancellation or host limits. Do not publish or expand the work without authorization.
Base API URL for native (no relative paths): <EXPO_PUBLIC_API_URL>
```

## Why a pre-shaped objective

The objective is filled in for this migration — worklist, redesign rules, and self-verification path already wired to the skill's references — so you can launch the loop without authoring one from scratch. Tailor the `<…>` slots and direction when a specific migration needs more than the template covers.
