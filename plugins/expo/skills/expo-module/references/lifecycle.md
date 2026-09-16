# Native lifecycle integration

Choose the lifecycle that owns the resource: module instance, native view, activity,
application, or JavaScript runtime. Register once for that owner and release with
it; avoid restarting an application-wide service on every screen mount.

Read only the relevant source:

- [Module API lifecycle hooks](https://docs.expo.dev/modules/module-api/) for module creation/destruction and app/activity events exposed inside the DSL.
- [iOS AppDelegate subscribers](https://docs.expo.dev/modules/appdelegate-subscribers/) for app-level callbacks without patching AppDelegate directly.
- [Android lifecycle listeners](https://docs.expo.dev/modules/android-lifecycle-listeners/) for activity/application callbacks outside module definitions.

## Integration pitfalls

AppDelegate subscribers require an Expo-compatible host delegate and registration
in `expo-module.config.json`. A subscriber class existing on disk is insufficient.
Check callback-result aggregation before returning a value that affects other
subscribers' handling, especially launch and remote-notification callbacks.

Android listener methods follow the Expo listener interface, not every method on
Android Activity. Do not assume `onStart`/`onStop` exist merely because Activity has
them; check the installed interface. Register through the package's listener factory
and account for activity recreation and a temporarily unavailable current activity.

Deep links/intents can arrive on cold start or an already-running activity. Preserve
existing host handlers and ensure the event reaches the intended JavaScript/native
consumer once. Test foreground/background, recreation, and cleanup for the resource
being added; a successful initial launch does not cover those lifetimes.
