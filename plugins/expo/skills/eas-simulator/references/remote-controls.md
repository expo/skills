# Direct controls on an iOS session

Use **eas-cli 25.3.0+** with a running iOS session whose preview host has an action
catalog (serve-sim 0.10.0+). The command uses the authenticated session query, so
it works with private previews without `--public-link` or copying a token.
Android is not supported by `simulator:control`.

## Discover the host's actions

Run from the Expo project and pass the id of the session you are driving:

```bash
npx --yes eas-cli@latest simulator:control --id <session-id>
npx --yes eas-cli@latest simulator:control --id <session-id> --json
```

The JSON catalog contains descriptions, parameter types, required fields, and
positional argument order. Read the live catalog before using an action: a local
CLI upgrade does not upgrade an existing host. On CLI 27.0.0+,
`simulator:control <action> --help --id <session-id>` shows one action. On older
CLIs, per-action help has known bugs, so use the JSON catalog.

Arguments can be positional or `name=value`; arrays and objects use JSON.
The CLI binds actions to the selected session's Simulator. Do not pass a local
Simulator UDID. These are named actions, not an arbitrary remote shell or
`simctl` interface. Keep using agent-device or another selected controller for
UI-tree snapshots and element references.

In released CLIs (through 27.5.0), quoting or `--` does not make a recognized
`name=value` token literal text. To send exact text, put it in `params` in a
saved action file (see below), or avoid that parser shape. Do not use unreleased
interactive or local `.app` folder upload syntax.

## Screenshots and settings

```bash
npx --yes eas-cli@latest simulator:control screenshot.capture --output ./shot.png --id <session-id>
npx --yes eas-cli@latest simulator:control settings.status --id <session-id>
npx --yes eas-cli@latest simulator:control appearance.set dark --id <session-id>
npx --yes eas-cli@latest simulator:control reduceMotion.set on --id <session-id>
```

`--output` is a local destination. Without it, screenshots use a generated name
in the current directory. Choose a new filename if an existing file must be
preserved. Base64 file actions such as `app.file.read` require `--output`.

On serve-sim 0.10.4+, a screenshot follows the active display, including after a
Duo fold. To select a panel explicitly, use `display=<simctl-display-id>` only
with an actual screen ID from that device. The ID is positive; hinge angle or
panel order does not identify it. Inspect the saved image before reporting it.

## Text and clipboard

```bash
npx --yes eas-cli@latest simulator:control clipboard.write 'Hello 🌎' --id <session-id>
npx --yes eas-cli@latest simulator:control clipboard.paste --id <session-id>
npx --yes eas-cli@latest simulator:control clipboard.read --id <session-id> --json
```

`clipboard.write` changes the simulator pasteboard without typing. `paste`
pastes into the focused field, and `copy` copies the current selection before
reading it. Clipboard text can be sensitive; inspect only the output needed for
the task. Prefer clipboard transfer for Unicode; the `type` action uses the US
keyboard's ASCII keys, plus newline and tab.

## Apps and data files

Prefer the session-start flags `--build-id`, `--application-archive-url`, or
`--expo-go` for installation. `app.install` uploads one local file and
installs it. Pass a `.tar.gz` or `.tgz` that contains a Simulator `.app`. The
CLI rejects a `.app` folder, so package it first:

```bash
tar -czf MyApp.app.tar.gz -C ./build/Debug-iphonesimulator MyApp.app
npx --yes eas-cli@latest simulator:control app.install ./MyApp.app.tar.gz --id <session-id>
```

Since serve-sim 0.13.3, the host refuses every `.ipa` and `.zip`, even a
Simulator build, with "Device .ipa builds and .zip archives are not supported."
Older hosts accepted a Simulator `.ipa`. Read the `app.install` description in
the live catalog when the host version is unknown.

After installation, the catalog can expose `app.launch`, `app.stop`,
`app.openUrl`, permissions, and app data-file actions. For example, seed a
fixture that the app understands:

```bash
npx --yes eas-cli@latest simulator:control app.stop com.example.app --id <session-id>
npx --yes eas-cli@latest simulator:control app.file.upload com.example.app Documents/fixture.json ./fixture.json --id <session-id>
npx --yes eas-cli@latest simulator:control app.file.read com.example.app Documents/fixture.json --output ./downloaded-fixture.json --id <session-id>
npx --yes eas-cli@latest simulator:control app.launch com.example.app --id <session-id>
```

`app.launch` stops a running app before it starts it. With serve-sim 0.11.0+,
`restart=false` starts the app without stopping it; a running app then keeps its
old launch arguments.

Stop the app before changing its data; the file actions do not stop it for you.
`app.stop` fails if the app is already stopped, so check state before repeating
that step. Files live under that app's data container, not its installed bundle.
Paths are relative to the container; traversal, symlinks, and files over 10 MiB
are refused. Upload does not replace an existing file unless `overwrite=true`
is supplied. Several file writes are not a transaction. For SQLite, use a
consistent checkpointed database or matching database/WAL files with the app
stopped. Copying bytes does not create a backend login or Keychain identity.

Upload-enabled actions stage an existing local file. On CLI 27.0.0+, a missing
local path fails before the action is sent. For a file that is already on the
simulator host, pass `host:/absolute/path` to `app.install` or `media.add`; the
host accepts only its simulator, upload, and screenshot folders:

```bash
npx --yes eas-cli@latest simulator:control media.add ./fixture.png --id <session-id>
npx --yes eas-cli@latest simulator:control media.add host:/absolute/path/on/host.png --id <session-id>
```

`app.file.upload` accepts only local files. Older CLIs treat a missing absolute
path as a host path, so check which machine owns the path. `--output` always
names a local download. Keep transferred app data private.

## Run saved actions from a file

On CLI 27.5.0+, `--import <file>` runs actions from a JSON file over one
connection. The CLI checks every action against the live catalog first, runs
them in order, and stops at the first failure:

```json
{
  "version": 1,
  "actions": [
    { "action": "location.set", "params": { "lat": 49.2827, "lng": -123.1207 } },
    { "action": "appearance.set", "params": { "value": "dark" } },
    { "action": "screenshot.capture", "output": "./setup.png" }
  ]
}
```

```bash
npx --yes eas-cli@latest simulator:control --import ./simulator-control.json --id <session-id> --json
```

`params` uses the parameter names from the catalog. Do not set `params.udid`.
`file` names a local file to upload and `output` names a local download. Both
are relative to the JSON file, and the folder for `output` must exist. Paths in
`params` refer to the simulator host. `--import` cannot be combined with an
action, `--list`, or `--output`.

`params` values are sent exactly as written, so a file is the way to send text
that looks like `name=value`:

```json
{ "version": 1, "actions": [{ "action": "clipboard.write", "params": { "text": "mode=fast" } }] }
```

`simulator:start --import <file>` reads the same file. Its `start` object uses
CLI flag names without dashes, such as `platform`, `type`, `device`, `name`, and
`max-duration-minutes`. Flags on the command line override saved values; a
repeated flag such as `--tag` replaces the saved list. `start` cannot contain
`import`, `json`, or `non-interactive`. Pass `--name` on the command line to
name each run. After the session is ready,
the CLI runs the actions and prints a `setup.results` array with `--json`. If an
action fails, the CLI tries to stop the new session. Android sessions accept
`start` but not `actions`; set up an Android device with its controller. With `--egress local` and `--non-interactive`, start
without actions, connect with `simulator:egress`, then run
`simulator:control --import`.

## Keep the connection open

Without an open helper, each `simulator:control` call connects to the host
again. On CLI 27.5.0+ on macOS or Linux, a local helper keeps one connection
open, and later `simulator:control` calls for that session use it:

```bash
npx --yes eas-cli@latest simulator:control:connection open --id <session-id> --idle-timeout 300
npx --yes eas-cli@latest simulator:control appearance.set dark --id <session-id>
npx --yes eas-cli@latest simulator:control:connection status --id <session-id> --json
npx --yes eas-cli@latest simulator:control:connection close --id <session-id>
```

`simulator:control <action> --keep-alive` opens the helper with the action;
`--idle-timeout` then requires `--keep-alive`. The timeout is in seconds; the
default is 120. For a fixed list of actions, prefer `--import`. Keep the
connection open when each action depends on the result of the one before. Closing the helper does not
stop the session. Other processes that run as the same OS user can use an open
helper, so close it when the task ends.
