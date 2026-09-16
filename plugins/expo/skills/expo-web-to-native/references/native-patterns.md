# Adapting web interaction to native

Preserve the requested content, brand, and user task while adapting interactions
to the target device. A native app need not look like an OS settings screen, and
visual similarity to its website is not itself a failure.

Use `expo-ui` when selecting native controls, `expo-router` for navigation, and
`expo-native-ui` for layout/accessibility. Match installed SDK support and preserve
existing libraries. Native rendering does not remove the need to wire behavior,
labels, state, and platform fallbacks.

| Web interaction | Native decision |
|---|---|
| Navigation links/tabs | Use a stack/tab hierarchy matching the information architecture; preserve deep links and back history. |
| Dialog or selection popup | Choose a sheet, modal route, menu, or inline picker by task length and dismissal semantics; do not turn every modal into a sheet. |
| Hover actions | Make essential actions reachable by touch and accessibility; long press can expose secondary actions but should not hide the only path. |
| Settings and short grouped lists | Native form/list controls can supply familiar grouping; retain product semantics and supported presentation. |
| Long feed or table | Use lazy row rendering and a responsive information layout. Do not eagerly map an unbounded dataset or remove important columns without a replacement. |
| Multi-column layout | Adapt to available width and hierarchy; tablets may retain columns while phones need another arrangement. |
| Form or search | Keep inputs/actions visible with the keyboard, preserve drafts, and make submission, cancellation, and errors work. |
| Refresh/status feedback | Keep stale content during refresh and show recoverable errors. Choose pull-to-refresh or an explicit action by discoverability and context. |

Native stacks provide standard transitions. Add custom motion/haptics only when
they explain state or improve an interaction; use `expo-animation` for gesture,
interruption, and reduced-motion decisions. Do not add animation everywhere merely
because the web port has little of it.

Test the primary flow, back/dismiss, keyboard access, large text, and relevant
platform differences. For changed motion, inspect a short recording or live run;
a screenshot proves only a static state.
