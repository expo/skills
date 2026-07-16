# 1.0 to 2.0 Migration Map

Use this reference while editing. Preserve behavior first; macro adoption is secondary.

## Module and naming

Convert the module class and remove `Name(...)` only when the paired core reads the macro-synthesized name:

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

Always carry a custom 1.0 name into `@ExpoModule("...")`. A stale `Name(...)` can override or conflict with the 2.0 name depending on the core revision. In mixed mode, remove `Name(...)` only after verifying the installed `_jsName` contract.

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

Do not migrate functions that resolve to the same JS name unless the checked-out macro has overload grouping and collision diagnostics. Older 2.0 implementations install one property per declaration, so the last overload silently wins.

Reject or keep in DSL any unsupported signature such as variadics, `inout`, unresolved generics, or closure parameters without verified callback support. A `Promise` parameter is also unsupported; refactor it as described under Async functions.

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

This shape requires the `JavaScriptEncodable` conformance for `Task` in the checked-out core (encode-only; a JS promise does not decode back into a `Task`). Verify it exists before using this shape; prefer shape 1 or 2 when it is absent.

Do not assume scheduling is unchanged. 2.0 async members are `@JavaScriptActor`-isolated and begin on the JS thread until their first real suspension. A 1.0 `.runOnQueue(...)` function or a workload that relied on automatic background execution must not be migrated as-is. Never move blocking I/O directly onto the JS actor.

For a queue-pinned 1.0 function, prefer restructuring the work onto the Swift Concurrency model (structured concurrency, an actor, or a detached task for blocking work). When that is not feasible because the queue itself is the contract, for example a library that must be called from one serial queue, convert to an `async` method that dispatches to that queue inside a checked continuation:

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

Map a 1.0 `Constant` to a `@JS let`; a `let` property is a natural constant and produces a read-only JS property:

```swift
// 1.0
Constant("apiVersion") { 3 }

// 2.0
@JS
let apiVersion = 3
```

Evaluation timing shifts: a 1.0 `Constant` closure runs lazily, while a `let` initializes with the module instance. When the value is expensive and must stay deferred, keep private lazy storage and expose a getter-only computed property (a `var` with a `{ }` getter body and no storage of its own), not a stored `lazy var`:

```swift
private lazy var cachedInfo = computeInfo()

@JS
var info: Info {  // computed: recomputes nothing, just returns the cached value
  return cachedInfo
}
```

Do not expose a cached value as a settable `lazy @JS var`.

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

Use `() -> Void` for no-payload events. For payloads, create or reuse a `JavaScriptEncodable` type instead of preserving an untyped dictionary. Migrate `OnStartObserving` and `OnStopObserving` to the `didStartListening(event:)`/`didStopListening(event:)` lifecycle hooks (see Views and lifecycle).

Default `@Event` dispatch schedules onto the JS thread and is callable from other isolation contexts. Do not use `sync: true` unless core provides the matching `emitSync` overloads.

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

  // Installs on the JS class (constructor) object, not the prototype.
  @JS
  static let maxConcurrent = 4
}

@ExpoModule(classes: [Download.self])
final class DownloadModule: Module {}
```

Drop the leading owner argument used by instance DSL closures; use `self` in the real instance method. Preserve constructor arity and JS member names.

Migrate only when the checked-out core supplies the shared-object decoration and construction hooks. Static properties migrate as Swift `static` or `class` properties and install on the JS class (constructor) object rather than the prototype; verify constructor-side routing for static functions before migrating them, since instance support does not imply static-function support. Never create both a 1.0 `Class(...)` entry and a 2.0 registration for the same class without confirming that core intentionally merges them.

Static members belong to shared objects, not modules: a module is exported to JS as an instance, so Swift `static` members on a `Module` class are not useful there. Keep module-level values as instance `@JS` members.

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

Every stored property is part of the 2.0 record surface. If the old type contains stored bookkeeping that was not a 1.0 field, move it out of the record or leave the type on 1.0; there is no field opt-out. Verify that each field supports the required `JavaScriptDecodable`/`JavaScriptEncodable` direction.

Do not adopt `@Union` until that macro and its coding witnesses exist in the target.

## Views and lifecycle

Keep UIKit `View`, `Prop`, view `Events`, and `OnViewDidUpdateProps` DSL entries until the target includes the complete `@ViewProps`/`@ExpoView` core contract. Macro declarations or expansion tests alone do not prove the runtime update path exists.

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

There is no 2.0 replacement for every lifecycle component; for example, retain app-context teardown handling when no matching hook exists.

## Mixed mode

`@ExpoModule` may coexist with a non-empty `definition()` when the paired core supports merging the two surfaces. Keep only unsupported entries in the DSL and avoid duplicate names across macro and DSL registrations.

Before deleting `definition()`, verify that it contains no:

- views or view events
- lifecycle or app-context listeners
- queue-pinned functions
- shared-object static functions or other unsupported definitions

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
