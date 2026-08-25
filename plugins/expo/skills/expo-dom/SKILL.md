---
name: expo-dom
description: Framework (OSS). Use Expo DOM components to run web code in a webview on native and as-is on web. Migrate web code to native incrementally. For the end-to-end migration of a whole web app, use the expo-web-to-native skill.
version: 1.0.0
license: MIT
---

# DOM Components

DOM components run web code verbatim in a webview on native platforms and as-is on web: mark a file with `'use dom';` and use web-only React libraries (`recharts`, `react-syntax-highlighter`, rich text editors) in an Expo app without modification.

> **Source of truth:** https://docs.expo.dev/guides/dom-components/ — consult the canonical docs when API details matter (full `DOMProps` options, CSS strategies, `IS_DOM`, debugging).

## When to Use DOM Components

Use DOM components when you need:

- **Web-only libraries** — Charts (recharts, chart.js), syntax highlighters, rich text editors, or any library that depends on DOM APIs
- **Migrating web code** — Bring existing React web components to native without rewriting
- **Complex HTML/CSS layouts** — When CSS features aren't available in React Native
- **iframes or embeds** — Embedding external content that requires a browser context
- **Canvas or WebGL** — Web graphics APIs not available natively

## When NOT to Use DOM Components

Avoid DOM components when:

- **Native performance is critical** — Webviews add overhead
- **Simple UI** — React Native components are more efficient for basic layouts
- **Deep native integration** — Use local modules instead for native APIs
- **Layout routes** — `_layout` files cannot be DOM components

## Rules for DOM Components

1. **`'use dom';` directive** at the top of the file
2. **Single default export** — one React component per file, in its own file (never inline next to native components)
3. **Serializable props only** — strings, numbers, booleans, arrays, plain objects — plus **async** functions for native actions
4. **CSS imports must live in the DOM component file** — it runs in an isolated context
5. **Type the `dom` prop** in the component's props: `dom: import("expo/dom").DOMProps`

## Canonical Example: Native Actions

Async function props are the only bridge to native: the webview calls them, native executes them, and return values come back as promises. Functions must be async — every call crosses the webview bridge.

```tsx
// components/editor.tsx
"use dom";

interface Props {
  save: (text: string) => Promise<{ ok: boolean }>;
  dom?: import("expo/dom").DOMProps;
}

export default function Editor({ save }: Props) {
  return (
    <button onClick={async () => console.log(await save("draft"))}>
      Save natively
    </button>
  );
}
```

```tsx
// app/index.tsx — native side: import and render like any component
import { Alert } from "react-native";
import Editor from "@/components/editor";

export default function Screen() {
  return (
    <Editor
      save={async (text) => {
        Alert.alert("From Web", text); // native storage, haptics, etc.
        return { ok: true };
      }}
      dom={{ style: { height: 300 } }}
    />
  );
}
```

## The `dom` Prop

Configures the hosting webview at the call site:

```tsx
<DOMComponent
  dom={{
    scrollEnabled: false,                    // disable body scrolling (e.g. inside a ScrollView)
    contentInsetAdjustmentBehavior: "never", // flow under the notch (disable safe-area insets)
    style: { width: "100%", height: 500 },   // control size manually
  }}
/>
```

## Expo Router Inside DOM Components

`<Link />` and `useRouter()` work inside DOM components. These hooks do NOT — they fail silently because they need synchronous access to native routing state, which the webview doesn't have:

- `useLocalSearchParams()`
- `useGlobalSearchParams()`
- `usePathname()`
- `useSegments()`
- `useRootNavigation()`
- `useRootNavigationState()`

**Fix:** read these values in the native parent and pass them as ordinary serializable props:

```tsx
// app/[id].tsx (native parent)
import { useLocalSearchParams, usePathname } from "expo-router";
import DOMComponent from "@/components/dom-component";

export default function Screen() {
  const { id } = useLocalSearchParams();
  const pathname = usePathname();
  return <DOMComponent id={id as string} pathname={pathname} />;
}
```

## Tips

- DOM components hot reload during development
- Keep DOM components focused — don't put entire screens in webviews; use native components for navigation chrome, DOM components for specialized content
- Prefer `require()`-ing assets over the `public` directory so they bundle with the component
- Test on all platforms — web rendering may differ slightly from native webviews
- Large DOM components may impact performance — profile if needed
- The webview has its own JavaScript context — it cannot directly share state with native; props and async function props are the only bridge

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-dom" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
