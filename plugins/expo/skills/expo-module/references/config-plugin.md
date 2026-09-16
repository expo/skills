# Repeatable native configuration

Use [config plugin development](https://docs.expo.dev/config-plugins/development-and-debugging/)
for the plugin/mod lifecycle and [the config-plugin tutorial](https://docs.expo.dev/modules/config-plugin-and-native-module-tutorial/)
for a complete implementation. Follow the package's generated build scripts and
`app.plugin.js` entry point; do not assume a generic build command exists.

## Integration rules

- Use structured mods for Info.plist, AndroidManifest, and other supported files. Preserve existing entries and compose with other plugins; repeated prebuild must not duplicate values.
- Keep plugin configuration separate from native mod execution. Follow the current API's sync/async contract rather than making every stage async or assuming all native work runs when app config is read.
- Treat values embedded in Info.plist, AndroidManifest, app config, or a JavaScript bundle as inspectable by app users. These locations can carry public SDK identifiers, not server secrets.
- Validate required options and target-platform assumptions. Do not enable a permission/capability merely because a tutorial demonstrates it.
- In CNG apps, make changes in the plugin/config inputs that survive regeneration. In a manually maintained native host, preserve ownership and integrate the necessary native changes explicitly.

Inspect the generated values and run generation twice in a disposable fixture or
known-regenerable native project to check idempotence. Do not use `prebuild --clean`
as a generic test against hand-maintained native directories. Native behavior still
requires a matching build and relevant runtime check.
