# Config recipes

Copy-paste files for app variants.

Pick one config recipe based on what the project already has, then one storage recipe based on whether `APP_VARIANT` lives in an EAS environment. If the project already has a working variant setup, take the individual helpers you need instead of replacing its config.

**Variant count and names are the project's.** Add or remove a `case` per variant. See "Custom variant names" for other names or a longer list.

## Which config layout

| Project has | Use |
| --- | --- |
| `app.config.ts` or `app.config.js` already | Add the helpers to it. Recipe 1's helpers work as-is |
| Only `app.json` | Recipe 1 — `app.config.ts` beside it, `app.json` stays the base layer |
| Only `app.json`, and wants a single config file | Recipe 2 — move the values into `app.config.ts`, delete `app.json` |

Both layouts are complete setups. `app.json` beside `app.config.ts` is the recommended default — Expo tooling writes generated values into a static config automatically. Do not argue with a project that prefers the single dynamic config.

---

## Recipe 1: `app.config.ts` alongside `app.json`

### `app.json` (base layer)

Stable values live here.

```json
{
  "expo": {
    "name": "MyApp",
    "slug": "my-app",
    "owner": "your-org",
    "version": "1.0.0",
    "icon": "./assets/images/icon.png",
    "ios": {
      "bundleIdentifier": "com.myapp"
    },
    "android": {
      "package": "com.myapp",
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "backgroundColor": "#E6F4FE"
      }
    }
  }
}
```

### `app.config.ts` (overrides)

Must export a **function** so `app.json` is read first and passed in. Every level that is touched is spread first — dropping a spread is the most common way this setup breaks.

```ts
import { ExpoConfig, ConfigContext } from "expo/config";

const APP_ID_PREFIX = "com.myapp";

function getAppId() {
  switch (process.env.APP_VARIANT) {
    case "production":
      return APP_ID_PREFIX;
    case "preview":
      return `${APP_ID_PREFIX}.preview`;
    default:
      return `${APP_ID_PREFIX}.dev`;
  }
}

function getName(base: string) {
  switch (process.env.APP_VARIANT) {
    case "production":
      return base;
    case "preview":
      return `${base} (Preview)`;
    default:
      return `${base} (Dev)`;
  }
}

function getIcon() {
  switch (process.env.APP_VARIANT) {
    case "production":
      return undefined; // production keeps the icons from app.json
    case "preview":
      return "./assets/images/icon-preview.png";
    default:
      return "./assets/images/icon-dev.png";
  }
}

const icon = getIcon();

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  slug: config.slug ?? "my-app",
  name: getName(config.name ?? "MyApp"),
  icon: icon ?? config.icon,
  ios: {
    ...config.ios,
    bundleIdentifier: getAppId(),
    icon: icon ?? config.ios?.icon,
  },
  android: {
    ...config.android,
    package: getAppId(),
    icon: icon ?? config.android?.icon,
    adaptiveIcon: {
      ...config.android?.adaptiveIcon,
      foregroundImage: icon ?? config.android?.adaptiveIcon?.foregroundImage,
    },
  },
  plugins: [
    ...(config.plugins ?? []),
    ["expo-dev-client", { addGeneratedScheme: process.env.APP_VARIANT === "development" }],
  ],
});
```

Notes:

- **`slug` and `name` need fallbacks.** `ConfigContext.config` is a `Partial<ExpoConfig>`, so both arrive as `string | undefined`, while the declared `ExpoConfig` return type requires them. Under the `strict: true` that Expo templates ship with, `...config` alone is a type error on `slug`. Verified against `@expo/config` on SDK 56. `app.json` supplies the real values at runtime, so the fallback never applies — it exists to satisfy the type.
- `icon ?? config.icon` keeps the type as `string`. Assigning `undefined` directly would widen it.
- One `APP_ID_PREFIX` assumes iOS and Android share an identifier. When the project's `ios.bundleIdentifier` and `android.package` differ, use two constants and keep each platform's existing value — never unify them.
- When one platform has no identifier at all, delete that platform's block from the recipe. An `app.json` with `ios.bundleIdentifier` and no `android.package` keeps only the `ios` block, and `...config` carries Android through untouched. Leaving `package: getAppId()` in place would invent an Android identity.
- If `expo-dev-client` is already listed in `app.json` `plugins`, remove it there rather than adding a second entry here. With two entries the plugin is applied twice, with conflicting options.
- The `expo-dev-client` plugin entry assumes the package is installed. Remove the entry if the project does not use a dev client — prebuild fails when a listed plugin cannot be resolved.
- `APP_VARIANT` stays a config-time variable on purpose. App code should read the environment's values (`EXPO_PUBLIC_*` variables), not the variant name. See `troubleshooting.md` if the user wants to show the variant inside the app.

---

## Recipe 2: `app.config.ts` as the only config

No `app.json`, so nothing is passed in and nothing needs spreading. Export the config directly.

```ts
import { ExpoConfig } from "expo/config";

const APP_ID_PREFIX = "com.myapp";

function getAppId() {
  switch (process.env.APP_VARIANT) {
    case "production":
      return APP_ID_PREFIX;
    case "preview":
      return `${APP_ID_PREFIX}.preview`;
    default:
      return `${APP_ID_PREFIX}.dev`;
  }
}

function getName() {
  switch (process.env.APP_VARIANT) {
    case "production":
      return "MyApp";
    case "preview":
      return "MyApp (Preview)";
    default:
      return "MyApp (Dev)";
  }
}

function getIcon() {
  switch (process.env.APP_VARIANT) {
    case "preview":
      return "./assets/images/icon-preview.png";
    case "development":
      return "./assets/images/icon-dev.png";
    default:
      return "./assets/images/icon.png";
  }
}

const config: ExpoConfig = {
  name: getName(),
  slug: "my-app",
  version: "1.0.0",
  icon: getIcon(),
  ios: {
    bundleIdentifier: getAppId(),
    icon: getIcon(),
  },
  android: {
    package: getAppId(),
    adaptiveIcon: {
      foregroundImage: getIcon(),
      backgroundColor: "#E6F4FE",
    },
  },
  plugins: [
    "expo-router", // keep the project's existing plugins — this one is illustrative
    ["expo-dev-client", { addGeneratedScheme: process.env.APP_VARIANT === "development" }],
  ],
  // the rest of your app config....
};

export default config;
```

A plain object export is fine here. It only becomes a problem when an `app.json` exists, because Expo then ignores the static file. `getIcon()` returns a real path in every branch, since there is no `app.json` icon to fall through to.

An exported function also works and gives access to `ConfigContext` for `projectRoot` and friends: `export default (_: ConfigContext): ExpoConfig => config;`

---

## Custom variant names

Custom names are the same switch helpers with different `case` labels. Rename the cases, keep the `default` landing on the development identity, and add one `case` per extra variant — a set with `staging` or `qa` needs no special form.

Remember that only `development`, `preview`, and `production` are built-in EAS environments; custom environments need a Production or Enterprise plan. The names are a mapping, not an equality: a `staging` variant can map to the built-in `preview` environment, and publishing then names the mapped pair — `eas update --channel staging --environment preview`. Each environment holds one `APP_VARIANT` value, so without custom environments at most three variants can store their value on EAS.

---

## Storing `APP_VARIANT` with EAS environments (recommended)

### Create the variables

```sh
eas env:set --name APP_VARIANT --value development --environment development --visibility plaintext
eas env:set --name APP_VARIANT --value preview     --environment preview     --visibility plaintext
eas env:set --name APP_VARIANT --value production  --environment production  --visibility plaintext
```

`--visibility plaintext` is right for a variant name. Use `sensitive` or `secret` for keys. `env:set` creates or updates, so re-running it changes an existing value.

### `eas.json`

```json
{
  "cli": { "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "environment": "development"
    },
    "preview": {
      "distribution": "internal",
      "environment": "preview"
    },
    "production": {
      "autoIncrement": true,
      "environment": "production"
    }
  },
  "submit": { "production": {} }
}
```

No `channel` fields here on purpose — for projects that use EAS Update, `eas update:configure` adds them to the `preview` and `production` profiles, and Step 5 aligns each `channel` with its `environment`. Include `developmentClient: true` only when `expo-dev-client` is installed; without it, interactive builds prompt to install the package and non-interactive (CI) builds fail.

### Local use

```sh
# write the environment's variables to .env.local
eas env:pull --environment development
```

`eas env:pull` writes `.env.local` by default; `--path` changes that. Keep generated `.env` files gitignored, per the EAS docs — most Expo templates already ignore `.env*.local`. To work on another variant, pull that variant's environment and restart the dev server. Regenerate with `npx expo prebuild --clean` only when the local native project itself should switch identity — see `runtime-and-environments.md`.

The pull **replaces** the file. Read an existing `.env.local` first and account for every key: keys that live only in that file are gone afterwards. The remedy is to store them in the environment with `eas env:set`, so the pull returns them every time.

### Publishing updates

```sh
eas update --channel preview --environment preview
```

---

## Storing `APP_VARIANT` without EAS environments

### `eas.json`

```json
{
  "cli": { "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "APP_VARIANT": "development" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "APP_VARIANT": "preview" }
    },
    "production": {
      "autoIncrement": true,
      "env": { "APP_VARIANT": "production" }
    }
  },
  "submit": { "production": {} }
}
```

The `env` block applies only to `eas build` — `eas update` and local commands never read it (see the scripts below and Step 5). No `channel` fields here on purpose — for projects that use EAS Update, `eas update:configure` adds them to the `preview` and `production` profiles. Include `developmentClient: true` only when `expo-dev-client` is installed; without it, interactive builds prompt to install the package and non-interactive (CI) builds fail. A profile that uses `extends` inherits `env`, so `development-simulator` extending `development` needs no `env` of its own.

### Local commands: `.env.local`

```sh
# .env.local — gitignored in Expo templates
APP_VARIANT=development
```

Local commands that evaluate the config (`expo start`, `expo run`, `expo prebuild`) read this file automatically. A missing file falls through to the development identity, so day-to-day work needs no file at all. Edit the value to switch variants, then `npx expo prebuild --clean` when the native project should change identity.

Never use inline `APP_VARIANT=value` command prefixes — they fail on Windows `cmd.exe`, and the env file keeps the variant in one visible place.

No update scripts here on purpose. On SDK 55 or later, `eas update` requires `--environment` and then reads only EAS environment variables, so publishing updates needs `APP_VARIANT` stored on EAS — see the storage recipe above. On SDK 54 or earlier, set the value in `.env.local` before publishing.

---

## Building locally

Set the variant in `.env.local`, then regenerate and run:

```sh
npx expo prebuild --clean
npx expo run:[platform]
```

With EAS environments, pull instead of editing by hand — it writes the same `.env.local`:

```sh
eas env:pull --environment development
npx expo prebuild --clean
```

Note: with `expo-dev-client` installed, every local debug build embeds the dev client. A preview or production variant built with plain `npx expo run:ios` still opens with the dev menu. That comes from the build configuration, not from the variant setup.

For a production-like local build — Release configuration, JS embedded, no dev client UI:

```sh
# iOS
npx expo run:ios --configuration Release
# Android
npx expo run:android --variant release
```
