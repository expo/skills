# `status` and `dev --plan`, field by field

Reference for [`expo-agent-cli`](../SKILL.md). Everything below was read from `@expo/agent-cli` 1.0.0 on an SDK 57 project. Run `npx @expo/agent-cli help status` and `help dev` for the current flags.

## `status` - text lines and JSON keys

| Line | JSON | Meaning |
| --- | --- | --- |
| `project` | `project.name`, `project.sdkVersion`, `project.native` (`bare` / `cng`), `project.nativeDirs`, `project.usesDevClient`, `project.hasWeb`, `project.isExpoApp` | `sdkVersion` is the **installed** `expo` package. `native: bare` means `ios/` or `android/` is checked in; `cng` means prebuild generates them. `usesDevClient` is whether `expo-dev-client` is a dependency. `isExpoApp: false` means no `expo` dependency: every other command refuses this directory, `status` answers so you can find out. |
| `expo go` | `expoGo.compatible`, `expoGo.reasonCount`; reasons in `probe.expoGo.reasons[]` with `kind`, `packageName`, `detail` | Reason kinds: `unbundled-native-module` (the package ships `ios/`, `android/`, or a podspec and is not in `bundledNativeModules.json` for this SDK), `custom-native-code` (checked-in native directories), `config-plugin` (a plugin from a package Expo Go does not bundle), `unknown-sdk`. A config plugin from a package Expo Go bundles does **not** block Expo Go. |
| `freshness` | `freshness.hash`, `freshness.platforms[]` with `backend` (`local` / `eas`), `state` (`fresh` / `stale` / `unknown`), `detail`, `impact` | `local` compares against the build this CLI recorded in `.expo/agent-cli-last-build.json`; `eas` is only answered under `--explain` while signed in. `impact.class` is `js-only`, `dev-client-compatible`, or `needs-native-build`; `impact.reason` names the strongest finding. No recorded build reads `stale (no recorded build)`. |
| `impact` | same as above, headline only | Printed only when a build is recorded. |
| `dev server` | `devServer.url`, `running`, `ready`, `appsConnected`, `appsListed`, `appsStale`, `source` (`lock` / `default` / port scan), `projectRootMatched`, `hostType`, `tunnelUrl`, `openUrls[]` | `appsConnected` counts debugger targets whose socket still opens. `projectRootMatched: false` prints as `serves another project`. `openUrls` holds the encoded launcher URLs, best first. |
| `device` | `device.state` (`present` / `absent` / `unknown`), `device.platform`, `device.deviceId`, `device.name`, `device.devices[]` | The first device is what `navigate` and `smoke` drive. |
| `skills` | `skills.agentIds`, `skills.discovered`, `skills.linked` | Skills shipped inside installed packages as `skills/<name>/SKILL.md`. None of the SDK 57 packages shipped one at the time of writing. |
| `auth` | `auth.loggedIn`, `auth.user`, `auth.source` (`eas whoami` / `expo whoami` / `EXPO_TOKEN`) | `loggedIn: null` means nothing could answer, which is not "signed out". |
| `next` | `next.command`, `next.rule`, `next.target`, `next.steps[]`, `next.why`, `next.buildLocation` | When a dev server for this project is already running, `next` becomes `navigate /` (no app connected) or `smoke` (an app is connected) and `next.why` says so; `next.rule` still names the plan row. |
| `build` | `next.buildLocation` | Printed when the plan contains a build: `local` or `eas`, and what chose it. |
| `assert` | `assertion.asserted`, `actual`, `ok`, `exitCode`, `reason` | Only with `--assert <class>`. Exit `20` when the change costs more than the class, `22` when no class could be established. |

`--no-fingerprint-cache` hashes the project again instead of revalidating the cached hash. The cache cannot see inside `ios/` and `android/`, so its entries expire after ten minutes.

## The plan rules

`dev --plan` prints `Smart start plan (rule: <rule>, target: <target>)`, the steps with a time class (`seconds`, `a minute`, `minutes`, `many minutes`), and the reasons.

| Rule | When | Steps |
| --- | --- | --- |
| `not-expo-app` | no `expo` dependency | none; run `new <dir>` |
| `web` | `--web` | `expo start --web` |
| `expo-go` | Expo Go can run the project and nothing asked for a dev build | `expo start --go` (`--ios` / `--android` open Expo Go on a device, installing it if needed) |
| `needs-dev-client` | Expo Go cannot run it and `expo-dev-client` is not installed, or `--dev-client` / config asked for a dev build | `expo install expo-dev-client`, then a build |
| `dev-client-stale` | CNG project with `expo-dev-client`, fingerprint differs from the recorded build | `expo prebuild --platform <p>`, `expo run:<p>` (local) or `eas build --platform <p> --profile development` then `expo start --dev-client` (cloud) |
| `dev-client-fresh` | CNG project, recorded build matches | `expo start --dev-client` |
| `bare-stale` | checked-in native dirs, fingerprint differs or no recorded build | `expo run:<p>` |
| `bare-fresh` | checked-in native dirs, recorded build matches | `expo start --dev-client` |

Where the build runs, in precedence order: a flag (`--local` / `--eas`), then `expo.agentCli` in `package.json`, then a host that cannot have the toolchain at all (iOS on non-macOS), then the toolchain probe (no Xcode / no Android SDK pushes the build to EAS), then the default, local. A cloud plan on a project without `eas.json` adds `eas build:configure` first, and it needs a sign-in.

After a build the CLI ran, the fingerprint is written to `.expo/agent-cli-last-build.json`; the next plan becomes `*-fresh` and skips the build. Installing a native module flips it back to `*-stale`; removing the module returns it to `fresh`.

### `expo.agentCli` in `package.json`

```json
{
  "expo": {
    "agentCli": {
      "target": "dev-build",
      "buildBackend": "eas",
      "android": { "buildBackend": "local" }
    }
  }
}
```

`target` is `expo-go` or `dev-build`; `buildBackend` is `local` or `eas`, optionally per platform. A flag beats the config, the config beats detection. An unknown key is an error, not ignored.

## `install`

`install <pkg>` runs `expo install` (SDK-matched versions), links any skills the package ships, and reports per package: `impact` (`js-only`, `native-module`, `config-plugin`), `expoGoBundled`, `action` (`none`, `reload`, `prebuild-and-build`, `native-sync`), and `reasons` such as `ships an ios/ directory`, `ships a podspec`, `is listed in the app.json plugins`. `install --check` reports outdated packages and installs nothing. `expo install` flags are forwarded: `--fix`, `--check`, `--dev`, `--npm`, `--pnpm`, `--yarn`, `--bun`.

Note that `expo install` adds a package's config plugin to `app.json`. Removing the package with the package manager leaves that entry behind and `prebuild` then fails with `Failed to resolve plugin for module`.

## Error shape and the needs-human handoff

```json
{ "error": { "code": "EAS_LOGIN_REQUIRED", "message": "...", "suggestedCommand": "npx eas login",
  "needsHuman": { "scenario": "eas-login", "need": "Sign in to an Expo account on this machine.",
    "command": "npx eas login", "url": "https://expo.dev/settings/access-tokens",
    "unattendedEnv": ["EXPO_TOKEN"], "resumable": true, "detectedBy": "preflight" }, "data": null } }
```

Exit `7` always carries `needsHuman`. Codes seen in the CLI: `EAS_LOGIN_REQUIRED`, `EXPO_LOGIN_REQUIRED`, `APPLE_AUTH_REQUIRED`, `ASC_API_KEY_REQUIRED`, `IOS_CREDENTIALS_REQUIRED`, `ANDROID_KEYSTORE_REQUIRED`, `DEVICE_REGISTRATION_REQUIRED`, `EAS_PROFILE_REQUIRED`, `EAS_NEEDS_INPUT`, `EXPO_NEEDS_INPUT`, `LAUNCH_BROWSER_HANDOFF`, `MACOS_AUTOMATION_REQUIRED`, `NON_INTERACTIVE`. Exit `1` errors use `Try:`; `UNKNOWN_COMMAND` and `BAD_ARGS` are the usual ones.

## Other commands, in one line each

- `dev:logs --tail 50` reads what a `dev --detach` server printed (`.expo/dev/logs/dev-detached.log`); a server started in a terminal has no log.
- `dev:stop` signals the process named by the project's lock; `--port <n> --force` stops a server this CLI did not start.
- `typecheck --json` lists every diagnostic as `file`, `line`, `column`, `code`, `message`; a JavaScript project is `checked: false`, exit `0`.
- `doctor --json` gives `passed`, `failed`, `checks[]` with `issues` and `advice`, plus `raw`; `parse` says how well the prose was read.
- `inspect:build-log --file <log>` finds the failing phase and line in an `xcodebuild` or Gradle log by rule (`ios.swift.compile-error`, `android.kotlin.compile-error`, ...). No EAS build id yet: save the log and pass `--file`. A successful log reports `failure none located`.
- `inspect:config-plugins [--file infoPlist]` shows what the config plugins produced, from `expo config --type introspect`; experimental.
- `new <dir> [--name "<App>"] [--no-install] [--no-git]` runs `create-expo` with every prompt answered.
- `agents:setup` writes a managed block into `AGENTS.md` (project facts plus the command list) and links package skills into `.claude/skills` and `.agents/skills`. It never writes `CLAUDE.md`.
- `skills:list` / `skills:show <pkg>` / `skills:sync` / `skills:clean` manage skills shipped inside installed packages.
- `login`, `logout`, `whoami`, `register` forward to `eas-cli` / `expo`; both CLIs share `~/.expo/state.json`.
