# Module API decisions

Use the [Module API reference](https://docs.expo.dev/modules/module-api/) for the
specific DSL component and its Swift/Kotlin signature. Check the installed
`expo-modules-core` when a current example differs from the project's SDK. Keep
an existing DSL module in its current form unless a migration is requested.

## Choose the boundary

- Use a constant only for a value that may be cached. Use a property or method for state that changes.
- A synchronous function blocks JavaScript. IO and long work need an async boundary; explicitly select the UI queue for UI mutations. A Promise-shaped TypeScript declaration alone does not change native threading.
- Define how native failures become JavaScript errors, and what happens when the owning module/runtime disappears during work. Do not retain callbacks or platform objects past their supported lifetime.
- Declare and type events consistently across native and JavaScript. Start expensive producers when observed if appropriate, stop them when no longer needed, and remove manual subscriptions.
- Verify serialization at the boundary: optional/default record fields, numeric precision, enum values, and binary data. Similar-looking Swift and Kotlin types do not guarantee identical conversion behavior.

For object instances with native resources, read the dedicated
[shared objects guide](https://docs.expo.dev/modules/shared-objects/). Use a shared
object/reference when native identity and ownership need to cross calls, rather
than inventing a global ID-to-object map. Define cleanup and avoid force-unwrapping
fallible resource creation. Test repeated create/use/release and invalid input,
not only the happy-path method call.

Prefer the generated scaffold's bindings and real package implementations as
version-matched examples. Do not copy placeholder image/network implementations
as if they provide the requested functionality.
