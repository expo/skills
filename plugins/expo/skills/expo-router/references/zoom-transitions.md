# Apple Zoom Transitions

Fluid zoom transitions between screens. iOS 18+, Expo SDK 55+, Stack navigator only — will not work with sheets or popovers.

> Source: https://docs.expo.dev/router/advanced/zoom-transition/ — the canonical page (full API walkthrough: `alignmentRect`, `usePreventZoomTransitionDismissal`, `unstable_dismissalBoundsRect`; append `.md` for markdown). API reference, including `withAppleZoom` on the Link page: https://docs.expo.dev/versions/latest/sdk/router/ — swap `latest` for the project's SDK. This reference adds only what the docs do not cover: when zoom looks right and how to avoid gesture conflicts.

## Minimal Example

Wrap the source element in `Link.AppleZoom`; optionally mark the destination element with `Link.AppleZoomTarget`:

```tsx
// Source screen
<Link href="/photo" asChild>
  <Link.Trigger>
    <Pressable style={{ alignItems: "center" }}>
      <Link.AppleZoom>
        <Image
          source={{ uri: "https://example.com/thumb.jpg" }}
          style={{ width: 200, aspectRatio: 4 / 3 }}
        />
      </Link.AppleZoom>
      <Text>Caption text (not zoomed)</Text>
    </Pressable>
  </Link.Trigger>
</Link>
```

```tsx
// Destination screen (app/photo.tsx)
<Link.AppleZoomTarget>
  <Image
    source={{ uri: "https://example.com/full.jpg" }}
    style={{ width: "100%", aspectRatio: 4 / 3 }}
  />
</Link.AppleZoomTarget>
```

- `Link.AppleZoom` accepts only a single child; siblings outside it are not part of the transition.
- Without `Link.AppleZoomTarget`, the zoom animates to fill the entire destination screen.
- `<Link.Trigger withAppleZoom>` zooms the whole trigger element instead of a wrapped subtree.
- Zoom works alongside `<Link.Preview />` long-press previews on the same Link — but only when the destination uses modal presentation; otherwise it falls back to the standard transition.

## Best Practices

**Good use cases:**
- Thumbnail → full image (gallery, profile photos)
- Card → detail screen with similar visual content
- Source and destination with similar aspect ratios

**Avoid:**
- Skinny full-width list rows as zoom sources — the transition looks unnatural
- Mismatched aspect ratios between source and destination without `alignmentRect`
- Using zoom with sheets or popovers — only works in Stack navigator
- Hiding the navigation bar — known issues with header visibility during transitions

**Tips:**
- Always provide a close or back button — dismissal gestures (pinch, swipe down at top, swipe from leading edge) are not discoverable
- If the destination has a zoomable scroll view, restrict dismissal with `usePreventZoomTransitionDismissal({ unstable_dismissalBoundsRect })` to avoid gesture conflicts — the system gives that scroll view precedence over the dismiss gesture
- Source view doesn't need to match the tap target — only the `Link.AppleZoom` wrapped element animates
- When source is unavailable (e.g., scrolled off screen), the transition zooms from the center of the screen
