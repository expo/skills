# Persistence choices

Preserve the app's existing storage unless its requirements have changed. Choose
by data sensitivity, volume, querying, and lifetime, not by a blanket library ban.

- **Non-sensitive preferences or drafts:** existing key-value storage can be sufficient. [AsyncStorage](https://docs.expo.dev/versions/latest/sdk/async-storage/) is a community package, distinct from the removed React Native core export.
- **Structured/offline records:** [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) provides SQL and key-value/localStorage APIs. Read the installed SDK's initialization, transaction, and persistence guidance before selecting a surface.
- **Native credentials:** [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/), or the auth provider's supported secure-storage integration. It is not a general database; check backup, uninstall, biometric, and platform behavior.

Gate state-dependent redirects and first writes on hydration. Do not overwrite
persisted data with initial defaults while an async read is pending. Define what
survives restart, logout, and an account switch, and migrate existing records before
changing storage formats or removing a dependency.

For external-store subscriptions, keep snapshots stable until the underlying value
changes; repeatedly parsing JSON inside `getSnapshot` creates new identities. Use
the project's established state/store integration instead of adding a generic hook.

Verify persistence across restart and the relevant user/account transition. Never
log tokens or copy production storage values into an example.
