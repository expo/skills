# Add mascot idle motion

Run the [Rive CLI and sign-in checks](./set-up-rive-project.md#check-the-cli-and-sign-in). Inspect the target project and identify its artboard, state machine, neutral pose, and existing outfit bindings.

## Animate the rig

1. Author or update one looping `LinearAnimation` named exactly `idle`. Read `rive docs easing` and `rive docs state-machines` for the installed CLI's keyframe and state-machine syntax. Preserve the project's names, IDs, outfit bindings, and other actions.
2. Use the supplied motion reference when available. Start from the neutral pose. Key a visible but gentle rise and fall through the torso, then let the head and arms follow slightly later. Let the knees flex while the feet stay planted. Add ear or tail follow-through where the design supports it. Place attachments on the same moving joints as the body parts they follow.
3. Match the pose and motion at the loop boundary. Ease the breathing through its peaks and tune the timing at the mascot's intended display size.
4. Connect `idle` to the intended state machine so it plays from its default entry or returns from existing actions as appropriate. Edit the existing idle path in place where possible. Inspect the animation name, loop setting, and state transition after validating the project.

## Capture and check playback

Capture at least two consecutive cycles from real state-machine playback. Use `rive "$project" --verify` and `rive inspect "$project" --json`, then collect frames with `--commands`. Each `advance 1` steps 1/60 second. Pick the frame count from the actual loop duration. With FFmpeg installed, the following example captures two 3-second cycles on macOS or Linux. Set `project`, `artboard`, and the desired `idle_mp4` path first.

```bash
capture_dir=$(mktemp -d /tmp/rive-idle.XXXXXX)
frames=360
for (( frame=0; frame<frames; frame++ )); do
  printf 'advance 1\nscreenshot %s/frame-%04d.png\n' "$capture_dir" "$frame"
done > "$capture_dir/commands.txt"
rive "$project" --artboard="$artboard" --viewport=640x640 --fit=contain \
  --commands="$capture_dir/commands.txt" > "$capture_dir/capture.log"
ffmpeg -n -framerate 60 -i "$capture_dir/frame-%04d.png" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart "$idle_mp4"
```

Check the capture log for errors and verify the frame count and duration of the encoded clip. If you use a screen recorder instead, record the actual Rive preview over two full loops. Watch the clip and inspect the neutral pose, breathing extremes, and loop boundary. Look for foot drift, exposed mesh seams, clipping, and outfit pieces that lag behind their attachment. The video frame rate describes the recording. Measure playback separately if the user asks for device performance.

Export the updated asset using the [Rive export steps](./set-up-rive-project.md#export-and-return-the-editor-link). Return the updated asset and the playable MP4.
