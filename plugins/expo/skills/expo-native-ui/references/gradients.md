# Gradients

Keep an existing working gradient implementation. For new work, compare the
installed React Native version's [View style support](https://reactnative.dev/docs/view-style-props)
with [expo-linear-gradient](https://docs.expo.dev/versions/latest/sdk/linear-gradient/).
An experimental native style may depend on architecture and runtime; browser CSS
syntax alone does not establish native support. Use SDK-matched Expo docs.

Use a gradient to establish hierarchy, improve foreground contrast, or match the
brand. Check the weakest-contrast part of the gradient behind text and controls.
Verify clipping, direction, and rendering on each requested platform. Preserve a
solid-color fallback where the chosen effect is unavailable. Do not remove a
supported library merely because another runtime offers a built-in alternative.
