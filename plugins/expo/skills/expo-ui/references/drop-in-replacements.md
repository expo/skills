# Migrating a community control

Use when replacing an existing dependency is requested or necessary for the task.
Read the [replacement catalog](https://docs.expo.dev/versions/latest/sdk/ui/drop-in-replacements/)
for the installed SDK, then the specific replacement's compatibility notes.

Inspect the app's imports, refs, callbacks, props, platform targets, and styling
before selecting a replacement. Confirm the installed package's export path and
whether the export is named or default. A package advertised as compatible can
still differ for the subset of behavior this app uses.

Universal components and community replacements are distinct APIs. Choose the
replacement for compatibility with an existing integration; choose a universal
component when its API fits new work. Do not mix example props between them.

Verify the migrated control's interactions, imperative calls, layout, and platform
behavior before removing the original dependency. Remove it only when other
callers no longer need it. Preserve a working dependency when migration is outside
the request.
