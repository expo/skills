---
name: expo-migrate-module
description: Framework (OSS). Migrate an existing Apple/Swift Expo native module from the Expo Modules API 1.0 definition DSL to the 2.0 macro API (sometimes called v2) while preserving its JavaScript and TypeScript contract. Use when converting or incrementally adopting @ExpoModule, @JS, @Event, @SharedObject, or @Record in an existing module. Do not use for creating a new module, general Expo SDK upgrades, or Android/Kotlin migrations.
version: 1.0.0
license: MIT
---

# Migrate an Expo Module

Migrate the Swift side of an existing Expo module without changing its observable JS API. Treat the current JS/TypeScript surface and tests as the compatibility contract. Leave Kotlin on the 1.0 DSL unless the user explicitly expands the task.

## Prerequisite

The Expo Modules API 2.0 macros require `expo` `57.0.7` or newer. Before editing, check the target's installed version (`expo` in `package.json`/lockfile, or `npm ls expo`). If it is older, stop and tell the user to upgrade first; do not attempt the migration against an unsupported version. This is a floor, not a guarantee: the exact macro and core surface still varies within `57.x`, so step 2 must still verify the checked-out source.

## References

- Read `references/migration-map.md` before changing source. It contains the 1.0-to-2.0 mappings, semantic traps, and mixed-mode rules.
- Read `references/example.md` for a full before/after walkthrough of one module through mixed mode to a complete migration. Consult it when you need to see how the per-member rules compose.
- Read `references/compatibility.md` when the checked-out `expo-modules-core` version or branch is not known to support every requested macro. It explains how to verify the actual compile-time and runtime surface instead of guessing from an SDK number.

## Workflow

### 1. Establish the contract

Inspect repository instructions and the worktree before editing. Locate the Swift module classes, records, shared objects, native views, JS/TS bindings, tests, example app, podspec, and installed or checked-out `expo-modules-core`.

Inventory every exported item before rewriting it:

- module and shared-object JS names
- function names, arity, labels, defaults, nullability, sync/async behavior, errors, and queue semantics
- property names, mutability, and constant caching behavior
- event wire names and payload shapes
- record field names, defaults, requiredness, and nullability
- shared-object constructors and instance/static placement
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
- Do not migrate queue-pinned DSL functions as-is; restructure onto Swift Concurrency or dispatch to the original queue via a continuation, per the async-function rules in `references/migration-map.md`.
- Do not migrate views, unions, synchronous events, or shared-object static functions without verified support.
- Do not change Kotlin, JS wrappers, or public `.d.ts` files unless the user requested an API change.

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
5. Search for stale `Name`, migrated `Function`/`Property`/`Constant`/`Events` entries, old `sendEvent` calls, `@Field`, and duplicate registrations.

Expansion tests alone are insufficient: generated macro code can look correct while failing against mismatched core symbols. If dependencies changed or macro plugin flags are missing, reinstall JS dependencies as appropriate, run the repository's CocoaPods installation workflow, and restart Xcode before diagnosing plugin communication failures.

## Handoff

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
