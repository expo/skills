# Native view integration

Start from the [native view tutorial](https://docs.expo.dev/modules/native-view-tutorial/)
and the installed version's [View/Prop/event API](https://docs.expo.dev/modules/module-api/).
Use the generator's View/ViewEvent samples for a runnable scaffold rather than
maintaining a second Swift/Kotlin/TypeScript tutorial here.

## Boundaries that need deliberate handling

- Match the registered module/view names to the JavaScript native-view binding. Include React Native view props in the public wrapper while keeping native-only props typed.
- Define layout ownership. A native child added to an ExpoView still needs layout/measurement; mounting it does not make it fill its parent automatically on every platform.
- Apply coordinated props after they have been received when intermediate combinations would be invalid. Keep expensive work out of repeatedly called prop setters.
- Declare view events in the view definition and match the dispatcher name/payload to the JavaScript callback, including its `nativeEvent` wrapper where required.
- Methods exposed on a view use that view's ref/lifetime. Handle calls before mount or after disposal, and perform UI work on the correct thread.
- Remove observers and release native resources when the view is no longer used. Module, view, activity, and React runtime lifetimes are not interchangeable.
- Android child management and grouped props have platform-specific APIs; consult those sections only when implementing a container or grouped setters.

Build on the requested platforms and exercise prop updates, resizing, real events,
ref methods, and mount/unmount cycles. A mocked JavaScript wrapper does not validate
the native registration or lifecycle.
