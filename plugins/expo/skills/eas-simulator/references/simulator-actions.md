# Simulator actions (iOS)

`simulator:control` runs direct actions on a running iOS session through its preview server. It works with every iOS session type, including `web-preview-only`, and with private links (no `--public-link` needed). It has no accessibility tree: to find and press elements by label, use the controller. Android sessions use the controller only.

```bash
npx --yes eas-cli@latest simulator:control --id <id> --json                # action catalog: descriptions, argument order, properties
npx --yes eas-cli@latest simulator:control app.launch --help --id <id>     # usage for one action
npx --yes eas-cli@latest simulator:control screenshot.capture --output ./screen.png --id <id>   # no open app needed
npx --yes eas-cli@latest simulator:control app.launch dev.example.app --id <id>                 # restart the app
npx --yes eas-cli@latest simulator:control app.openUrl dev.example.app 'myapp://profile/42' --id <id>   # deep link, no restart
npx --yes eas-cli@latest simulator:control appearance.set dark --id <id>
npx --yes eas-cli@latest simulator:control location.set 37.3349 -122.0090 --id <id>
```

- **Read the catalog first.** The session's serve-sim version supplies the actions, so an older session can have a different catalog; updating eas-cli does not change a running session. Run `simulator:control --id <id> --json` before you use an action that is not in the examples above.
- Other actions in the docs: `tap x y` and `gesture '<json>'` (coordinates from 0 to 1), `type` (ASCII only; for other text, `clipboard.write` then `clipboard.paste`), `rotate`, `button`, `media.add`, `app.stop`, `app.file.upload` / `app.file.list` / `app.file.read`, and `app.approveUrlScheme <bundleId> <scheme>` (approves a custom scheme so a `simctl openurl` link skips the "Open in" dialog).
- `app.install` uploads an **`.ipa`** with a simulator build. For a `.app` folder, put it in a `Payload` folder and zip that folder as `<App>.ipa`, or install it with the controller.
- Pass values that start with `--` after `--` (for example, `clipboard.write -- --text`). Quote URLs and JSON for the shell. Keep passwords and tokens out of command arguments.
- Run actions that change the device one at a time. If one times out, inspect the device before you retry: the action may already have run.
- `--import <file>` runs saved actions from a JSON file (`{"version": 1, "actions": [{"action": "appearance.set", "params": {"value": "dark"}}]}`). Actions run in order and stop on the first failure. `simulator:start --import <file>` reads the same file: its `start` object holds start flags by their CLI names, and its actions run after the session is ready. Android sessions accept the `start` options but not actions yet.
- Each command opens a connection. For many actions in a row, add `--keep-alive` (macOS and Linux). The connection closes after 120 seconds idle; change that with `--idle-timeout <seconds>`.
- Output files are overwritten. `--output` is a path on your computer, and its parent directory must exist.
