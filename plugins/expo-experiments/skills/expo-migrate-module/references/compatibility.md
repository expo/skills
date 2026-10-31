# Expo Modules API 2.0 Compatibility Checks

The Expo Modules API 2.0 design and implementation evolve across three packages: the `expo-modules-macros` compiler plugin, `expo-modules-core`, and `expo-modules-jsi`. Verify the installed dependencies instead of relying on an SDK-number claim.

## Find the actual declarations

Locate `ExpoModulesMacros.swift` in the target repository or installed dependencies (use your search tool, or portable shell commands - do not assume `rg` is installed):

```bash
find . -name 'ExpoModulesMacros.swift' -not -path '*/node_modules/.cache/*'
```

Inspect the macros that the user's source can import, and the options that `@JS` accepts:

```bash
grep -nE 'public macro (ExpoModule|JS|Event|SharedObject|Record|Union|ViewProps|ExpoView)' <path-to-ExpoModulesMacros.swift>
grep -nE '^  case ' <path-to-ExpoModulesMacros.swift>
```

In `expo` `58.0.22`, core declares `@ExpoModule`, `@JS`, `@Event`, `@SharedObject`, `@Record`, and `@Union`, and the `@JS` options `.concurrent` and `.withAsync`. It does not declare `@ViewProps` or `@ExpoView`. The plugin implements both, but source cannot use them until core declares them.

A declaration proves only that Swift recognizes the attribute, not that the code the macro generates will compile and run against the installed core.

## Check paired core support

The three packages can drift independently, so a successful macro expansion does not prove the generated code links or is called at runtime. The binding hooks live in `expo-modules-core`. The value conversions, including free-form `Any`, `Task`, and closure callbacks, live in `expo-modules-jsi`. Search both.

> The symbol names in this section are macro internals, for your own verification only. Never print them in the conversation, name them in your report, or write them into the migrated module's source. Report a capability by its macro (`@JS static`, `@Event(sync:)`) and by observable JS behavior. See the reporting rule in `SKILL.md`.

**Fast pre-check.** Search core and JSI for the hooks the generated code calls, to rule out an unsupported capability before you write any Swift:

```bash
grep -rnE '_decorateModule|_decorateSharedObject|_constructSharedObject|_jsName|EventEmitter|emitSync|didCreate|decodeAnyDictionary|encodeAny|extension Task: JavaScriptEncodable|JavaScriptCallback|JSOptions|withAsync|UnionCaseMismatch' <expo-modules-core> <expo-modules-jsi>
```

An absent hook is strong evidence the capability is unavailable. A present one is weaker: it proves the symbol exists, not that its signature matches what the plugin generates or that core ever calls it.

**Confirm by compiling.** Write the smallest `@JS` member that uses the capability. Run the `expand` diagnostics check in "Inspect the generated code" to see the macro's own errors without a build. Then build the module target against the installed core and read the diagnostics:

- The build succeeds: the capability is supported end to end.
- The macro reports an error or warning: the plugin itself rejects the construct. The diagnostic names the supported alternative.
- Expansion succeeds but the build fails on a missing symbol or an override with nothing to override: the plugin is ahead of core. Keep the member in the 1.0 DSL.

Then exercise the member from the example app or a test, because a binding can link and still never be invoked.

## Capability gates

Treat these as independent capabilities. Confirm each by compiling a minimal member that uses it, then calling it from JS. The SDK 58 column records what `expo` `58.0.22` provides. Use it to decide where to look first, not in place of the checks.

| Capability | Macro surface | Hook to grep (internal) | SDK 58 | Confirm by |
| --- | --- | --- | --- | --- |
| Module functions/properties | `@ExpoModule`, `@JS` | `_decorateModule` and its call site | yes | calling the function and reading the property from JS |
| Module name | `@ExpoModule("Name")` | `_jsName` and the name lookup that reads it | yes, but a `Name(...)` entry wins over it | resolving the module under its expected JS name |
| Records | `@Record` | coding conformances and field decode/encode | yes, on a struct or a `final class` with no inheritance clause | round-tripping a record argument and a record return value |
| Async events | `@Event` | `EventEmitter` on modules and shared objects | yes | receiving an emitted event through the module's JS listener |
| Shared-object instances | `@SharedObject`, `@JS` | `_decorateSharedObject(prototype:)`, construction hook | yes | constructing one from JS and calling an instance member |
| Shared-object static members | `@JS static` | `_decorateSharedObject(constructor:)`, distinct from the `prototype:` overload | yes, from `expo` `58.0.19` | calling the member on the JS class itself, not an instance |
| Shared-object subclasses | `@SharedObject` on a `SharedRef<T>` subclass or another indirect subclass | none, the compiler checks the superclass | yes, from `expo` `58.0.20` | constructing one from JS and calling a member |
| Lazy properties | `@JS lazy var` | none, the macro binds a getter that stores the value | yes, from `expo` `58.0.20` | reading the property twice from JS and seeing one native evaluation |
| Tuples | tuples in `@JS`, `@Record`, `@Union`, `@Event`, and closure arguments | `decodeTuple` and `encodeTuple` in JSI | yes, from `expo` `58.0.21` | round-tripping an unlabeled tuple as an array and a labeled one as an object |
| Synchronous events | `@Event(sync:)` | `emitSync` overloads | **no**, core and JSI have no `emitSync` | observing the listener run before the emit call returns |
| Task-returning functions | `@JS` returning `Task` | `JavaScriptEncodable` for `Task` in JSI (encode-only) | yes | awaiting the returned promise in JS |
| Views | `@ViewProps`, `@ExpoView` | the macro declarations in `ExpoModulesMacros.swift` | **no**, core does not declare them | rendering the view and updating every prop from JS |
| Module lifecycle methods | lifecycle members on the module class | `AnyModule` requirements and holder call sites | yes | observing each hook fire |
| Free-form `Any` | `@JS` and `@Record` with `Any`, `[Any]`, `[String: Any]` | `decodeAny…` and `encodeAny…` in JSI | yes | passing a JS object through and back |
| Closure arguments | `@JS` with a function-typed parameter | `JavaScriptCallback` in JSI | yes | calling the closure from native code and reading the JS result |
| Off-JS-thread async start | `@JS(.concurrent)` | `JSOptions` and the options-taking `@JS` overload | yes | the `@JS` declaration accepting the option |
| Promise variant of a sync function | `@JS("nameSync", .withAsync("name"))` | `withAsync` in `JSOptions` | yes, from `expo` `58.0.17` | calling both JS names |
| Typed N-case unions | `@Union` | `Union` macro declaration and `UnionCaseMismatch` | yes | round-tripping each case through the JS boundary |
| Autolinked `@ExpoModule` discovery | none, it is a build-time step | `scanModules` in `expo-modules-autolinking` | yes, from `expo` `58.0.8` | the module loading without an `apple.modules` list |

If a capability cannot be confirmed, keep that item in the 1.0 DSL.

## Known migration hazards

Use this only as a warning list; installed source wins.

- Async threading changed architecturally, not just syntactically: a 2.0 `async` member starts on the JS thread and leaves it at the first suspension point, where a 1.0 `AsyncFunction` never ran there. A verbatim migration can move blocking work onto the JS thread with no signature change. `@JS(.concurrent)` restores the 1.0 behavior. In Swift 6 language mode, `.concurrent` and `.withAsync` need the module or shared object to be `Sendable`. See the threading table in `references/migration-map.md`.
- Same-JS-name `@JS` overload grouping and dispatch were designed but never built. `expo` `58.0.15` and newer report two `@JS` members with one JS name on one object as a build error. Older releases installed one binding per declaration, so the last one silently won. A shared object's static and instance members bind onto different JS objects, so they can share a name.
- `@Union` decoding is first-match in case-declaration order, so preserving a 1.0 `Either`'s type order is part of the contract. See the unions section in `references/migration-map.md`.
- Decode errors lacked the 1.0 argument-index wrapper. This affects diagnostics rather than call semantics, but tests asserting exact messages may fail.
- The plugin in SDK 58 implements `@ViewProps` and `@ExpoView`, but core does not declare either macro and has no typed view-props runtime. Views stay on the 1.0 DSL.
- `@Event(sync: true)` macro generation exists, but SDK 58 core and JSI have no `emitSync`.
- Shared-object `@JS static`/`class` members bind onto the JS class object through a `constructor:`-labeled decoration hook, separate from the `prototype:` one used for instance members. Core has the `constructor:` hook from `expo` `58.0.19`. Instance support does not imply static support, so confirm a static member by calling it on the JS class.
- Async `@JS` bindings are two-phase: arguments decode synchronously before the asynchronous boundary, and return values encode on the JS thread. A 1.0 async function whose argument decoding had side effects ordered after the hop can therefore observe a different order.
- Starting with `expo` `58.0.8`, `JavaScriptValue` is a non-copyable struct, and DSL `Function`, `AsyncFunction`, `Property`, and `Field` no longer accept it in their signatures. A DSL member that takes or returns a `JavaScriptValue` no longer compiles. Migrate it to `@JS` and take the value as `borrowing JavaScriptValue`. To keep the value after the call returns, store `value.ref()` and read it back with `take()` or `withUnwrappedValue(_:)`. Write `.undefined()` and `.null()`, which are functions now.
- Core reads the `@ExpoModule` name only when the module has no `Name(...)` entry. In mixed mode a leftover `Name(...)` wins, so a mismatch between the two names is silent.
- A no-payload `@Event` (`() -> Void`) sends `undefined`. A 1.0 `sendEvent("name")` without a body sent `{}`.
- `OnAppContextDestroys`, `OnAppEntersForeground`, `OnAppEntersBackground`, and `OnAppBecomesActive` have no 2.0 hook. They stay in `definition()`.

## Macro changes in SDK 58 that affect a migration

Each item below shows the first `expo` release that has it. Under the `expo` `58.0.21` floor in `SKILL.md`, all of them are present.

### Free-form `Any` (`expo` `58.0.8`)

`Any`, `[Any]`, and `[String: Any]` are accepted as `@JS` arguments, return values, and properties, and as `@Record` fields. One optional layer (`[String: Any]?`) also works, and so do nested types built from `Any`, arrays, `String`-keyed dictionaries, and optionals (`[String: [Any]]`). They convert through dedicated free-form methods in JSI, not through `JavaScriptDecodable`/`JavaScriptEncodable`.

A 1.0 DSL member with a loosely typed dictionary can therefore keep its Swift signature. Prefer a typed `@Record` only when the user asks for an API-shape change.

### Closure arguments (`expo` `58.0.8`)

A `@JS` function or initializer can take a closure parameter, such as `(Point) throws -> Size` or `(String) async throws -> Data`. JS passes a function for it. Native code can store the closure and call it from any thread.

- A closure that returns a value must be `throws`, so that an error from JS can reach the caller.
- A throwing or value-returning closure blocks the caller until JS returns. An `async` closure suspends instead and awaits the promise that the JS function returns.
- A non-throwing `Void` closure returns before JS reads its arguments, so do not change a class instance after passing it to one.
- An optional closure (`((Int) -> Void)?`) turns JS `null` and `undefined` into `nil`.
- A closure nested in another type, such as an array, is not a closure parameter.
- The closure type accepts only the `@escaping` and `@Sendable` attributes. Its parameters cannot be variadic, `inout`, closures, or free-form `Any`, and it cannot use typed throws.
- A `@JS` function cannot return a closure, and a `@JS` property cannot have a closure type.

### Parameters and names (`expo` `58.0.8`)

- `inout` and `isolated` parameters are build errors, because a `@JS` argument is a fresh value decoded from JS. `borrowing`, `consuming`, and `sending` parameters are accepted.
- A backticked Swift name binds under its bare name: ``@JS func `default`()`` is `default` in JS.

### `.withAsync` (`expo` `58.0.17`)

`@JS("readSync", .withAsync("read"))` binds a synchronous function under its own JS name, and binds it again under the given name as a function that returns a promise and runs the body on the concurrent thread pool. See the threading section in `references/migration-map.md`. The macro rejects it on an `async` function, a property, or an initializer, and on a function isolated to a global actor.

### Records (`expo` `58.0.15` and `58.0.17`)

Starting with `expo` `58.0.15`, `@Record` types convert without an app context. Starting with `expo` `58.0.17`, a `@Record` class must be `final` and have no inheritance clause, or the build fails; declare its protocol conformances in an extension. A 1.0 `class Options: Record` therefore becomes `@Record final class Options`, or a struct.

### Static members on shared objects (`expo` `58.0.19`)

`static` and `class` `@JS` members of a `@SharedObject` class bind onto the JS class itself, so JS calls them as `Cache.open(name)`. A 1.0 `StaticFunction` or `StaticAsyncFunction` migrates to one. See the static members section in `references/migration-map.md`.

### `lazy` properties and shared-object subclasses (`expo` `58.0.20`)

- A `@JS lazy var` is read-only from JS. Its first read stores the value as a data property on the JS object, so later reads do not call native code. On a frozen JS object the value is not stored, and each read calls the getter. This is the closest mapping for a 1.0 `Constant`.
- `@SharedObject` accepts a `SharedRef<T>` subclass and any other indirect `SharedObject` subclass. The compiler, not the macro, reports a class that is not a `SharedObject` subclass. Each `@SharedObject` class exposes only the `@JS` members that it declares. That matches 1.0, where a `Class(...)` block could not inherit from another.

### Tuples (`expo` `58.0.21`)

A tuple can cross the boundary as a `@JS` argument, result, or property, a `@Record` property, a `@Union` or `@Event` payload, or a parameter or result of a closure argument that is not `async`.

- An unlabeled tuple such as `(Int, String)` converts to an array with one value per element. A labeled tuple such as `(x: Double, y: Double)` converts to an object with one property per label.
- A tuple must have two or more elements, all labeled or none, and each element must be convertible. Tuples nest in other tuples, optionals, arrays, and `String`-keyed dictionaries.
- A type alias of a tuple, such as `typealias Span = (start: Int, end: Int)`, resolves only when the `@ExpoModule` or `@SharedObject` class body declares it.

### Package and binary names (SDK 58)

The package is `expo-modules-macros`, formerly `@expo/expo-modules-macros-plugin`, and the executable is `ExpoModulesMacros`, formerly `ExpoModulesMacros-tool`. `pod install` adds `-load-plugin-executable <plugin>/apple/ExpoModulesMacros#ExpoModulesMacros` to `OTHER_SWIFT_FLAGS`. Look for that flag when the compiler cannot find the macro implementation.

## Autolinked module discovery

Starting with `expo` `58.0.8`, autolinking scans the package sources for `@ExpoModule` classes when it generates the modules provider. The rules that matter for a migration:

- When `expo-module.config.json` has an `apple.modules` list, even an empty one, autolinking uses only that list and ignores the scan.
- Without the list, it links every scanned class that is `public` or `open` and compiles for the target platform. An `internal` class gets a warning, and a lower access level opts the class out silently.
- A class inside an `#if` condition that the scanner cannot evaluate statically, such as `#if DEBUG` or `canImport(...)`, is skipped with a warning. List such a class in `apple.modules`.
- The scan skips `Tests`, `UITests`, `__tests__`, `__mocks__`, `example`, `examples`, `e2e`, `Pods`, `node_modules`, `.build`, and `.git` directories. A module class kept under one of those names needs the list.
- The scan finds only classes with the `@ExpoModule` attribute. A package that still has a module on the 1.0 DSL alone needs the list.

Run the scanners yourself as migration checks. Run them where `expo-modules-core` resolves, such as the module root or its example app, and pass the module's iOS source directory:

```bash
node -e "const m = require(require.resolve('expo-modules-macros', { paths: [require.resolve('expo-modules-core/package.json')] })); m.scanModules(['ios']).then((r) => console.log(JSON.stringify(r, null, 2)))"
```

`scanModules` reports each detected class with its Swift `name`, `jsName`, `accessLevel`, and `platforms`, plus `warnings`. It catches an `@ExpoModule` that landed in a conditional block or on a non-public class.

```bash
node -e "const m = require(require.resolve('expo-modules-macros', { paths: [require.resolve('expo-modules-core/package.json')] })); m.scanExports(['ios']).then((r) => console.log(JSON.stringify(r.exports, null, 2)))"
```

`scanExports` reports the macro-declared surface: `modules`, `sharedObjects`, `records`, `unions`, and `enums`. Each module lists its `functions` (with `jsName`, `parameters`, `async`, `throws`, and `static`), `properties` (with `readonly`), `events` (with `jsName`, `payload`, and `sync`), and `classes`. Compare it against the inventory from step 1. It does not report members that stay in the DSL.

## Inspect the generated code

From `expo` `58.0.21`, the `expand` command of `expo-modules-macros` runs the macros on Swift files without a build. It prints the expanded source, and it reports macro errors and warnings in the compiler's `<file>:<line>:<column>: error: <message>` format. Run it where `expo-modules-core` resolves, as with the scanners:

```bash
EXPO_MACROS="$(node -p "require(require.resolve('expo-modules-macros', { paths: [require.resolve('expo-modules-core/package.json')] })).getScannerBinaryPath()")"

# Only the diagnostics. The exit code is 1 when there is an error.
"$EXPO_MACROS" expand --diagnostics-only ios

# The code generated for one type or one member.
"$EXPO_MACROS" expand --symbol MyModule.load ios/MyModule.swift
```

A directory is walked like the scans walk it, and only the files that use a macro are expanded. `expandMacros(paths, { symbols, diagnosticsOnly })` in the same package returns the same result as JSON.

Use `expand` to find a macro error fast, or to see why a binding does not behave as expected. Do not copy its output into the module source, and do not quote it to the user: it consists of the internal symbols that the handoff rule in `SKILL.md` keeps out of reports. `expand` runs only the macros, so code with no diagnostics can still fail to build or link against the installed core.

## Integration verification

Use the target project's own commands. A robust sequence is:

1. Run macro/unit tests if working inside the macros package.
2. Run `expand --diagnostics-only` on the module's iOS sources.
3. Compile the migrated native module against the installed core.
4. Re-run CocoaPods installation when plugin dependencies or injection changed.
5. Restart Xcode after swapping a macro plugin binary; cleaning DerivedData alone may not reload it.
6. Build the example app and execute existing JS/TS behavior tests.

Do not report a migration complete based only on `expand` output or textual expansion tests.
