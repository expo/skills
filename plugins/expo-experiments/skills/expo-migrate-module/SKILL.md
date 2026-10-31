---
name: expo-migrate-module
description: Migrate an existing Apple/Swift Expo native module from the Expo Modules API 1.0 definition DSL to the 2.0 macro API (sometimes called v2) while preserving its JavaScript and TypeScript contract. Use when converting or incrementally adopting @ExpoModule, @JS, @Event, @SharedObject, or @Record in an existing module. Do not use for creating a new module, general Expo SDK upgrades, or Android/Kotlin migrations.
license: MIT
---

# Migrate an Expo Module

Migrate the Swift side of an existing Expo module without changing its observable JS API. Treat the current JS/TypeScript surface and tests as the compatibility contract. Leave Kotlin on the 1.0 DSL unless the user explicitly expands the task.

## Prerequisite

Use `expo` `58.0.21` or newer. Earlier `58.0.x` releases lack tuple conversion and the `expand` command. Older ones also lack `lazy` `@JS` properties, `SharedRef<T>` subclasses in `@SharedObject`, static shared-object members, and `.withAsync`, and the oldest lack closure arguments and free-form `Any` return values. SDK 57 also lacks `.concurrent`, `@Union`, and module auto-discovery. Do not target either. Before editing, check the installed version (`npm ls expo`, or the lockfile). If it is older, stop and tell the user to upgrade first.

Check the example app's own dependencies too, not only the module root. The example app is the integration surface you build and launch in step 4, so it needs the same floor.

This is a floor, not a guarantee: the macro and core surface changed in almost every `58.0.x` patch release, so step 2 must still verify the installed source.

The macros are still **experimental and undocumented**: SDK 58 has no page about them in the Expo docs, and the API can still change under you. Say this to the user before a large migration, and prefer incremental mixed mode over converting a module wholesale.

## References

- Read `references/migration-map.md` before changing source. It contains the 1.0-to-2.0 mappings, semantic traps, and mixed-mode rules.
- Read `references/example.md` for a full before/after walkthrough of one module through mixed mode to a complete migration. Consult it when you need to see how the per-member rules compose.
- Read `references/compatibility.md` when the checked-out `expo-modules-core` version or branch is not known to support every requested macro. It explains how to verify the actual compile-time and runtime surface instead of guessing from a version number, gives the SDK 58 status of each capability, and shows how to run the module scanners and the `expand` command.

## Workflow

### 1. Establish the contract

Inspect repository instructions and the worktree before editing. Locate the Swift module classes, records, shared objects, native views, JS/TS bindings, tests, example app, podspec, `expo-module.config.json`, and installed or checked-out `expo-modules-core`.

Inventory every exported item before rewriting it:

- module and shared-object JS names
- function names, arity, labels, defaults, nullability, sync/async behavior, errors, and queue/thread semantics (note which `AsyncFunction` bodies do blocking or long-running work, any `.runOnQueue(...)`, and sync/async pairs that share a body, such as `readSync` and `read`)
- property names, mutability, and constant caching behavior
- event wire names and payload shapes, including events sent with no body (1.0 `sendEvent("name")` sends `{}`)
- record field names, defaults, requiredness, and nullability
- shared-object constructors and instance/static placement (`Function` vs `StaticFunction`/`StaticAsyncFunction`)
- lifecycle hooks and views

Use the TypeScript declarations and JS call sites to resolve ambiguity. Do not silently "improve" requiredness, rename an event, or change sync behavior during a syntax migration.

### 2. Verify the available 2.0 surface

Inspect the macro declarations and matching core hooks in the dependency actually used by the target. Do not assume that all items in the 2.0 design are present because one macro compiles.

Classify each 1.0 item as:

- **Migrate:** both its macro and required core runtime support exist.
- **Keep in DSL:** mixed mode preserves it safely, or 2.0 lacks an equivalent.
- **Blocked:** migration would alter the JS contract or requires unavailable runtime support.

A DSL member that takes or returns `JavaScriptValue` does not compile on SDK 58, so it cannot stay in the DSL. Migrate it to `@JS` with a `borrowing JavaScriptValue` parameter, as described in `references/migration-map.md`.

Prefer an incremental mixed-mode result over speculative generated code. Keep `definition()` for any remaining DSL elements; delete it only when it is empty and the resolved module name is preserved by `@ExpoModule`.

### 3. Apply the migration

Migrate one semantic group at a time: module naming, functions, properties/constants, events, shared objects, then records. Keep the diff narrow.

Follow these invariants:

- Preserve every existing JS-visible name explicitly when Swift naming rules or macro defaults differ.
- Keep original optional/default behavior. An optional 1.0 record field must not become required merely because 2.0 can express required fields.
- Keep same-JS-name overloads on the DSL. The plugin does not dispatch overloads, and it reports two `@JS` members with one JS name on one object as a build error.
- Preserve async threading behavior. A 1.0 `AsyncFunction` body ran off the JS thread; a 2.0 `async` `@JS` member starts on it and leaves only at the first `await`. A body that never awaits therefore blocks the JS thread, with no change to the JS signature. Audit what runs before the first `await`, and never leave blocking I/O on the JS actor. Fix with `@JS(.concurrent)`, or restructure onto Swift Concurrency or a continuation. Queue-pinned functions get the same treatment; `.runOnQueue(.main)` becomes a `@MainActor` `async` function. Merge a sync/async pair that shares a body into one function with `.withAsync("name")`. See the threading section in `references/migration-map.md`.
- Do not use `@ViewProps`, `@ExpoView`, or `@Event(sync: true)`. The plugin implements them, but SDK 58 core does not declare the two view macros and has no runtime support for synchronous events, so none of them builds. Keep 1.0 views on the DSL. Check the installed core for each of these instead of trusting a plugin version. `references/compatibility.md` has the per-capability checks.
- Keep the `OnAppContextDestroys`, `OnAppEntersForeground`, `OnAppEntersBackground`, and `OnAppBecomesActive` components in `definition()`. 2.0 has no hook for them.
- Keep the JS payload of every event. A `() -> Void` `@Event` sends `undefined`, but a 1.0 `sendEvent("name")` without a body sent `{}`. When JS code reads that payload, give the event an empty `@Record` payload type, which encodes to `{}`, or ask the user before you change it.
- Keep `expo-module.config.json` as it is. When it has an `apple.modules` list (even an empty one), autolinking links only those classes. The entries are bare Swift class names, so renaming a class during migration detaches the module silently: it builds, then is absent at runtime. Without the list, autolinking links the `public` or `open` `@ExpoModule` classes that it finds in the package sources. It does not find a class that is still on the 1.0 DSL alone. A migrated class must stay `public` or `open` in both cases. Remove the list only when the user asks and every module class qualifies.
- Do not change Kotlin, JS wrappers, or public `.d.ts` files unless the user requested an API change.
- Never write macro-generated symbols into the module's source. The macro emits them; hand-writing or overriding them is not part of a migration.

After each group, search for old DSL entries and call sites that should have moved. Avoid broad formatting or unrelated cleanup.

### When a 2.0 equivalent is missing or a group fails

When step 2 classified an item as **Blocked**, or a migrated group fails to build or breaks the contract, do not force it. Stop on that group and:

1. **Ask the user how to proceed** for that item, with two options:
   - **Co-exist:** keep the item in the 1.0 `definition()` DSL alongside the migrated `@ExpoModule` (mixed mode) and continue with the other groups.
   - **Revert:** back out the group's edits, leaving it untouched on 1.0, and move on.

   Default to co-existence when mixed mode is verified safe, since it preserves the most progress. Revert when the half-applied change left the module in a non-building state and cannot be salvaged incrementally.

2. **Open a tracking issue on `expo/expo`** noting the functionality that 2.0 does not yet cover, so the gap is recorded rather than silently worked around. Use `gh issue create --repo expo/expo` and confirm with the user before posting (per repo conventions, do not post outward-facing comments without approval). Include:
   - the 1.0 member and its JS contract
   - the specific macro or core hook that is missing (cite the evidence gap from `references/compatibility.md`)
   - the installed `expo` version, or the `expo-modules-core` branch when the module builds against a checkout

   Reference the issue in the handoff so the remaining DSL entry is traceable to a known limitation.

Keep going with the groups that do migrate cleanly; one blocked member does not block the rest.

### 4. Verify behavior

Run the narrowest available checks first, then the real integration surface:

1. Run the `expand` diagnostics check in `references/compatibility.md`. It reports macro errors and warnings in seconds, without a build.
2. Build or type-check the Apple module against the target `expo-modules-core`.
3. Run native unit tests and JS/TS tests.
4. Build and launch the example app when the repository provides one.
5. Confirm that autolinking still links every module class. With an `apple.modules` list, each entry must match a Swift class name as it now stands. Without the list, run the `scanModules` check in `references/compatibility.md` and confirm that it reports every class as `public` or `open`. A stale entry or a missed class builds clean and fails only at runtime, so the example app must actually resolve the module, not merely compile.
6. Compare the final exported surface with the inventory from step 1. The `scanExports` check in `references/compatibility.md` lists the JS names, parameters, and sync/async shape of every migrated member. Members that stay in the DSL are not in its output.
7. Search for stale `Name`, migrated `Function`/`AsyncFunction`/`StaticFunction`/`StaticAsyncFunction`/`Property`/`Constant`/`Events` entries, old `sendEvent` calls, `@Field`, and duplicate registrations. Search the source you wrote, not macro expansion output.

Expansion alone is insufficient: `expand` runs only the macros, so generated code with no diagnostics can still fail to link or run against a mismatched core. If dependencies changed or macro plugin flags are missing, reinstall JS dependencies as appropriate, run the repository's CocoaPods installation workflow, and restart Xcode before diagnosing plugin communication failures.

## Handoff

Never print macro-generated or core-internal symbol names to the user. `references/compatibility.md` cites them so you can grep for them, and the `expand` output is full of them, but they are implementation details that change between plugin revisions, and they are noise in a report. Name a capability by its macro (`@JS static`, `@Event(sync:)`) and by observable JS behavior. Say "the installed core does not support synchronous events yet", not the name of the missing method. The exception is a tracking issue on `expo/expo`, where the specific missing hook is the point.

Report:

- which members moved to 2.0
- which members intentionally remain in the 1.0 DSL and why
- any compatibility-sensitive choices, especially event names, record requiredness, constants, and queues
- the commands run and any verification not completed

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes @expo/agent-cli@latest feedback --category skills --subject "expo-migrate-module" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an agent repeatedly fails at an Expo task or the user has to step in, submit a brief report of the task, expected result, and what went wrong using `--category evals` and the relevant Expo package or command as `--subject`.
