# Expo Modules API 2.0 Compatibility Checks

The Expo Modules API 2.0 design and implementation evolve across the macros plugin and `expo-modules-core`. Verify the checked-out dependency instead of relying on an SDK-number claim.

## Find the actual declarations

Locate `ExpoModulesMacros.swift` in the target repository or installed dependencies (use your search tool, or portable shell commands - do not assume `rg` is installed):

```bash
find . -name 'ExpoModulesMacros.swift' -not -path '*/node_modules/.cache/*'
```

Inspect the declarations that the user's source can import:

```bash
grep -nE 'public macro (ExpoModule|JS|Event|SharedObject|Record|Union|ViewProps|ExpoView)' <path-to-ExpoModulesMacros.swift>
```

A declaration proves only that Swift recognizes the attribute. Also inspect the corresponding macro implementation and core runtime hooks.

## Check paired core support

Search the actual core source for the feature being migrated:

```bash
grep -rnE '_decorateModule|_decorateSharedObject|_constructSharedObject|_jsName|EventEmitter|emitSync|StaticProperty|AnyViewProps|PropsDiff|_updateViewProps|didCreate|__expo_onStartListeningToEvent' <expo-modules-core>
```

Use compile errors and symbol call sites to confirm signatures. The macros plugin and core can drift independently; a successful macro expansion does not prove the generated code compiles or is called at runtime.

## Capability gates

Treat these as independent capabilities:

| Capability | Evidence required before migration |
| --- | --- |
| Module functions/properties | `@ExpoModule`/`@JS`, generated `_decorateModule`, and the core call site |
| Module name | generated `_jsName` and core registration/name lookup that reads it |
| Records | `@Record`, coding conformance/assertions, and field decode/encode support |
| Async events | `@Event`, `EventEmitter`, and `BaseModule`/`SharedObject` conformance |
| Shared-object instances | `_decorateSharedObject`, construction hook, and core invocation |
| Shared-object static functions | constructor object passed to decoration and static function routing |
| Synchronous events | `@Event(sync:)` plus core `emitSync` overloads |
| Task-returning functions | `JavaScriptEncodable` conformance for `Task` in core (encode-only) |
| Views | `@ViewProps`/`@ExpoView` plus the complete typed props update and event runtime |
| Module lifecycle methods | `AnyModule` requirements/base implementations and holder call sites |

If any required evidence is absent, keep that item in the 1.0 DSL.

## Known migration hazards in the July 2026 plan

Use this only as a warning list; checked-out source wins.

- Same-JS-name `@JS` overload grouping/dispatch was designed but not built; duplicate bindings could silently overwrite each other.
- `@Union` was not built.
- Decode errors lacked the 1.0 argument-index wrapper. This affects diagnostics rather than call semantics, but tests asserting exact messages may fail.
- `@ViewProps` had only an initial pure-macro slice; the UIKit typed props runtime and `@ExpoView` contract were still gated on core.
- Shared-object instance functions, properties, setters, construction, and static properties were implemented; verify constructor-side routing before migrating static functions.
- `@Event(sync: true)` macro generation existed, but core `emitSync` was still required.
- Default asynchronous `@Event` was supported after core added `EventEmitter` to modules and shared objects.
- `@JS` functions/properties, range-based arity, default/optional-aware calls, `@Record` field synthesis, async `@JavaScriptActor`, and instance shared-object decoration had landed in the macros work.

## Integration verification

Use the target project's own commands. A robust sequence is:

1. Run macro/unit tests if working inside the macros package.
2. Compile the migrated native module against the paired core checkout.
3. Re-run CocoaPods installation when plugin dependencies or injection changed.
4. Restart Xcode after swapping a macro plugin binary; cleaning DerivedData alone may not reload it.
5. Build the example app and execute existing JS/TS behavior tests.

Do not report a migration complete based only on textual expansion tests.
