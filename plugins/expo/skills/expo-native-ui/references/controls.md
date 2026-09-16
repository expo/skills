# Choosing native controls

Use the app's existing controls or `expo-ui` to choose a supported native primitive.
Consult its SDK-matched component docs for props and events instead of treating a
copied API table as current.

- A switch changes a binary setting; a checkbox can express selection in a set. Match the existing product semantics and platform presentation.
- Segmented controls suit a short, stable set of choices. Use a picker/menu or another selection flow when labels or option counts no longer fit.
- A slider needs a meaningful range and step, a readable value, and accessible adjustment. Do not use it where exact typed input is essential without an alternative.
- Dates require an explicit meaning: calendar date, local time, or instant. Preserve it across time zones and serialization. Native pickers expose different presentation and dismissal behavior by platform; handle cancel separately from commit.

For community controls, use the versioned Expo pages for [DateTimePicker](https://docs.expo.dev/versions/latest/sdk/date-time-picker/), [Slider](https://docs.expo.dev/versions/latest/sdk/slider/), [Picker](https://docs.expo.dev/versions/latest/sdk/picker/), and [SegmentedControl](https://docs.expo.dev/versions/latest/sdk/segmented-control/).

Wire changes to actual state/persistence, including disabled, pending, and failed
states when relevant. Verify labels, focus, selected values, large text, and screen
reader interaction. Do not add duplicate haptics on top of a control's own feedback.
