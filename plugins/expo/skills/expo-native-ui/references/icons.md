# Icons across platforms

Preserve the product's established icon family and brand marks. Use
[expo-symbols](https://docs.expo.dev/versions/latest/sdk/symbols/) for native symbols
when suitable; check the installed SDK's platform support and source props. An SF
Symbols name alone is not an Android or web fallback.

Use a supported Material/icon-library source or asset on other platforms. For
[Expo vector icons](https://docs.expo.dev/guides/icons/), load required fonts before
showing critical navigation. For native tabs, use the icon contract in the installed
Router's native-tabs documentation, not an in-screen icon component's props.

Symbol availability depends on OS version as well as package version. Check the
lowest supported OS and provide a fallback for newer glyphs. Preserve the icon's
semantic meaning across platforms even when the glyph differs.

Icon-only controls need an accessible action label and a usable touch target
independent of glyph size. Hide decorative icons from accessibility when an adjacent
label already provides the meaning. Check selected/disabled states, theme contrast,
and legibility at actual size. Animate a symbol only when it communicates state.
