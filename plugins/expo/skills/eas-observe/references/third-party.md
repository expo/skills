# Optional Observe integration in a library

Use only for package-author work. Follow [third-party integration docs](https://docs.expo.dev/eas/observe/integrations/third-party/)
for current registration/configuration APIs and minimum package versions. App-side
instrumentation uses [setup guidance](./setup.md).

Preserve optionality: the library must load and work when `expo-observe` is absent
or disabled. Use the documented optional peer dependency and guarded runtime load;
a development dependency for types does not make it a required consumer dependency.
Do not add an EAS account or project requirement to the library's ordinary usage.

Register the integration using the supported mechanism; enable collection only
when configured by the consuming app. Normalize boolean/object configuration as
required. Export declaration augmentation through an entry point consumers load,
so runtime configuration and TypeScript support agree.

Emit actionable library-level observations with stable package-prefixed event
names and bounded, nonsensitive attributes. Avoid adding generic product analytics
or duplicate app-level events to a library integration.

Verify consumers with Observe absent, disabled, and enabled. In enabled mode,
exercise the actual library event and ensure it is emitted once with the expected
configuration. A successful TypeScript build alone does not prove optional loading
or runtime dispatch works.
