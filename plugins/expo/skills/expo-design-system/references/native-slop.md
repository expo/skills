# Native Slop: Named Anti-Pattern Tells

The recurring failures of AI-generated React Native apps, each with a memorable name, an observable tell, and the native replacement. Before shipping a screen, scan it against this list by name: a tell that is present is a bug unless it is a deliberate, documented design decision of this app. The names double as review vocabulary - "that's a Floating Pill Tab Bar" is a complete review comment - and as a grading checklist for screenshots.

## The 20 tells

| # | Name | The tell (observable) | Native instead |
|---|---|---|---|
| 1 | **The Web Modal** | A centered rounded rectangle over a dimmed backdrop for picking, composing, or confirming - a web dialog teleported onto a phone | Bottom sheet (`presentation: 'formSheet'`, `@expo/ui` BottomSheet), action sheet, or anchored menu |
| 2 | **The X-Button Sheet** | A sheet closed only by an "X" in the top corner - no grab handle, no swipe-to-dismiss | Native sheet with detents; drag down to dismiss; Cancel/Done in the header where the platform puts them |
| 3 | **Emoji Iconography** | 🔥 ⚙️ ✨ ❤️ as tab icons, buttons, or empty-state art | SF Symbols on iOS, Material icons on Android - one icon family per platform (see `expo-native-ui`) |
| 4 | **The Purple-Gradient Hero** | The screen opens on an indigo→purple gradient block with white display text - a SaaS landing page pasted into an app | Navigation large title + content. Screens start with the user's data, not a hero |
| 5 | **The Floating Pill Tab Bar** | A custom rounded, inset, drop-shadowed tab bar hovering above the home indicator | The platform tab bar (`NativeTabs`), flush to the bottom edge, system materials and behaviors included |
| 6 | **Inter Everywhere** | A downloaded web font (Inter/Poppins/Manrope) on every text node, so nothing matches system type - often with iOS synthesizing missing weights | System type (SF / Roboto) by default; a brand font only at display sizes, only as a documented brand decision |
| 7 | **Everything's a Card** | Every list row and section wrapped in its own white rounded shadowed card; cards nested inside cards | Grouped lists (`@expo/ui` List, iOS inset-grouped, Material sections); grouping via background + hairlines, not boxes |
| 8 | **Shadowboxing** | Heavy drop shadows (opacity ≥ 0.15, radius ≥ 10) doing hierarchy's job on white-on-white surfaces | 2-3 tokened elevation levels; hierarchy from the type ramp and grouping. iOS is a low-shadow platform |
| 9 | **Wireframe Borders** | A 1px gray `borderWidth` outlining every container - usually Tailwind's `#E5E7EB` from web muscle memory | Spacing and surface contrast; hairlines only as list separators (`StyleSheet.hairlineWidth`, semantic separator color) |
| 10 | **alert() Confirmation** | `Alert.alert("Are you sure?")` for destructive confirms, or alerts for successes and validation errors | Destructive: action sheet anchored to the action (iOS) / dialog or snackbar+undo (Android). Errors: inline. Success: the UI just updates |
| 11 | **The Hand-Rolled Header** | `headerShown: false` plus a `<Text>` title and custom back button - losing large-title collapse, back-swipe, and scroll-to-top | Stack header options. The navigation bar is configured, never rebuilt |
| 12 | **16-Everything** | The same 16px padding on every axis at every level; section gaps equal row gaps, so proximity carries no meaning | The spacing scale with distinct steps: row gap < group gap < section gap |
| 13 | **The Squish Reflex** | `scale: 0.96` press feedback on *every* touchable - including full-width list rows - or `TouchableOpacity`'s washed-out flash | Rows highlight (background change); buttons scale; `Pressable` with per-role feedback. Never `TouchableOpacity` |
| 14 | **The Grand Entrance** | Staggered `FadeInDown.delay(i * 100)` on every list and screen, replaying on every visit | Entrance animation only for rare/first-time moments (`expo-animation`'s frequency gate); routine screens just appear |
| 15 | **The Onboarding Carousel** | Three swipe slides with centered illustrations, page dots, and a Skip button before the app's first useful screen | Get to content on screen one; teach contextually at first use |
| 16 | **Cross-Platform Costume** | One platform wearing the other's uniform: a FAB or ripple in an iOS-idiom app; iOS back-chevrons, large titles, or iOS-styled switches on Android | Each platform gets its own HIG's idiom - or a deliberate, documented platform-neutral treatment |
| 17 | **Safe-Area Collision** | Content under the notch/Dynamic Island or home indicator - or hand-patched with `marginTop: 50` | Headers/tab bars handle it; otherwise `contentInsetAdjustmentBehavior="automatic"` or safe-area-context insets |
| 18 | **Dark-Mode Amnesia** | Hardcoded `#fff` / `#000` / gray hexes; the app breaks - or half-breaks - the moment the OS theme flips | Semantic colors (`Color.ios.*` / `Color.android.dynamic.*`) through the theme; brand colors as declared light/dark pairs |
| 19 | **The Spinner Blink** | A full-screen centered `ActivityIndicator` between every state, or "No items yet" flashing while the first fetch resolves | Four-state screens (see `expo-data-fetching`): loading ≠ empty, keep stale content while revalidating, `RefreshControl`, skeletons past ~300ms |
| 20 | **Keyboard Blindness** | The focused input or the submit button disappears behind the keyboard; buttons above a keyboard need two taps | `react-native-keyboard-controller` tracks the real keyboard frame (`expo-animation` keyboard recipe); `keyboardShouldPersistTaps="always"` |

## Grep the greppable tells

Same shell-variable convention as `audit.md` (set `$SRC` and `$THEME` first, run from the repo root). Three hit classes:

- **always-fix** - a hit is a defect; no judgment needed.
- **review-each** - legitimate uses exist; check each hit against the tell's description.
- **advisory** - hits only suggest the tell; confirm on a screenshot.

```bash
# --- always-fix ---
# Touchable* anywhere → #13 The Squish Reflex (Pressable only)
grep -rn 'TouchableOpacity\|TouchableHighlight\|TouchableWithoutFeedback' $SRC --include='*.tsx'

# fontFamily outside the theme → #6 Inter Everywhere
grep -rn 'fontFamily:' $SRC --include='*.tsx' | grep -v "^$THEME/"

# --- review-each ---
# RN <Modal> for picking/composing/confirming → #1 The Web Modal
grep -rn '<Modal' $SRC --include='*.tsx'

# Alert.alert → #10 alert() Confirmation
grep -rn 'Alert\.alert' $SRC --include='*.tsx'

# Gradient blocks in screens → #4 The Purple-Gradient Hero
grep -rn 'LinearGradient\|experimental_backgroundImage' $SRC --include='*.tsx'

# Rebuilt navigation chrome → #11 The Hand-Rolled Header
grep -rn 'headerShown:\s*false' $SRC --include='*.tsx'

# Custom tab bar chrome → #5 The Floating Pill Tab Bar
grep -rn 'tabBarStyle' $SRC --include='*.tsx'

# 1px outlines on containers → #9 Wireframe Borders (inputs may keep theirs)
grep -rn 'borderWidth' $SRC --include='*.tsx'

# Entrance animations on routine screens → #14 The Grand Entrance (check expo-animation's frequency gate)
grep -rn 'entering={' $SRC --include='*.tsx'

# Full-screen spinners between states → #19 The Spinner Blink
grep -rn 'ActivityIndicator' $SRC --include='*.tsx'

# Hand-patched notch/status-bar offsets → #17 Safe-Area Collision
grep -rEn '(margin|padding)Top:\s*[4-6][0-9]' $SRC --include='*.tsx'

# --- advisory ---
# Emoji as UI glyphs → #3 Emoji Iconography (content strings may contain emoji; glyph-as-icon is the tell)
# \x{FE0F} catches text-default emoji rendered emoji-style (⚙️ ❤️), which Emoji_Presentation alone misses
rg -n '[\p{Emoji_Presentation}\x{FE0F}]' $SRC -g '*.tsx'
```

Already covered by `audit.md` §1 - run both: hardcoded hex → #18 Dark-Mode Amnesia; off-scale spacing → #12 16-Everything; legacy shadow props → #8 Shadowboxing.

Screenshot-only tells (no useful grep): #2 X-Button Sheet, #7 Everything's a Card, #15 Onboarding Carousel, #16 Cross-Platform Costume, #20 Keyboard Blindness. Check these visually per `SKILL.md`'s Self-Critique Pass - #20 with the keyboard open, #16 on both platforms.

## Growing the list

A new tell earns its place only after the same failure appears repeatedly across generations - one model's one-off quirk stays out until it repeats. Keep the list near 20 entries: recognition degrades with length.
