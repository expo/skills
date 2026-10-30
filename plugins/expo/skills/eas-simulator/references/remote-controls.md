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

In released CLIs (through 27.2.0), quoting or `--` does not make a recognized
`name=value` token literal text. Avoid that parser shape when transferring exact
text. Do not use unreleased interactive, import, or local `.app` folder upload
syntax.

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
`--expo-go` for installation. `app.install` uploads one local file and runs
`simctl install` on it. Pass an `.ipa` that contains a Simulator build; a
device build does not install. The CLI rejects a `.app` folder, so package it
first:

```bash
mkdir Payload && cp -R MyApp.app Payload/ && zip -qry MyApp.ipa Payload
npx --yes eas-cli@latest simulator:control app.install ./MyApp.ipa --id <session-id>
```

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
