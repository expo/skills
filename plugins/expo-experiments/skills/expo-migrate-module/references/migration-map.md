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

Always carry a custom 1.0 name into `@ExpoModule("...")`. A stale `Name(...)` can override or conflict with the 2.0 name depending on the core revision. In mixed mode, remove `Name(...)` only after verifying that the module still resolves under its expected JS name.

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

To restore the 1.0 behavior, use the `@JS` macro's `.concurrent` option (macros plugin `0.10.0`):

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

Two constraints:

- `.concurrent` is valid only on an `async` function. On anything else it is diagnosed on the `@JS` attribute.
- You must still write `async` yourself. The macro cannot add it, but the diagnostic for a synchronous function carries a fix-it that inserts it.

**Check availability first.** The plugin side shipped in `0.10.0`, but this also needs a `JSOptions` type and a second `@JS` overload in core, because the options-only spelling cannot reuse the unlabeled JS-name slot. Core has lagged the plugin on every 2.0 feature so far, and where it still declares `@JS(_ jsName: String? = nil)` alone, `@JS(.concurrent)` does not compile. Read the checked-out declaration:

```bash
grep -rn 'public macro JS' <expo-modules-core>
```

If it takes only a name, use the explicit patterns below instead.

For a queue-pinned function, or when `.concurrent` is unavailable, prefer restructuring the work onto the Swift Concurrency model (structured concurrency, an actor, or a detached task for blocking work). When that is not feasible because the queue itself is the contract, for example a library that must be called from one serial queue, convert to an `async` method that dispatches to that queue inside a checked continuation:

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
}

@ExpoModule(classes: [Download.self])
final class DownloadModule: Module {}
```

Drop the leading owner argument used by instance DSL closures; use `self` in the real instance method. Preserve constructor arity and JS member names.

Migrate only when the checked-out core supplies the shared-object decoration and construction hooks. Never create both a 1.0 `Class(...)` entry and a 2.0 registration for the same class without confirming that core intentionally merges them.

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

What decides whether any of this works is the binding path: instance members bind onto the class prototype, while `static`/`class` members bind onto the constructor object through a separate, `constructor:`-labeled decoration hook. The two are independent capabilities.

**Support status.** The macros plugin has emitted the `constructor:` binding since `0.7.0`, but core shipped the `prototype:` overload well ahead of it. Where only `prototype:` is declared, a `@JS static` member expands and then fails to link. Verify before migrating any static member:

```bash
grep -rn '_decorateSharedObject' <expo-modules-core>
```

If only the `prototype:` overload is declared, keep every `StaticFunction`/`StaticAsyncFunction` entry in the 1.0 `Class(...)` block. Mixed mode is the expected outcome here: migrate the constructor and instance members, leave the static entries on the DSL, and say in the handoff that static members stayed behind because the installed core does not bind them yet.

Static functions and static properties travel this same path, so neither is available ahead of the other. When the hook is present, confirm it by calling the member on the JS class rather than on an instance; an instance-side test passes whether or not static binding works.

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

## Unions

`@Union` (macros plugin `0.10.0`) is the typed, N-case alternative to 1.0's `Either` types. It applies to a non-generic `enum` whose every case carries exactly one associated value:

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

**Check availability first.** The plugin side shipped in `0.10.0`, but this also needs the `Union` macro declaration and the `UnionCaseMismatch` exception in core:

```bash
grep -rn 'public macro Union\|UnionCaseMismatch' <expo-modules-core>
```

Keep `Either` types on the 1.0 DSL until both exist in the target. Treat adopting `@Union` as an API-shape change to raise with the user rather than a mechanical step: it renames nothing in JS, but it does restructure Swift call sites.

## Views and lifecycle

Views are not covered by 2.0 yet. Keep UIKit `View`, `Prop`, view `Events`, and `OnViewDidUpdateProps` DSL entries on 1.0. Macro declarations or expansion tests alone do not prove the runtime update path exists.

The planned shape is a class marked `@ExpoView` whose props and event callbacks are declared once in a typed `@ViewProps` struct, instead of split between the native view and a hand-written JS prop type. Until that lands complete, a module with views migrates its non-view members and keeps the view on the DSL. That is a normal mixed-mode result, not a failed migration.

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
- `StaticFunction`/`StaticAsyncFunction` entries, unless core declares the `constructor:` decoration hook

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
