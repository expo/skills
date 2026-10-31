# 1.0 to 2.0 Migration Map

Use this reference while editing. Preserve behavior first; macro adoption is secondary.

## Module and naming

Convert the module class, carry the name into `@ExpoModule("...")`, and remove `Name(...)`:

```swift
// 1.0
public final class CameraModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Camera")
  }
}

// 2.0
@ExpoModule("Camera")
public final class CameraModule: Module {}
```

Always carry a custom 1.0 name into `@ExpoModule("...")`. Without an argument, the name defaults to the Swift class name. Core reads the `@ExpoModule` name only when `definition()` has no `Name(...)` entry, so a stale `Name(...)` silently wins in mixed mode. Remove it, then verify that the module still resolves under its expected JS name.

Keep the `Module` superclass. `@ExpoModule` also works on a class without one, but removing it is not part of a migration: `sendEvent` and the overridable lifecycle hooks come from it.

## Functions

Move a DSL closure into a real method and use `@JS("wireName")` when the Swift method name is different:

```swift
// 1.0
Function("sum") { (a: Double, b: Double) -> Double in
  return a + b
}

// 2.0
@JS("sum")
func add(a: Double, b: Double) -> Double {
  return a + b
}
```

Preserve:

- the JS name
- positional arity
- optional arguments and Swift defaults
- thrown errors and return type
- whether the result is synchronous or a Promise

Keep functions that resolve to the same JS name on the DSL. The plugin has no overload grouping. It reports two `@JS` members with one JS name on one object as a build error, so leave the overloads in `definition()` as they are.

Keep in DSL any unsupported signature such as variadics or unresolved generics. `inout` and `isolated` parameters are build errors. A `Promise` parameter is also unsupported; refactor it as described under Async functions.

These argument types work in a `@JS` signature on SDK 58:

- **Free-form values.** `Any`, `[Any]`, and `[String: Any]`, optional or nested, are accepted as arguments, return values, and properties. A 1.0 `[String: Any]` argument keeps its Swift type.
- **Closures.** A function-typed parameter receives the JS function. A closure that returns a value must be `throws`, and it blocks the caller until JS returns. A `@JS` function cannot return a closure. See `references/compatibility.md` for the rules.
- **Tuples.** From `expo` `58.0.21`, an unlabeled tuple such as `(Int, String)` converts to a JS array, and a labeled tuple such as `(x: Double, y: Double)` to a JS object. Replacing a 1.0 array or dictionary type with a tuple changes the Swift API, so do it only when the user asks.
- **`JavaScriptValue`.** Take it as `borrowing JavaScriptValue`. On SDK 58 the DSL no longer accepts `JavaScriptValue` arguments or results, so such a member must migrate.

```swift
// 1.0, no longer compiles on SDK 58
Function("isFunction") { (value: JavaScriptValue) -> Bool in
  return value.isFunction()
}

// 2.0
@JS
func isFunction(_ value: borrowing JavaScriptValue) -> Bool {
  return value.isFunction()
}
```

### Async functions

A `Promise` parameter is not supported in a `@JS` signature; 2.0 drops the trailing-`Promise` argument entirely. A Promise-returning function has three shapes in 2.0. Pick by how the underlying work produces its result.

**1. Standard `async` method.** The common case. Swift `async` maps to a JS Promise:

```swift
// 1.0
AsyncFunction("load") { (url: URL) -> String in
  return try loadSynchronously(url)
}

// 2.0
@JS
func load(url: URL) async throws -> String {
  return try await loadResource(url)
}
```

**2. Checked continuation.** When the result arrives through a delegate or completion handler that fires once, wrap it with `withCheckedThrowingContinuation` (or `withCheckedContinuation` for non-throwing callbacks, or an `AsyncStream` for repeated values). This is the usual refactor for a 1.0 `AsyncFunction` that took a trailing `Promise` instance:

```swift
// 1.0
AsyncFunction("start") { (promise: Promise) in
  scanner.start(
    onSuccess: { result in promise.resolve(result) },
    onFailure: { error in promise.reject(error) }
  )
}

// 2.0
@JS
func start() async throws -> ScanResult {
  return try await withCheckedThrowingContinuation { continuation in
    scanner.start(
      onSuccess: { result in continuation.resume(returning: result) },
      onFailure: { error in continuation.resume(throwing: error) }
    )
  }
}
```

Resume the continuation exactly once on every path. If the callback API cannot guarantee that, or the refactor is otherwise unsafe, keep the function on the DSL instead of forcing it.

**3. Synchronous method returning a `Task`.** The `Task` encodes to a promise that settles with its result. Use it when the work is naturally a `Task`, or when a promise is needed as a value nested inside another encoded result rather than as the function's own return:

```swift
// 2.0
@JS
func download(url: URL) -> Task<DownloadResult, any Error> {
  return Task {
    try await self.downloader.download(url)
  }
}
```

This shape requires the `JavaScriptEncodable` conformance for `Task`, which `expo-modules-jsi` provides on SDK 58 (encode-only; a JS promise does not decode back into a `Task`).

#### Threading: the architectural difference

This is the highest-risk part of an async migration, because the code compiles and the JS signature is unchanged while the work moves onto a different thread.

The two versions schedule async work from opposite starting points:

| | 1.0 `AsyncFunction` | 2.0 `async` `@JS` |
| --- | --- | --- |
| Where the body starts | off the JS thread, from the first statement | on the JS thread |
| When it leaves the JS thread | never runs there | at the first real suspension point |
| A body with no `await` | still runs off the JS thread | runs entirely on the JS thread |

A 2.0 async member is `@JavaScriptActor`-isolated and stays on the JS thread until it actually suspends. So the dangerous case is a function marked `async` whose body never awaits anything, or awaits only after doing substantial work. In 1.0 that body was off the JS thread from the start; migrated verbatim to 2.0, it now blocks the JS thread for its full duration. Nothing in the JS contract reveals this: the function still returns a promise.

Audit every `AsyncFunction` you migrate for what the body does before its first `await`:

- No `await` at all, or synchronous work ahead of the first `await`: the work is on the JS thread. Treat it as a regression unless the body is trivial.
- Blocking I/O, file or database access, image or crypto work, or an unbounded loop: never leave this on the JS actor.
- `.runOnQueue(...)` in 1.0: the queue was the contract. See the continuation pattern below.

To restore the 1.0 behavior, use the `@JS` macro's `.concurrent` option:

```swift
// Body runs off the JS thread, like a 1.0 AsyncFunction.
@JS(.concurrent)
func process(input: String) async throws -> String {
  return try self.processor.process(input)
}

// The option is variadic, so it combines with an explicit JS name.
@JS("doWork", .concurrent)
func performWork() async throws {}
```

Only the body moves. Arguments are still decoded on the JS thread and the result is still encoded back on it, so `.concurrent` changes execution, not the JS contract. This makes it the preferred fix for a migrated function that relied on 1.0 background execution: the intent is explicit and the body stays as written.

Three constraints:

- `.concurrent` is valid only on an `async` function. On anything else it is diagnosed on the `@JS` attribute.
- You must still write `async` yourself. The macro cannot add it, but the diagnostic for a synchronous function carries a fix-it that inserts it.
- The call sends the module or shared object off the JS thread, so in Swift 6 language mode the class must be `Sendable`. Make the class `Sendable` when its state allows it. Otherwise ask the user before declaring `@unchecked Sendable`, and state in a comment what guards the mutable state.

#### Sync and async pairs

1.0 modules often register one body twice: a `Function` for synchronous calls and an `AsyncFunction` that runs the same work off the JS thread. Merge the pair with `.withAsync`, which binds the function under its own JS name and again under the given name as a promise-returning variant that runs on the concurrent thread pool:

```swift
// 1.0
Function("readSync") { (path: String) throws -> String in
  return try self.readFile(path)
}
AsyncFunction("read") { (path: String) throws -> String in
  return try self.readFile(path)
}

// 2.0
@JS("readSync", .withAsync("read"))
func readSync(path: String) throws -> String {
  return try readFile(path)
}
```

Constraints:

- The function must be synchronous. On an `async` function the macro rejects the option and points to `.concurrent`.
- The name must be a string literal, and the option can appear only once.
- The variant is not isolated to the JS thread, so the body must be safe on any thread. A function isolated to a global actor such as `@MainActor` is rejected; mark it `nonisolated` when its isolation comes from elsewhere.
- In Swift 6 language mode the class must be `Sendable`, as with `.concurrent`.
- `.withAsync` needs `expo` `58.0.17` or newer.

#### Queue-pinned functions

For `.runOnQueue(.main)`, mark the `async` function `@MainActor`. The macro then does not isolate it to the JS thread, and the body runs on the main actor. `expo-haptics` migrated this way in SDK 58:

```swift
// 1.0
AsyncFunction("selectionAsync") {
  UISelectionFeedbackGenerator().selectionChanged()
}
.runOnQueue(.main)

// 2.0
@JS
@MainActor
func selectionAsync() async {
  UISelectionFeedbackGenerator().selectionChanged()
}
```

For a function pinned to any other queue, prefer restructuring the work onto the Swift Concurrency model (structured concurrency, an actor, or a detached task for blocking work). When that is not feasible because the queue itself is the contract, for example a library that must be called from one serial queue, convert to an `async` method that dispatches to that queue inside a checked continuation:

```swift
// 1.0
AsyncFunction("process") { (input: String) -> String in
  return try self.processor.process(input)
}
.runOnQueue(processingQueue)

// 2.0
@JS
func process(input: String) async throws -> String {
  return try await withCheckedThrowingContinuation { continuation in
    processingQueue.async {
      do {
        continuation.resume(returning: try self.processor.process(input))
      } catch {
        continuation.resume(throwing: error)
      }
    }
  }
}
```

## Properties and constants

Map a getter to a getter-only `@JS var`; map a getter/setter pair to a settable stored or computed `@JS var`:

```swift
// 1.0
Property("volume") { self.volume }
  .set { self.volume = $0 }

// 2.0
@JS
var volume: Double = 1
```

Access control does not define JS mutability. Verify whether the declaration is syntactically settable; a stored `var` normally produces a JS setter.

Map a 1.0 `Constant` to a `@JS lazy var`. A 1.0 `Constant` runs its closure at the first read and caches the result. A `lazy` `@JS` property does the same: it is read-only from JS, and its first read stores the value as a data property on the JS object, so later reads do not call native code.

```swift
// 1.0
Constant("buildInfo") { computeBuildInfo() }

// 2.0
@JS
lazy var buildInfo = computeBuildInfo()
```

A `@JS let` also produces a read-only JS property, but it initializes with the module instance. Use it only for a cheap value whose evaluation time does not matter, such as a literal:

```swift
@JS
let apiVersion = 3
```

Do not map a 1.0 `Property` getter to a `lazy var`. A `Property` getter runs on every read, so a `lazy var` would freeze its first value. `lazy` `@JS` properties need `expo` `58.0.20` or newer.

## Events

Replace `Events(...)` plus `sendEvent(...)` with a typed function property:

```swift
@Record
struct ProgressEvent {
  var percent: Double
}

// Explicit string preserves the old wire name.
@Event("onProgress")
var onProgress: (ProgressEvent) -> Void

func report(percent: Double) {
  onProgress(ProgressEvent(percent: percent))
}
```

The default `@Event` wire name strips a leading `on` and decapitalizes the remainder: Swift `onProgress` emits `progress`. 1.0 modules commonly expose `onProgress`. During migration, pass the original wire name explicitly unless an intentional JS breaking change was approved.

For payloads, create or reuse a `JavaScriptEncodable` type instead of preserving an untyped dictionary. Migrate `OnStartObserving` and `OnStopObserving` to the `didStartListening(event:)`/`didStopListening(event:)` lifecycle hooks (see Views and lifecycle).

A `() -> Void` event sends `undefined` to the listener. A 1.0 `sendEvent("name")` without a body sent `{}`, so a listener that reads a field of its argument throws after a verbatim migration. Check the JS listeners. When any of them reads the argument, keep an object payload with an empty record:

```swift
@Record
struct ReadyEvent {}

@Event("onReady")
var onReady: (ReadyEvent) -> Void

// Sends {} as before.
onReady(ReadyEvent())
```

Use `() -> Void` only when no listener reads the argument, or when the user approves the change.

Default `@Event` dispatch schedules onto the JS thread and is callable from other isolation contexts. Do not use `sync: true`: SDK 58 core has no `emitSync`, so a synchronous event does not build.

## Shared objects

Move instance behavior from a `Class(...)` block onto the `SharedObject` subclass:

```swift
// 2.0
@SharedObject
final class Download: SharedObject {
  @JS
  init(url: URL) {
    self.url = url
  }

  @JS
  func pause() {}

  @JS
  var progress: Double { currentProgress }
}

@ExpoModule(classes: [Download.self])
final class DownloadModule: Module {}
```

Drop the leading owner argument used by instance DSL closures; use `self` in the real instance method. Preserve constructor arity and JS member names.

`@SharedObject` accepts any direct or indirect `SharedObject` subclass. That includes a `SharedRef<T>` subclass, such as `final class AudioPlayer: SharedRef<AVPlayer>`, from `expo` `58.0.20`. Keep the superclass as it is.

The 1.0 DSL has no inheritance between JS classes: each `Class(...)` block exposes only its own entries. A `@SharedObject` class likewise exposes only the `@JS` members that it declares, so put the members of each JS class on that class.

SDK 58 core supplies the decoration and construction hooks for instance members, static members, and the `@JS init`. Never create both a 1.0 `Class(...)` entry and a 2.0 registration for the same class without confirming that core intentionally merges them.

Static members belong to shared objects, not modules: a module is exported to JS as an instance, so Swift `static` members on a `Module` class are not useful there. Keep module-level values as instance `@JS` members.

#### Static members

A static member installs on the JS class object itself, so JS reaches it as `Download.supportedSchemes()`, not through an instance. The 1.0 DSL has dedicated components for this: `StaticFunction` and `StaticAsyncFunction`. Unlike `Function`, they do not receive the instance as their first argument. There is no static *property* component in 1.0, so a static value was exposed as a `StaticFunction` returning it.

```swift
// 1.0
Class(Download.self) {
  Constructor { (url: URL) in Download(url: url) }

  // Instance function: receives the owner as its first argument.
  Function("pause") { (download: Download) in
    download.pause()
  }

  // Static: no owner argument, callable as Download.supportedSchemes()
  StaticFunction("supportedSchemes") { () -> [String] in
    Download.supportedSchemes
  }
}
```

```swift
// 2.0
@SharedObject
final class Download: SharedObject {
  @JS
  init(url: URL) { self.url = url }

  @JS
  func pause() {}

  @JS
  static func supportedSchemes() -> [String] {
    return Self.schemes
  }
}
```

`StaticFunction` and `StaticAsyncFunction` both collapse into a `static` (or `class`) Swift declaration, with `async` carrying the distinction, exactly as `Function`/`AsyncFunction` do for instance members. Because 1.0 had no static property component, a `StaticFunction` that only returns a stored value can become a `@JS static var` in 2.0. That changes the JS contract from a call to a property access, so do it only when the user asks; a syntax migration keeps it a function.

Instance members bind onto the class prototype, while `static`/`class` members bind onto the JS class object through a separate hook. Core has the static hook from `expo` `58.0.19`. Confirm a migrated static member by calling it on the JS class, not on an instance: an instance-side test passes whether or not static binding works.

## Records

Attach `@Record`, remove field wrappers, and encode requiredness in the declaration:

```swift
@Record
struct Options {
  var source: URL       // required
  var retries: Int = 3  // omittable; default applies
  var label: String?    // omittable and nullable
}
```

Rules:

- non-optional with no default: required
- any property with a default: omittable
- optional type: omittable and nullable

Preserve the 1.0 contract exactly. For example, migrate `@Field var source: URL? = nil` to `var source: URL?`, not to `var source: URL`, unless the user approved a breaking change.

Every non-`static`, non-`private`/`fileprivate`, non-`lazy` stored property is part of the 2.0 record surface. If the old type contains stored bookkeeping that was not a 1.0 field, make it `private` with a default value, move it out of the record, or leave the type on 1.0. Verify that each field supports the required `JavaScriptDecodable`/`JavaScriptEncodable` direction. Free-form fields such as `[String: Any]?` are accepted.

`@Record` applies to a struct, or to a `final class` with no inheritance clause. A 1.0 record class (`class Options: Record`) must become `final` and drop `: Record`. The macro adds the conformance, and other protocol conformances go in an extension. When the class has a superclass or subclasses, convert it to a struct only if no Swift caller relies on reference semantics; otherwise keep it on 1.0.

## Unions

`@Union` is the typed, N-case alternative to 1.0's `Either` types. It applies to a non-generic `enum` whose every case carries exactly one associated value:

```swift
// 1.0: JS `string | SourceOptions`, unwrapped by probing each side.
@JS
func load(_ source: Either<String, SourceOptions>) throws {
  if let text: String = source.get() {
    load(url: URL(string: text))
  } else if let options: SourceOptions = source.get() {
    load(url: options.url, headers: options.headers)
  }
}
```

```swift
// 2.0: the same JS type, as a named enum.
@Union
enum Source {
  case text(String)
  case options(SourceOptions)   // a @Record
}

@JS
func load(_ source: Source) throws {
  switch source {               // exhaustive; each payload keeps its static type
  case .text(let text):
    load(url: URL(string: text))
  case .options(let options):
    load(url: options.url, headers: options.headers)
  }
}
```

The JS-visible type is unchanged: case order defines the accepted alternatives, so `Either<String, SourceOptions>` maps to cases in that same order. Decoding tries each case's payload in declaration order and the first match wins, which matters for overlapping types (`Int`/`Double`, `URL`/`String`): keep the 1.0 `Either` order, since reordering silently changes which case a given JS value lands in.

Besides `switch`, a value unwraps by payload type without naming the case, which is the closest analogue to 1.0's `get()`:

```swift
let text = try source.as(String.self)              // throws on a mismatch
let options = try? source.as(SourceOptions.self)   // SourceOptions?
```

A type the union does not carry is a compile error, not a runtime `nil`. A mismatch on a held value throws, where 1.0's `get()` returned `nil`, so a migrated probe chain must become a `switch` or a `try?`.

Constraints, each a compile error: a generic enum, no cases, a case with no payload or more than one, a default value on the payload, and two cases with the identical payload spelling.

Treat adopting `@Union` as an API-shape change to raise with the user rather than a mechanical step: it renames nothing in JS, but it does restructure Swift call sites.

## Views and lifecycle

Views are not covered by 2.0 yet. Keep UIKit `View`, `Prop`, view `Events`, and `OnViewDidUpdateProps` DSL entries on 1.0. Expansion tests alone do not prove the runtime update path exists.

The planned shape is a class marked `@ExpoView` whose props and event callbacks are declared once in a typed `@ViewProps` struct, instead of split between the native view and a hand-written JS prop type. The plugin implements both macros, but SDK 58 core does not declare them, so module source cannot use them. A module with views migrates its non-view members and keeps the view on the DSL. That is a normal mixed-mode result, not a failed migration.

Module lifecycle is core-owned rather than macro-generated. The DSL components map to hook methods with no-op defaults:

| 1.0 | 2.0 |
| --- | --- |
| `OnCreate` | `didCreate()` |
| `OnDestroy` | `willDestroy()` |
| `OnStartObserving` | `didStartListening(event:)` |
| `OnStopObserving` | `didStopListening(event:)` |

Rules:

- Use the `override` keyword when the class inherits `Module`/`BaseModule`; define the hooks directly (no `override`) when the conformance comes only from `@ExpoModule`. Hooks added only in a subclass of a macro module are not called; keep them on the class that declares the conformance.
- The listening hooks receive the event name. A module-wide 1.0 `OnStartObserving` ignores the argument; a per-event `OnStartObserving("name")` becomes a comparison on it.
- `didCreate()` runs after the module is registered, slightly later than 1.0 `OnCreate`, which fires before registration; `willDestroy()` runs at holder teardown. Verify nothing depends on the earlier timing before migrating `OnCreate`.
- DSL lifecycle components can remain during an incremental migration and each fires exactly once, but do not implement a DSL component and its hook for the same behavior, or the work runs twice.

`OnAppContextDestroys`, `OnAppEntersForeground`, `OnAppEntersBackground`, and `OnAppBecomesActive` have no 2.0 hook. Keep them in `definition()`.

## Mixed mode

`@ExpoModule` may coexist with a non-empty `definition()`; core merges the two surfaces. Keep only unsupported entries in the DSL and avoid duplicate names across macro and DSL registrations. `expo-sqlite` in SDK 58 is a shipped example: its module functions, properties, event, and lifecycle hooks use the 2.0 forms, while its shared-object classes stay in `definition()`.

Before deleting `definition()`, verify that it contains no:

- `Name(...)` entry whose name differs from the `@ExpoModule` name
- views or view events
- lifecycle or app-context listeners
- queue-pinned functions

## Contract checklist

For every migrated member compare before and after:

| Concern | Must remain stable |
| --- | --- |
| Module | registration name and `requireNativeModule` key |
| Function | JS name, accepted arity, omitted/default behavior, sync/Promise result |
| Property | JS name, read/write behavior, evaluation/caching |
| Event | listener string, payload shape, timing |
| Record | field names, requiredness, nullability, defaults |
| Shared object | constructor shape, prototype vs constructor placement, identity |
| Execution | JS actor, main actor, background queue, ordering |
