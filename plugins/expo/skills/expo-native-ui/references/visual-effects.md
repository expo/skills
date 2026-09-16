# Blur and glass integration

Read the installed SDK's [BlurView](https://docs.expo.dev/versions/latest/sdk/blur-view/)
and [GlassEffect](https://docs.expo.dev/versions/latest/sdk/glass-effect/) docs for
platform support, availability checks, and current props. Avoid duplicating their
tint and style catalogs here.

Use blur/glass to separate foreground controls from visible content, with legible
text and recognizable actions. A decorative background is not interactive simply
because it uses glass. Match the existing design rather than covering every card
with an effect.

## Failure cases to check

- Blur depends on content/render order and platform implementation. Verify that moving or asynchronously loaded content actually blurs; test the documented Android setup separately.
- Rounded BlurView clipping may require `overflow: 'hidden'`. Glass needs different treatment: ancestor clipping can cut off its rim and interactive deformation. Check it at the actual container boundary.
- For SDKs exposing both `isLiquidGlassAvailable()` and `isGlassEffectAPIAvailable()`, check both; early OS betas can report OS support without the usable API. Consult current docs before carrying a beta workaround to another version.
- Avoid opacity animation on a glass view or its ancestors where the API warns against it. Keep the material stable and animate content, or use the supported effect-style transition.
- Respect Reduce Transparency with a solid surface and handle changes while the screen is mounted. The fallback must preserve contrast and interaction on Android, web, and older iOS versions as applicable.
- A glass-backed navigation sheet depends on Router and OS support; use `expo-router`'s form-sheet reference for that boundary, not a generic BlurView wrapper.

Verify the material over both light and dark real content, in the fallback state,
and during scrolling/interaction. Do not equate a rendered effect with accessible
contrast or complete platform support.
