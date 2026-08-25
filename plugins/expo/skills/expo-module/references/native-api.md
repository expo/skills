# Native Module and View API: Constraints and Platform Differences

> **Source of truth:** https://docs.expo.dev/modules/module-api/ — consult the canonical docs when API details matter (definition components, argument types, Records, Enumerables, Either types, view props, events). Shared objects, `SharedRef`, and the `Class` DSL live on https://docs.expo.dev/modules/shared-objects/. This file keeps only the constraints and Kotlin-vs-Swift differences that are easy to get wrong. The minimal module skeleton (Swift, Kotlin, TypeScript) is in SKILL.md.

## Constraints and Ordering

- `Function` (synchronous) blocks the JS thread. Functions accept at most 8 arguments.
- `Events("onFoo", ...)` must be declared in the definition **before** `sendEvent` is used.
- `AsyncFunction` runs on a background thread by default; force main-thread execution with `.runOnQueue(.main)` (Swift) when touching UI.
- `Constant` is computed once on first access, then cached — do not use it for values that change.
- Shared object instances are deallocated only when **neither** JS nor native code holds a reference.
- Functions declared inside a `View` block live on the view, not the module — call them from JS through a React ref to the component.
- `OnViewDidUpdateProps` runs after all props of an update have been set — batch work there instead of in individual `Prop` setters.

## Kotlin vs Swift Differences

- **Coroutines:** Kotlin `AsyncFunction` supports coroutines: `AsyncFunction("fetch") Coroutine { url: java.net.URL -> withContext(Dispatchers.IO) { url.readText() } }`.
- **Event payloads:** Swift `sendEvent` takes a dictionary (`["value": v]`); Kotlin takes `bundleOf("value" to v)`.
- **Records:** Kotlin uses `class` (not `struct`), and optional `@Field`s need an explicit `= null` default.
- **Enumerable:** Kotlin enum cases need an explicit value property — `enum class Theme(val value: String) : Enumerable { LIGHT("light"), ... }`; Swift is just `enum Theme: String, Enumerable`.
- **SharedObject:** Kotlin subclasses take a `RuntimeContext` as the first constructor argument and pass it to `SharedObject(runtimeContext)`; override `sharedObjectDidRelease()` for native cleanup (e.g. recycling bitmaps). Swift subclasses `SharedObject` directly with no context argument.
- **ExpoView constructor:** Swift is `required init(appContext: AppContext)` calling `super.init(appContext:)`; Kotlin is `class MyView(context: Context, appContext: AppContext) : ExpoView(context, appContext)`.
- **View EventDispatcher:** Swift declares a stored property (`let onPress = EventDispatcher()`); Kotlin uses a property delegate (`private val onPress by EventDispatcher()`). The property name is the event name JS receives.

## Android-only View DSL

- `OnViewDestroys` (view teardown hook) is Android-only.
- `PropGroup` (batch-register props sharing one setter) and `GroupView` (child-view management: `AddChildView`, `GetChildCount`, `GetChildViewAt`, `RemoveChildView`, `RemoveChildViewAt`) are Android-only.
