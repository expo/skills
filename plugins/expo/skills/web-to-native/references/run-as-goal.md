# Run the migration as a goal loop

Disclosed reference for [`web-to-native`](../SKILL.md), step 4. Step 4 is a repeat-until-done loop (port → nativize → verify → check off), which is exactly the shape of a **goal loop** — a single objective re-injected every turn until the worklist is empty. This file carries a ready-shaped objective for that loop: a migration-specific, lightweight `plan-for-goal`, so you don't have to author one.

Use it in one of two modes depending on the agent you're running.

## Mode A — the agent can run a goal loop

Harnesses with a goal/loop command (Claude Code `/goal`, Codex CLI, or any harness of the same shape) can drive this themselves. Fill the template below and hand it to that command — the loop re-runs it until `migration-progress.md` has no unchecked nativize-now items.

## Mode B — the agent can't loop itself

Write the filled-in objective to `migration-goal.md` in the project, then give the user the one-line instruction to launch it (e.g. *"run your agent's goal loop with the objective in `migration-goal.md`"*). The objective is plain text and portable, so the user runs it in whatever harness they have.

## The objective (template)

Fill the two `<…>` slots, then run or hand off verbatim. It is written to survive re-injection — it restates its own worklist, direction, and stop condition every turn.

```
Goal: migrate <APP NAME> from web (DOM components) to native, one screen per iteration, until done.

Worklist: migration-progress.md. Each iteration:
1. Open migration-progress.md and take the top unchecked item under "nativize-now".
   If none remain, STOP and print a summary of every screen migrated.
2. Replace that screen's 'use dom' component with native UI — View/Text/Image,
   Expo Router navigation, FlatList/FlashList for lists, @expo/ui for native
   components (sheets, pickers, sliders). Match the web screen's behavior and data.
3. For every web idiom you touch (className, onClick, localStorage, window, fetch,
   relative URLs, …) apply the native equivalent from references/false-friends.md.
   Leave no web-only API behind.
4. Verify by COMPARING the two running apps — not a clean build: with a browser
   agent open the route in the web original (dev server or deployed URL) and
   capture it; with a device agent / simulator open the same route in the native
   app and capture it; compare layout, content, behavior. Native primitives, NO
   webview, matches the web screen. If it doesn't, fix it this iteration.
5. Check the item off in migration-progress.md and append one line at the bottom:
   "<screen> — done", or "<screen> — blocked: <reason>" and skip it.

Rules: exactly one screen per iteration. Never touch "nativize-later" items.
The app must build green at the end of every iteration.
Direction: it should feel like a native app, not a website in a shell.

Base API URL for native (no relative paths): <EXPO_PUBLIC_API_URL>
```

## Why this and not the full `plan-for-goal`

`plan-for-goal` is the general skill for turning *any* conversation into a goal objective. This is the same idea pre-shaped for one known task, so the objective, worklist, and self-verification path are already filled in. Reach for `plan-for-goal` instead only when the migration needs direction this template doesn't cover.
