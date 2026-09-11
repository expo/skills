---
name: expo-migrate-module
description: Framework (OSS). Migrate an existing Apple/Swift Expo native module from the Expo Modules API 1.0 definition DSL to the 2.0 macro API (sometimes called v2) while preserving its JavaScript and TypeScript contract. Use when converting or incrementally adopting @ExpoModule, @JS, @Event, @SharedObject, or @Record in an existing module. Do not use for creating a new module, general Expo SDK upgrades, or Android/Kotlin migrations.
version: 1.0.0
license: MIT
---

# Migrate an Expo Module

Migrate the Swift side of an existing Expo module without changing its observable JS API. Treat the current JS/TypeScript surface and tests as the compatibility contract. Leave Kotlin on the 1.0 DSL unless the user explicitly expands the task.

## Prerequisite

Use `expo` `57.0.21` or newer. Earlier `57.x` versions can compile the macros but lack many of the 2.0 features and performance optimizations, so do not target them. Before editing, check the target's installed version (`expo` in `package.json`/lockfile, or `npm ls expo`). If it is older, stop and tell the user to upgrade first.

Check the example app's own `package.json` too, not only the module root. The example app is the integration surface you build and launch in step 4, so it needs the same floor.

This is a floor, not a guarantee: the exact macro and core surface still varies within `57.x`, so step 2 must still verify the checked-out source.

SDK 57 ships the macros as **experimental and undocumented**, with the official beta in SDK 58. The API can still change under you. Say this to the user before a large migration, and prefer incremental mixed mode over converting a module wholesale.

## References

- Read `references/migration-map.md` before changing source. It contains the 1.0-to-2.0 mappings, semantic traps, and mixed-mode rules.
- Read `references/example.md` for a full before/after walkthrough of one module through mixed mode to a complete migration. Consult it when you need to see how the per-member rules compose.
- Read `references/compatibility.md` when the checked-out `expo-modules-core` version or branch is not known to support every requested macro. It explains how to verify the actual compile-time and runtime surface instead of guessing from a version number, and lists what the macros plugin gained through `0.10.0`.

## Workflow

### 1. Establish the contract

Inspect repository instructions and the worktree before editing. Locate the Swift module classes, records, shared objects, native views, JS/TS bindings, tests, example app, podspec, and installed or checked-out `expo-modules-core`.

Inventory every exported item before rewriting it:

- module and shared-object JS names
- function names, arity, labels, defaults, nullability, sync/async behavior, errors, and queue/thread semantics (note which `AsyncFunction` bodies do blocking or long-running work, and any `.runOnQueue(...)`)
- property names, mutability, and constant caching behavior
- event wire names and payload shapes
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

Prefer an incremental mixed-mode result over speculative generated code. Keep `definition()` for any remaining DSL elements; delete it only when it is empty and the resolved module name is preserved by `@ExpoModule`.

### 3. Apply the migration

Migrate one semantic group at a time: module naming, functions, properties/constants, events, shared objects, then records. Keep the diff narrow.

Follow these invariants:

- Preserve every existing JS-visible name explicitly when Swift naming rules or macro defaults differ.
- Keep original optional/default behavior. An optional 1.0 record field must not become required merely because 2.0 can express required fields.
- Do not migrate same-JS-name overloads unless the checked-out macro groups and dispatches them.
- Preserve async threading behavior. A 1.0 `AsyncFunction` body ran off the JS thread from its first statement; a 2.0 `async` `@JS` member starts on the JS thread and leaves it only at the first real suspension point. A body with no `await`, or with work ahead of its first `await`, therefore blocks the JS thread after a verbatim migration, with no visible change to the JS signature. Audit each migrated body for what runs before its first `await`, and never leave blocking I/O on the JS actor. `@JS(.concurrent)` (macros plugin `0.10.0`) restores the 1.0 behavior and is the preferred fix where available; otherwise restructure onto Swift Concurrency or dispatch via a continuation, per the async-function rules in `references/migration-map.md`.
- Do not migrate queue-pinned DSL functions as-is; restructure onto Swift Concurrency or dispatch to the original queue via a continuation.
- Do not migrate views, unions, or synchronous events without verified support. `@Union` and `@JS(.concurrent)` shipped in macros plugin `0.10.0`, but each needs a paired declaration in core, which has lagged the plugin on every 2.0 feature. Check the checked-out core, not the plugin version.
- Shared-object static members bind through a different core hook than instance members, and core has shipped the instance one well ahead of it. Verify before migrating one; otherwise keep `StaticFunction`/`StaticAsyncFunction` entries in the 1.0 `Class(...)` block and migrate the constructor and instance members around them.
- Keep the module's `expo-module.config.json` declarations. Automatic `@ExpoModule` discovery via the plugin's `scan-modules` command is not wired into `expo-modules-autolinking` yet, and a migrated module class must stay `public` or `open` to link from the app target.
- Free-form `Any`, `[Any]`, and `[String: Any]` work only as `@JS` argument types, and only when the checked-out core supports decoding them. They are compile errors as return types and properties. Prefer `[String: JavaScriptValue]` when the JS contract allows it.
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
   - the `expo-modules-core` version/branch checked out

   Reference the issue in the handoff so the remaining DSL entry is traceable to a known limitation.

Keep going with the groups that do migrate cleanly; one blocked member does not block the rest.

### 4. Verify behavior

Run the narrowest available checks first, then the real integration surface:

1. Build or type-check the Apple module against the target `expo-modules-core`.
2. Run native unit tests and JS/TS tests.
3. Build and launch the example app when the repository provides one.
4. Compare the final exported surface with the inventory from step 1.
5. Search for stale `Name`, migrated `Function`/`AsyncFunction`/`StaticFunction`/`StaticAsyncFunction`/`Property`/`Constant`/`Events` entries, old `sendEvent` calls, `@Field`, and duplicate registrations. Search the source you wrote, not macro expansion output.

Expansion tests alone are insufficient: generated macro code can look correct while failing to link or run against a mismatched core. If dependencies changed or macro plugin flags are missing, reinstall JS dependencies as appropriate, run the repository's CocoaPods installation workflow, and restart Xcode before diagnosing plugin communication failures.

## Handoff

Never print macro-generated or core-internal symbol names to the user. `references/compatibility.md` cites them so you can grep for them, but they are implementation details that change between plugin revisions, and they are noise in a report. Name a capability by its macro (`@JS static`, `@Event(sync:)`) and by observable JS behavior. Say "the installed core does not support decoding free-form dictionary arguments yet", not the name of the missing method. The exception is a tracking issue on `expo/expo`, where the specific missing hook is the point.

Report:

- which members moved to 2.0
- which members intentionally remain in the 1.0 DSL and why
- any compatibility-sensitive choices, especially event names, record requiredness, constants, and queues
- the commands run and any verification not completed

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-migrate-module" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
