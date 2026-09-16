# Registration and autolinking

Read the current [expo-module.config.json reference](https://docs.expo.dev/modules/module-config/)
and [autolinking guide](https://docs.expo.dev/modules/autolinking/) for fields,
resolution rules, exclusions, and diagnostics for the installed SDK.

Put the config at a standalone package's root beside `package.json`, or at the local
module root under `expo.autolinking.nativeModulesDir` (`modules/` by default).
Register Apple module class names and fully qualified Android class names. Include
only platforms actually supported, and register AppDelegate subscribers when used.

If JavaScript cannot find a native module, trace discovery → registration → native
build → installed binary before changing the API name. A local module outside the
configured search directory, a dependency omitted from the host, duplicate package
versions, or a stale development binary can each produce a similar symptom.

Use autolinking's diagnostics to inspect the resolved path/version. Do not paste a
fixed resolution-order list into a repair or add manual linkage before establishing
why discovery failed. Rebuild after native registration changes and verify the
module in the actual host app, not just Expo Go or a JavaScript mock.
