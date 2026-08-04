# How the environment reaches a running app

Identity is fixed at build time; the environment is not. A build can report a variant it was not built as, with no error.

## A dev build follows the dev server

A build without `expo-dev-client` reports the config it was built with — or, with EAS Update, the last update it received, which is the Step 5 mismatch case.

A development build instead downloads its config from the dev server each time it opens the project. So the dev menu can read "MyApp (Preview)" on a build whose identity is dev. Nothing is broken — the name came from the server, which runs under a different `APP_VARIANT`. Match the server to the build:

```sh
eas env:pull --environment development   # or edit .env.local
npx expo start
```

## Why `process.env.APP_VARIANT` is `undefined` in app code

`APP_VARIANT` has no `EXPO_PUBLIC_` prefix, so it exists only while the config is evaluated and never reaches the JS bundle. App code should read the environment's values (`EXPO_PUBLIC_*` variables), not the variant name.

If the user really wants to print the variant inside the app, add a parallel `EXPO_PUBLIC_APP_VARIANT` variable with the same value in each environment and read `process.env.EXPO_PUBLIC_APP_VARIANT` directly. `EXPO_PUBLIC_` variables are inlined at bundle time: served from a dev server they track the server's environment, while a release build bakes them in.

## Local native projects and CNG

CNG (Continuous Native Generation) generates the native projects on demand from the app config, `package.json`, and other inputs, instead of committing them. EAS Build works the same way and regenerates from scratch for every build, so switching variants never leaves anything stale in the cloud.

Locally it can. Two consequences:

1. **The identity on disk wins.** After `npx expo prebuild` or `npx expo run:*`, the native project holds one variant's identity. Switching variants requires setting the variant in `.env.local` (or pulling the matching EAS environment), then regenerating:

   ```sh
   npx expo prebuild --clean
   ```

2. **`expo start` takes its launch scheme from the native project on disk**, not from `APP_VARIANT`. So building another variant locally can leave the next `expo start` pointing at the wrong app. Switch back before the next dev session — set `APP_VARIANT=development` in `.env.local`, or run `eas env:pull --environment development`, then:

   ```sh
   npx expo prebuild --clean
   ```

If every other variant is built remotely and the local native project stays on development, this does not come up.
