import { Stack } from 'expo-router';
import * as React from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// iOS HIG: compact nav bar is 44pt; the large-title extension adds another
// 52pt. We clamp the overlay's `top` to the compact-bar bottom and seed
// `scrollY` to the expanded position so the overlay doesn't flicker on the
// first frame before any scroll event has arrived.
const COMPACT_NAV_HEIGHT = 44;
const LARGE_TITLE_HEIGHT = 52;

// Vertical room the overlay occupies (its outer rectangle including any
// padding around the capsule). The ScrollView's contentContainer reserves
// this much at the top so the first row of content never slides under the
// overlay at scroll rest.
const OVERLAY_SLOT_HEIGHT = 56;

export default function MyScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const compactBottom = insets.top + COMPACT_NAV_HEIGHT;
  const largeTitleBottom = compactBottom + LARGE_TITLE_HEIGHT;

  // Seeded to the expanded-large-title resting position so the overlay
  // paints at the right `top` on the very first frame.
  const scrollY = useSharedValue(-largeTitleBottom);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });
  const overlayStyle = useAnimatedStyle(() => ({
    top: Math.max(compactBottom, -scrollY.value),
  }));

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My screen',
          headerLargeTitle: true,
          // Leave the rest of the header options alone — anything that
          // affects the bar's content insets (headerStyle.backgroundColor,
          // headerTransparent, headerBlurEffect) will desync the math.
        }}
      />
      {/* The ScrollView must be a direct sibling of the overlay — no
          wrapping <View>. UINavigationController looks at the screen's
          direct subviews to find its primary scroll view; a wrapper
          hides it and the large title stops collapsing on scroll. */}
      <Animated.ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingTop: OVERLAY_SLOT_HEIGHT }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}>
        {/* ... content ... */}
      </Animated.ScrollView>
      <Animated.View
        style={[styles.overlay, overlayStyle]}
        pointerEvents="box-none">
        {/* ... pill / bar / chip contents ... */}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    // `top` is animated by `overlayStyle` so the overlay tracks the nav
    // bar's bottom as the large title collapses.
  },
});
