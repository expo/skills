# Design Foundations

Why the styling rules in `SKILL.md` are what they are, and the usability decisions they don't cover.

Use these as the vocabulary for defending a decision: **purpose** (was this worth building), **agency** (is
the user in control), **familiarity** (does it behave like the platform), **simplicity** (does every element
earn its place), **craft** (is every value deliberate). "It looks better" is not a reason; "it's the platform
convention and the alternative costs a tap" is.

## Feedback

Four kinds, and a screen usually needs more than one: **status** (something is happening), **completion**
(it worked), **warning** (this will cost you), **error** (it failed, here's why).

- **Fire on press, not on release.** Highlighting only on `onPress` feels dead. The moment lag appears,
  the sense of directness collapses.
- **Feedback is continuous during an interaction, not just at the end.** A drag, a slider, a sheet must
  track the finger the whole way — never animate only once the gesture completes.
- **Validate inline, not on submit.** Telling someone their password was wrong after they filled six fields
  is a design failure.
- **Confirm meaningful actions; don't confirm everything.** A confirmation dialog belongs on genuinely
  destructive, irreversible actions only. Used everywhere, it trains people to tap through it — at which
  point it protects nothing. Prefer easy undo over asking first.
- Audit every artificial delay on the input path: debounces, minimum spinner durations, transition waits.
  Each is latency you chose.

## Wayfinding

Every screen answers four questions. If one has no answer, the screen is broken:

- Where am I? — a stack title, not a custom `<Text>` heading
- Where can I go?
- What's there?
- How do I get out? — never trap the user with no back affordance

Related to this: **proximity implies relationship.** Put a control next to the thing it affects, and arrange
controls to mirror what they change. If you need a label to explain what a control does, the mapping is weak.
Name navigation items for their contents ("Library", "Progress"), not vague umbrellas ("Home") — specificity
is what makes an app predictable.

## Typography

- **Tracking is size-specific — one `letterSpacing` for all sizes is wrong somewhere.** Large display text
  needs *negative* tracking (letters read too far apart as they grow); body text sits near `0`; small text
  can take a slight positive value for legibility.
- **Leading moves inversely with size.** Tight `lineHeight` on large headings, looser on body copy. Tighten
  it for dense, information-heavy UI.
- **Build hierarchy from weight, size, and leading together**, not size alone. Weight adds presence without
  taking more space.
- **Respect the user's text-size setting.** Scale spacing with the text rather than pinning it to fixed
  values, so a larger font doesn't break the layout.
- **Default to the system font.** It already ships optical sizing, tracking tables, and legibility tuning.
  Override only with a reason.
- Counters, timers, and any changing number get `{ fontVariant: 'tabular-nums' }` so digits don't shift.

```tsx
<Text style={{ fontSize: 34, lineHeight: 40, letterSpacing: -0.4, fontWeight: "700" }}>
  Large title
</Text>
<Text style={{ fontSize: 17, lineHeight: 24 }}>Body copy sits near zero tracking.</Text>
```

## Materials and depth

Translucency is a functional layer that conveys hierarchy without stealing focus. Use `expo-glass-effect`
for liquid glass and `expo-blur` for blur — details in `visual-effects.md`.

- **Build nav bars, toolbars, and sheets as translucent layers with content scrolling underneath**, not as
  opaque bars that consume a fixed strip of the screen.
- **Material weight encodes hierarchy.** Heavier, darker materials separate structural regions; lighter
  materials draw attention to interactive elements.
- **Never stack a light translucent surface on another light translucent surface.** Legibility collapses.
- **Bigger surfaces should read as thicker** — stronger blur and a deeper shadow than a small chip.
- **Dim to focus, separate to keep flow.** A modal task pairs its surface with a dimming scrim and pushes
  the background back. A parallel, non-blocking panel uses translucency and offset *without* a scrim, so the
  flow isn't interrupted. For stacked sheets, progressively dim each parent layer.
- **Keep text legible over changing backgrounds.** Over a translucent surface, don't use flat grey text —
  raise contrast, go slightly heavier, and put color on a solid layer rather than the translucent foreground.
- **Prefer a scroll edge effect over a 1px divider.** Fade a small blur or gradient where content meets
  floating chrome, and only where the chrome actually overlaps content.
- **Materialize, don't just fade.** When a glass surface enters, animate blur and scale together so it reads
  as a real material arriving rather than an opacity ramp.

## Accessibility

- **Tap targets at least 44pt.** If the visual is smaller, extend the touch area with `hitSlop`.
- **Never signal interactivity with color alone** — pair it with shape, weight, an icon, or a label.
- **Contrast**: aim for WCAG AA on body text. The `Color` semantic palette handles this across light, dark,
  and increased-contrast automatically, which is most of why to use it.
- **Reduced motion means gentler, not zero.** Keep opacity and color changes that aid comprehension; drop
  movement, parallax, and overshoot. See the accessibility section of the `expo-motion` skill's `animations.md`.
- **Reduced transparency**: raise background opacity and drop the blur rather than shipping an unreadable
  frosted surface.
- Give every icon-only control an `accessibilityLabel`. An unlabeled icon button is invisible to a screen
  reader.
- Avoid full-screen moving backgrounds, slow looping oscillation (around one cycle per five seconds), and
  abrupt brightness jumps — ease theme changes instead.

## Restraint

- **Simplicity is not minimalism.** Burying everything one level deeper looks minimal and isn't simple.
  Strip what doesn't serve the purpose; show the common path first and put advanced options one level down.
- **Sometimes adding context simplifies.** A scrubber that shows time remaining has more on screen and is
  easier to use.
- **When unsure whether motion helps, delete it.** That is the most reliable improvement available, and the
  hardest to talk yourself into.
- **Decoration hinders functional, information-dense UI.** A playful effect is fine on an onboarding screen;
  data the user is trying to read or act on should not move for style.
- **Nothing is random.** Every spacing, timing, and alignment value should be one you can defend. Misaligned
  icons, jittery scroll, and layouts that break on rotation read as carelessness — which reads as
  untrustworthy.

## Verify with real content

Check every screen against: the longest realistic string, an empty state, a loading state, an error state,
and the largest system text size. Most layout bugs that ship were only ever tested with one short label and
a full data set.
