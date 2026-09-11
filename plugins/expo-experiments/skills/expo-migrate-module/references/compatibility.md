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

A declaration proves only that Swift recognizes the attribute, not that the code the macro generates will compile and run against the installed core.

## Check paired core support

The macros plugin and core can drift independently, so a successful macro expansion does not prove the generated code links or is called at runtime.

> The symbol names in this section are macro internals, for your own verification only. Never print them in the conversation, name them in your report, or write them into the migrated module's source. Report a capability by its macro (`@JS static`, `@Event(sync:)`) and by observable JS behavior. See the reporting rule in `SKILL.md`.

**Fast pre-check.** Search core for the hooks the generated code calls, to rule out an unsupported capability before you write any Swift:

```bash
grep -rnE '_decorateModule|_decorateSharedObject|_constructSharedObject|_jsName|EventEmitter|emitSync|StaticProperty|AnyViewProps|PropsDiff|_updateViewProps|didCreate|__expo_onStartListeningToEvent|decodeAnyDictionary|decodeAnyArray|JSOptions|UnionCaseMismatch' <expo-modules-core>
```

An absent hook is strong evidence the capability is unavailable. A present one is weaker: it proves the symbol exists, not that its signature matches what the plugin generates or that core ever calls it.

**Confirm by compiling.** Write the smallest `@JS` member that uses the capability, build the module target against the checked-out core, and read the diagnostics:

- The build succeeds: the capability is supported end to end.
- The macro reports an error or warning: the plugin itself rejects the construct. The diagnostic names the supported alternative.
- Expansion succeeds but linking fails on an undefined symbol: the plugin is ahead of core. Keep the member in the 1.0 DSL.

Then exercise the member from the example app or a test, because a binding can link and still never be invoked.

## Capability gates

Treat these as independent capabilities. Confirm each by compiling a minimal member that uses it, then calling it from JS:

| Capability | Macro surface | Core hook to grep (internal) | Confirm by |
| --- | --- | --- | --- |
| Module functions/properties | `@ExpoModule`, `@JS` | `_decorateModule` and its call site | calling the function and reading the property from JS |
| Module name | `@ExpoModule("Name")` | `_jsName` and the name lookup that reads it | resolving the module under its expected JS name |
| Records | `@Record` | coding conformances and field decode/encode | round-tripping a record argument and a record return value |
| Async events | `@Event` | `EventEmitter` on modules and shared objects | receiving an emitted event through the module's JS listener |
| Shared-object instances | `@SharedObject`, `@JS` | `_decorateSharedObject(prototype:)`, construction hook | constructing one from JS and calling an instance member |
| Shared-object static members | `@JS static` | `_decorateSharedObject(constructor:)`, distinct from the `prototype:` overload | calling the member on the JS class itself, not an instance |
| Synchronous events | `@Event(sync:)` | `emitSync` overloads | observing the listener run before the emit call returns |
| Task-returning functions | `@JS` returning `Task` | `JavaScriptEncodable` for `Task` (encode-only) | awaiting the returned promise in JS |
| Views | `@ViewProps`, `@ExpoView` | `AnyViewProps`, `PropsDiff`, `_updateViewProps` | rendering the view and updating every prop from JS |
| Module lifecycle methods | lifecycle members on the module class | `AnyModule` requirements and holder call sites | observing each hook fire |
| Free-form `Any` arguments | `@JS` with `Any`, `[Any]`, `[String: Any]` | `decodeAny`, `decodeAnyArray`, `decodeAnyDictionary` | building it, then passing a JS object through |
| Off-JS-thread async start | `@JS(.concurrent)` | `JSOptions` and the options-taking `@JS` overload (plugin `0.10.0`) | the `@JS` declaration accepting an options argument |
| Typed N-case unions | `@Union` | `Union` macro declaration and `UnionCaseMismatch` (plugin `0.10.0`) | round-tripping each case through the JS boundary |
| Autolinked `@ExpoModule` discovery | none, it is a build-time step | none, `scan-modules` plus the autolinking consumer | the module loading without an `expo-module.config.json` entry |

If a capability cannot be confirmed, keep that item in the 1.0 DSL.

## Known migration hazards

Use this only as a warning list; checked-out source wins.

- Async threading changed architecturally, not just syntactically: a 2.0 `async` member starts on the JS thread and leaves it at the first suspension point, where a 1.0 `AsyncFunction` never ran there. A verbatim migration can move blocking work onto the JS thread with no signature change. `@JS(.concurrent)` (plugin `0.10.0`) restores the 1.0 behavior, but needs a paired `JSOptions` type and a second `@JS` overload in core. See the threading table in `references/migration-map.md`.
- Same-JS-name `@JS` overload grouping/dispatch was designed but not built; duplicate bindings could silently overwrite each other.
- `@Union` landed in plugin `0.10.0`, but needs the paired `Union` macro declaration and `UnionCaseMismatch` exception in core. Decoding is first-match in case-declaration order, so preserving a 1.0 `Either`'s type order is part of the contract. See the unions section in `references/migration-map.md`.
- Decode errors lacked the 1.0 argument-index wrapper. This affects diagnostics rather than call semantics, but tests asserting exact messages may fail.
- `@ViewProps` had only an initial pure-macro slice; the UIKit typed props runtime and `@ExpoView` contract were still gated on core.
- `@Event(sync: true)` macro generation existed, but core `emitSync` was still required.
- Default asynchronous `@Event` was supported after core added `EventEmitter` to modules and shared objects.
- `@JS` functions/properties, range-based arity, default/optional-aware calls, `@Record` field synthesis, async `@JavaScriptActor`, and shared-object decoration had landed in the macros work.
- Shared-object `@JS static`/`class` members bind onto the constructor object through a `constructor:`-labeled decoration hook, separate from the `prototype:` one used for instance members. The plugin has emitted this binding since `v0.7.0`, but core shipped the `prototype:` overload well ahead of it, so a static member can expand and then fail to link. Instance support does not imply static support. Keep `StaticFunction`/`StaticAsyncFunction` entries in the 1.0 `Class(...)` block until the `constructor:` overload is present.
- Async `@JS` bindings are two-phase: arguments decode synchronously before the asynchronous boundary, and return values encode on the JS thread. A 1.0 async function whose argument decoding had side effects ordered after the hop can therefore observe a different order.

## Landed in the macros plugin since 0.8.0

Free-form `Any` arguments and `scan-modules` shipped in `0.9.0`, both covered below. `@JS(.concurrent)` (see the threading section in `references/migration-map.md`) and `@Union` (see the unions section) shipped in `0.10.0`.

All four are macro-side only. The plugin generates the code, but each needs a paired declaration or runtime hook in `expo-modules-core`, and core has been the lagging half throughout. A plugin version number therefore tells you nothing about whether a feature is usable. Check the checked-out core, per the capability gates above.

### Free-form `Any` arguments in `@JS` (plugin `0.9.0`)

`Any`, `[Any]`, and `[String: Any]` are accepted as **argument** types and decode through dedicated entry points instead of the type's own `.decode`:

Free-form is decode-only, so the position where the type appears decides whether it is allowed:

- **argument** (function, constructor, setter): compiles, with a warning steering you to `[String: JavaScriptValue]`
- **return type**: compile error
- **property**: compile error, because its getter always encodes

Optional (`[String: Any]?`) and nested (`[String: [String: Any]]`) spellings are unsupported.

These bindings decode through `JavaScriptValue.decodeAny`, `decodeAnyArray`, and `decodeAnyDictionary`. Core shipped the macro side first, so where those methods are absent the member expands and then fails to link. Confirm by building one minimal free-form argument against the checked-out core before migrating any others.

Prefer `[String: JavaScriptValue]` when you can change the Swift signature without changing the JS contract. A 1.0 DSL function taking a loosely typed dictionary is often expressible that way, and it is the alternative the macro's own warning points to.

### `scan-modules` for autolinked module discovery (plugin `0.9.0`)

The scanner CLI merged into the shipped `ExpoModulesMacros-tool` binary, so one executable serves both the compiler plugin protocol (no arguments) and a CLI:

```bash
ExpoModulesMacros-tool scan-modules --platform iOS --define DEBUG ios/
```

Its JSON output is versioned and reports each detected module's access level. It evaluates `#if` conditions against `--platform` and repeatable `--define`, answers `canImport` for a curated set of Apple SDK frameworks, and prunes `node_modules` along with test and example directories (`Tests`, `UITests`, `__tests__`, `__mocks__`, `example`, `examples`, `e2e`).

The intent is that `expo-modules-autolinking` detects `@ExpoModule` classes automatically, replacing the `expo-module.config.json` module list. **The scanner shipped ahead of that consumer**, so until autolinking actually calls it, discovery is not active. Consequences for a migration:

- Keep the module's existing `expo-module.config.json` declarations, and verify they are correct before you finish. Listing every module class under `apple.modules` is a 1.0 requirement that still applies on SDK 57; 2.0 does not lift it. The entries are bare Swift class names with no compile-time link to the class, so a rename during migration silently detaches the module: it builds, and then is absent at runtime. SDK 58 adds auto-discovery, at which point these entries can be removed.
- A migrated `@ExpoModule` class must be `public` or `open` to be linkable from the app target. The scanner reports each class's access level so inaccessible ones can be skipped with a diagnostic.
- Product sources kept under a pruned directory name are invisible to the scanner. A package in that layout stays on `expo-module.config.json`, which opts it out of scanning.
- You can run `scan-modules` yourself as a migration check: it lists which classes the macro attribute is actually detected on, which catches an `@ExpoModule` that landed in a conditional block or a non-public class.

## Integration verification

Use the target project's own commands. A robust sequence is:

1. Run macro/unit tests if working inside the macros package.
2. Compile the migrated native module against the paired core checkout.
3. Re-run CocoaPods installation when plugin dependencies or injection changed.
4. Restart Xcode after swapping a macro plugin binary; cleaning DerivedData alone may not reload it.
5. Build the example app and execute existing JS/TS behavior tests.

Do not report a migration complete based only on textual expansion tests.
