# Add mascot idle motion

Run the [Rive CLI setup check](./set-up-rive-project.md#check-the-cli). Inspect the target project and identify its artboard, state machine, neutral pose, and existing outfit bindings.

## Animate the rig

1. Author or update one looping `LinearAnimation` named exactly `idle`. Read `rive docs easing` and `rive docs state-machines` for the installed CLI's keyframe and state-machine syntax. Preserve the project's names, IDs, outfit bindings, and other actions.
2. Use the supplied motion reference when available. Start from the neutral pose. Key a visible but gentle rise and fall through the torso, then let the head and arms follow slightly later. Let the knees flex while the feet stay planted. Add ear or tail follow-through where the design supports it. Place attachments on the same moving joints as the body parts they follow.
3. Match the pose and motion at the loop boundary. Ease the breathing through its peaks and tune the timing at the mascot's intended display size.
4. Connect `idle` to the intended state machine so it plays from its default entry or returns from existing actions as appropriate. Edit the existing idle path in place where possible. Inspect the animation name, loop setting, and state transition after validating the project.

For an onboarding gesture such as a dog giving paw, put the raised forepaw on its own layer with a shoulder pivot. Draw the shoulder and torso underneath so lifting the paw reveals continuous artwork. Key the lift, hold, and return to the neutral pose. Check the exposed shoulder and any sleeve at the top of the lift. For a one-time greeting, use a separate animation that returns to `idle`.

## Capture and check playback

Capture at least two consecutive cycles from real state-machine playback. Use `rive "$project" --verify` and `rive inspect "$project" --artboard="$artboard" --json` to find the requested state machine's ID on that artboard. The CLI's `--artboard` flag selects the artboard, and playback uses its `defaultStateMachineId`. If the requested machine differs from the default, copy the project and its referenced assets into the capture directory, preserving their relative paths. On the copy, set the selected artboard's `defaultStateMachineId` to the requested machine's ID. Use this copy for capture and the authored project for export.

Set `project` to the authored project, `artboard` to the artboard name, and `idle_mp4` to an output path outside the capture directory. Verify the capture project before collecting frames with `--commands`. Each `advance 1` steps 1/60 second. Pick the frame count from the actual loop duration. With FFmpeg installed, this Bash example captures two 3-second cycles on macOS or Linux and removes the temporary copy, frames, and logs when the subshell exits.

```bash
(
  set -e
  capture_dir=$(mktemp -d /tmp/rive-idle.XXXXXX)
  trap 'rm -rf -- "$capture_dir"' EXIT

  capture_project="$project"
  # If needed, prepare the copy under "$capture_dir" and set capture_project to it here.
  rive "$capture_project" --verify

  frames=360
  for (( frame=0; frame<frames; frame++ )); do
    printf 'advance 1\nscreenshot %s/frame-%04d.png\n' "$capture_dir" "$frame"
  done > "$capture_dir/commands.txt"
  if ! rive "$capture_project" --artboard="$artboard" --viewport=640x640 --fit=contain \
    --commands="$capture_dir/commands.txt" > "$capture_dir/capture.log" ||
    grep -q '^err ' "$capture_dir/capture.log"; then
    cat "$capture_dir/capture.log" >&2
    exit 1
  fi
  ffmpeg -n -framerate 60 -i "$capture_dir/frame-%04d.png" \
    -c:v libx264 -pix_fmt yuv420p -movflags +faststart "$idle_mp4"
)
```

Verify the frame count and duration of the encoded clip. If you use a screen recorder instead, record the actual Rive preview over two full loops and remove the capture directory when done. Watch the clip and inspect the neutral pose, breathing extremes, and loop boundary. Look for foot drift, exposed mesh seams, clipping, and outfit pieces that lag behind their attachment. The video frame rate describes the recording. Measure playback separately if the user asks for device performance.

Export the updated asset using the [Rive export steps](./set-up-rive-project.md#export-and-return-the-editor-link). Return the updated asset and the playable MP4. If the user named an Expo screen, [add the mascot to that screen](./add-to-expo-screen.md) and verify playback there.
