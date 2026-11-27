# Choose a device before starting

Use the server's current device catalog instead of guessing names or copying a static list:

```bash
npx --yes eas-cli@latest simulator:devices                         # both platforms
npx --yes eas-cli@latest simulator:devices --platform ios          # iPhones and iPads
npx --yes eas-cli@latest simulator:devices --platform android      # phones and tablets
npx --yes eas-cli@latest simulator:devices --json                  # identifiers and display names by platform
```

This read-only command requires an Expo login or `EXPO_TOKEN`, but no running session or linked project. Copy the exact `identifier` (the table's `--device value`) into `simulator:start --platform <ios|android> --device <identifier>`. Quote names containing spaces or parentheses. For example, use `--device "iPad mini (A17 Pro)"` on iOS or `--device pixel_tablet` on Android when listed.

**Omit `--device` to let the server choose its current default.** Do not hardcode a default or infer it from the first catalog entry. The CLI's JSON output contains `identifier` and `displayName`; it does not currently expose the API's `isDefault` field. A listed device is not a promise that it is pre-warmed or starts faster.

If `simulator:devices` is unrecognized, update the CLI and check `simulator:devices --help`. Do not create a session just to discover device names. For selecting a device at startup versus inspecting or targeting devices inside an existing session, see [run-your-app.md](./run-your-app.md#targeting-a-device--ipad-or-several-at-once).
