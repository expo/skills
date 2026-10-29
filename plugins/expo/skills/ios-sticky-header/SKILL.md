---
name: ios-sticky-header
description: Implement an iOS sticky/floating UI element that works with Expo Router and docks under the large-title navigation bar, following its resize animation as the title collapses on scroll. Use when building progress pills, action bars, filter chips, segmented controls, or any overlay that must stay pinned just below a resizing native header.
version: 1.0.0
license: MIT
---

# Sticky overlay under an iOS large-title nav bar

## When to use this

You have an Expo Router screen with `headerLargeTitle: true` and you want some UI (e.g., a progress pill, a filter row, a segmented control) to stay glued to the bottom of the navigation bar as the user scrolls. The element should follow the bar through its iOS-native shrink animation (the title collapsing from large to compact), then stay pinned at the compact-bar's bottom once the bar has fully collapsed.

If you just want any child view to be sticky and you don't care about the large-title animation, prefer `stickyHeaderIndices` as it's simpler. Use this skill when "docked under the bar" is the goal and the simple approach looks broken because the large title is in play.

## The trick

With `contentInsetAdjustmentBehavior="automatic"` on a `headerLargeTitle: true` native-stack screen, `UIScrollView`'s `adjustedContentInset.top` is set to the **current** navigation-bar height — and iOS animates that inset in lockstep with the bar as the large title collapses. At scroll rest, `contentOffset.y == -adjustedContentInset.top`.

So `-contentOffset.y` literally equals the y-pixel on screen where the nav bar's bottom currently sits, *including mid-animation*. The math is just:

```ts
overlayTop = -scrollY
```

After the bar fully collapses and the user keeps scrolling, `-scrollY` goes negative, so clamp at the compact-bar bottom:

```ts
overlayTop = Math.max(insets.top + COMPACT_NAV_HEIGHT, -scrollY)
```

`insets.top` comes from `useSafeAreaInsets()` (it's the status-bar height on a native-stack screen with the bar visible). `COMPACT_NAV_HEIGHT` is 44pt per the iOS HIG.

## Template

A complete, copy-pasteable screen lives at `assets/template.tsx`. Read it when implementing; it encodes the seeded `scrollY`, the `contentContainer` paddingTop, the safe `Stack.Screen` options, and inline rationale for each constant. The "Caveats" section below explains the constraints the template is built around.

## Caveats

These each silently break the effect in a way that's tedious to debug without knowing the pattern.

**Wrapping the ScrollView in a parent view.** `UINavigationController` looks at the screen view's direct subviews to find its primary scroll view (the one whose `contentOffset` drives the large-title shrink). Any wrapper hides the ScrollView from that lookup and the title stops shrinking on scroll. Make the overlay a sibling, not a child, of the ScrollView. The cleanest way is to return a Fragment with both as direct children.

**Setting `headerStyle.backgroundColor`, `headerTransparent`, or `headerBlurEffect`.** All three touch the bar's content-inset behavior in ways that desync `-scrollY` from the actual bar bottom. There's also an open iOS 26 Expo Router issue where `headerStyle.backgroundColor` with `headerLargeTitle: true` makes the title text invisible (see `useHeaderConfigProps.js`). Stick with `title`, `headerLargeTitle`, `headerShadowVisible`, `headerRight`, `headerLeft`, and `headerSearchBarOptions`; those are safe.

**Using `Animated.event` from `react-native` instead of `useAnimatedScrollHandler` from `react-native-reanimated`.** The former updates on the JS thread, so the overlay lags one frame behind the bar at high scroll velocity. Reanimated's worklet runs on the UI thread; the overlay stays glued frame-by-frame.

**Initializing `scrollY` to 0.** The first paint uses `Math.max(compactBottom, 0) === compactBottom`, so the overlay flashes at the compact-bar bottom for one frame before the first scroll event fires and corrects it. Seed `scrollY` to `-largeTitleBottom` so the first paint is already at the expanded resting position.

**Hard-coding the status-bar height.** Use `useSafeAreaInsets().top`, which is correct across all iPhone form factors. The 44pt compact-bar and 52pt large-title-extension constants are iOS HIG and stable; the status bar varies (Dynamic Island devices differ from older notches differ from pre-X devices).

**Forgetting the contentContainer paddingTop.** Without it, the first row of content lives at y=0 of the contentContainer, which with `contentInsetAdjustmentBehavior="automatic"` paints just below the nav bar, exactly where your overlay is. Reserve `OVERLAY_SLOT_HEIGHT` of paddingTop so content begins below the overlay's bottom edge.

## Verifying without a touch device

Programmatic `scrollViewRef.current.scrollTo({ y, animated: true })` *does* trigger the iOS large-title shrink animation as long as the ScrollView is a direct child of the screen. This lets you capture a smooth-follow demo with `simctl io recordVideo` instead of needing real touch simulation. Extract frames with `ffmpeg -i demo.mp4 -vf "fps=60" out_%03d.png` and check consecutive frames around the scrollTo: if the overlay is positioned right, there's no frame where it sits above or below the bar mid-animation.

If the title is NOT collapsing during your programmatic scroll, that's the "wrapped ScrollView" gotcha; the iOS-native linkage has been broken. Unwrap and try again.
