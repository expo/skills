# Interruption & Hand-off Discipline

RECIPES.md covers single animations. This file covers what happens when the user acts *during* one — the second tap, the reopen mid-close, the element that moves from one container to another. Demos never exercise these paths; real sessions hit them constantly, and they are where motion that looked finished falls apart.

The organizing idea: **an animation is a live value with a target, not a scheduled event.** Every rule below follows from treating it that way. Imports and conventions are the same as RECIPES.md.

```js
const ARRIVE = { duration: 400, dampingRatio: 0.8 };  // arrivals may overshoot
const EXIT = { duration: 400, dampingRatio: 1 };      // exits never do
```

## Retarget, don't restart

When state flips mid-flight, write a new target into the *same* shared values. Never start a second animation on top, and never snap to a starting pose first — a spring continues from its current position and velocity, so retargeting is seamless by construction.

The mechanic that keeps this safe is a phase guard: an effect that animates on a state change must confirm the phase actually changed, because re-renders outnumber phase flips.

```jsx
const appliedPhase = useRef(null);

useEffect(() => {
  if (appliedPhase.current === phase) return;   // a re-render is not a phase change
  appliedPhase.current = phase;
  progress.set(withSpring(phase === 'open' ? 1 : 0, phase === 'open' ? ARRIVE : EXIT));
}, [phase]);
```

Without the guard, unrelated updates — an index shifting, a parent re-rendering — restart entrances on elements that were already on screen. With it, an interrupted element always ends up consistent with its current phase, however many times the phase flipped mid-animation.

## Removal rides the animation, never a timer

When something unmounts after its exit, the unmount signal comes from the animation itself:

```jsx
x.set(withTiming(-WIDTH, { duration: 200 }, (finished) => {
  if (finished) scheduleOnRN(remove, id);   // interrupted → finished is false → nothing fires
}));
```

Never `setTimeout(remove, 200)`. The timer and the animation are two clocks. Interrupt the exit — the user taps and the element retargets back on screen — and the animation obeys, but the timer keeps counting and then deletes something the user is looking at. A completion callback on the interrupted animation reports `finished: false` and does nothing.

When the trigger is a *value* landing rather than one animation finishing — a container collapsing to zero while other things ride it — watch the value:

```jsx
useAnimatedReaction(
  () => height.get() === 0,
  (landed, was) => { if (landed && !was) scheduleOnRN(dropRetained); }
);
```

A Reanimated spring lands *exactly* on its target, not near it, so the `===` comparison is the unmount moment — frame-accurate, and immune to the drift a duration-matched timer accumulates.

One distinction: a `setTimeout` may *start* a stage (see below), held in a ref so it can be cancelled. Timers may schedule beginnings; they never detect ends.

## A staged open is cancellable at every stage

When an open runs in stages — a glyph slides aside, a surface mounts a beat behind it — every stage must be individually cancellable, including one that hasn't started yet. Keep the pending stage in a ref; clear it on any dismiss and on unmount; and count "stage pending" as already open, so the second half of a fast double-tap dismisses instead of opening twice.

```jsx
const lead = useRef(null);
const clearLead = () => { if (lead.current) { clearTimeout(lead.current); lead.current = null; } };

const open = () => { lead.current = setTimeout(() => { lead.current = null; mountPanel(); }, 30); };
const dismiss = () => { clearLead(); /* retarget exits on whatever is mounted */ };

const onTriggerPress = () =>
  mode === 'closed' && lead.current === null ? open() : dismiss();   // pending counts as open

useEffect(() => clearLead, []);
```

The device test: double-tap the trigger as fast as you can, repeatedly. The surface must never arrive after the tap that dismissed it.

## What a surface shows outlives what it is

Model a switchable container with two pieces of state, not one: the **mode** (`closed | menu | photos`) and the **content** (`photos | camera`). Backing out flips mode immediately, but content keeps its last value through the exit — the outgoing pane is still on screen, crossfading away. Swap content at the moment of close and the other pane flashes through the fade. Content changes only when a new pane opens.

The list version of the same rule: when the last item is removed and its container collapses, React state is empty but the screen isn't yet. Keep a retained copy of the outgoing items rendered until the collapse lands (the `useAnimatedReaction` above), so the item rides the container down instead of vanishing a frame early and leaving an empty box to shrink.

```jsx
const [retained, setRetained] = useState(items);
useEffect(() => { if (items.length > 0) setRetained(items); }, [items]);
// render `retained`; drop it when the collapse lands, not when `items` empties
```

Two corollaries:

- **`closing` is a real state** — still mounted, still collapsing, neither open nor gone. Set a flag when the exit starts and clear it in the exit's completion, so the rest of the UI can react *during* the collapse (dim a backdrop, switch a material) instead of after the unmount.
- **Exit-then-remove splits its work across the two moments.** When one element leaves a group, promote the survivors synchronously — the leaver stops occupying its slot the instant the exit starts, so the stack reflows at once — and remove the leaver from state in its completion callback. Both at the start double-removes it visually; both at the end makes survivors wait out a fade that isn't theirs.

## Hand-offs happen in one commit

Moving an element between containers — a photo from a picker grid into a composer, a card from a list into a header — is the hardest pattern to keep honest, because the same pixels must appear exactly once per frame while ownership changes.

- **Fly a copy, not the original.** Render the moving element in a window-coordinate overlay. Nothing survives being owned by two coordinate spaces at once.
- **Cut the original, don't fade it.** On the frame the copy appears, the original goes to `opacity: 0` in the same commit. A fade shows two copies of the same element pulling apart — the one thing a hand-off can never show.
- **The landing is one synchronous React commit.** End the flight, reveal the real element at the destination, reset the source — one handler, no `await`, no timer between the halves. Anything async in the middle splits it into two commits, and the element double-exposes or blinks for a frame.

```jsx
const settle = () => {
  setFlights([]);            // copy unmounts…
  revealDestination(ids);    // …real element appears, same commit, no entering animation
  resetSource();
};
```

- **No entering animation on the real destination element.** The copy already performed the arrival; the swap underneath must be invisible. With `expo-image`, set `transition={0}` on both copy and destination — the bitmap is already decoded, and a decode fade would flash the swap.
- **Read a moving target live.** If the destination is itself animating — a strip still growing while the photo flies toward it — derive the flight's endpoint from the destination's shared values inside the worklet, every frame. A target captured at launch lands where the slot used to be.
- **Simultaneous picks fly together** on one progress value. Stagger encodes sequence, and a multi-select had none.
- **Departure and arrival share one clock.** The flight and the collapse it leaves behind run the same duration, so they read as one move coming apart rather than two events.

Verification is mechanical: screen-record the hand-off and step through it frame by frame. The element appears exactly once in every frame — never zero, never twice.

## Guard re-entry; freeze input under a flight

- **An exit must not start twice.** A tap on a backdrop that's already collapsing starts a second close on top of the first. Guard with a ref flag set synchronously at the first trigger, and set `pointerEvents="none"` on anything a flight or exit still covers.
- **A held element pauses its own clock.** A toast's auto-dismiss timer clears on touch-down and restarts on any release that didn't commit the dismissal — including a cancelled gesture. A timed disappearance under the user's finger reads as the app snatching it away.
- **Timers read live state through refs.** A three-second timer closes over a three-second-old render; when it fires it must consult the present, not the render it was born in.

## The checklist

Before calling interruptible motion done, on a device:

1. Double-tap the trigger as fast as possible — the surface never arrives after the dismissing tap.
2. Dismiss mid-open, reopen mid-dismiss — motion continues from where it is; nothing snaps to a pose first.
3. Remove the last item — it rides the collapsing container down; no flash of an empty box.
4. Back out of a pane mid-crossfade — the outgoing content stays itself; the other pane never shows through.
5. Frame-step a recording of any hand-off — the element appears exactly once in every frame.
6. Interrupt an exit, then wait — nothing disappears afterward; no timer was racing the animation.
