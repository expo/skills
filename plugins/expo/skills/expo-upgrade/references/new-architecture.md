# New Architecture compatibility

Use the [Expo New Architecture guide](https://docs.expo.dev/guides/new-architecture/)
and the target SDK's release notes for supported architectures. Defaults, opt-out
support, and Expo Go compatibility have changed between releases; do not copy a
`newArchEnabled: false` workaround into an SDK that no longer supports it.

Inspect the installed native dependencies, their supported versions, and doctor
results. Verify a suspected library incompatibility against its maintained docs or
source before replacing it. For Reanimated/Worklets, install the versions required
by the selected Expo SDK and Reanimated major, not an arbitrary latest pair.

## Diagnose the actual failure

Distinguish dependency/autolinking, native compilation, runtime initialization, and
layout/gesture behavior. A private JavaScript global is not a portable architecture
check; prefer the SDK's documented build configuration and native diagnostics.

After changing native configuration/dependencies, rebuild the matching development
or release binary. Use clean prebuild only for native output confirmed to be
disposable CNG-generated code. Preserve hand-maintained iOS/Android projects and
apply their native changes explicitly. Clear a relevant cache only when evidence
suggests stale output; it cannot fix an incompatible library.

Verify the affected native surfaces, including layout and animation paths changed
by the upgrade. State any platform builds or device checks that remain unavailable.
