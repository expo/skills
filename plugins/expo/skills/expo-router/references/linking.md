# Deep Linking: Schemes, Universal Links, and App Links

Expo Router deep links every route automatically: the URL path is the route path, on cold start
and while running. Do not write a `linking` config, `prefixes`, or a `NavigationContainer` — that
is React Navigation setup. In SDK 56+ expo-router no longer depends on React Navigation; migrate
old linking code with `npx expo-codemod sdk-56-expo-router-react-navigation-replace ./src` and
import any remaining React Navigation APIs from `expo-router/react-navigation`.

Add `app/+not-found.tsx` so unmatched deep links land on a graceful screen instead of an error.

Everything below is native config: rebuild the development build after each change
(`npx expo run:ios` / `run:android` or EAS Build). Expo Go only handles `exp://` links with
limited behavior — never test scheme or universal-link changes in Expo Go.

## Custom scheme (myapp://)

```json
{ "expo": { "scheme": "myapp" } }
```

Prebuild generates the iOS `CFBundleURLTypes` entry and the Android intent filter — do not add
the custom scheme to `intentFilters` yourself.

Reading the URL in JS is rarely needed (the router navigates for you). When it is, use
`expo-linking`: `useLinkingURL()` (preferred over `useURL()`) for the current URL,
`Linking.createURL(path)` to build outgoing URLs (OAuth redirect URIs — correct in dev builds and
Expo Go), `Linking.parse(url)` for components. `Linking.makeUrl` no longer exists.

## iOS Universal Links (https:// opens the app)

1. Host an `apple-app-site-association` file (no extension, HTTPS, 200 without redirects,
   `application/json` content type, ≤128KB) at
   `https://<domain>/.well-known/apple-app-site-association`. With Expo Router web / EAS Hosting,
   put it in `public/.well-known/`. Check with `curl -i` — some hosts serve extensionless files
   with the wrong content type.

```json
{
  "applinks": {
    "details": [{ "appIDs": ["<TEAM_ID>.<bundleIdentifier>"], "components": [{ "/": "/records/*" }] }]
  }
}
```

2. Add associated domains to app config — no `https://` prefix (most common mistake):

```json
{ "expo": { "ios": { "associatedDomains": ["applinks:example.com"] } } }
```

3. EAS Build registers the `com.apple.developer.associated-domains` entitlement automatically
   (requires a paid Apple Developer account). Bare projects without CNG add it to the
   `.entitlements` file manually.
4. iOS fetches the AASA on install — real devices go through Apple's CDN, which caches for hours,
   so AASA changes are not instant. During development, reinstall the app after AASA changes.
   `npx setup-safari` can bootstrap the Apple-side registration.

## Android App Links (https:// opens the app)

1. Add a verified intent filter to app config — `autoVerify: true` is required:

```json
{
  "expo": {
    "android": {
      "intentFilters": [{
        "action": "VIEW",
        "autoVerify": true,
        "data": [{ "scheme": "https", "host": "example.com", "pathPrefix": "/records" }],
        "category": ["BROWSABLE", "DEFAULT"]
      }]
    }
  }
}
```

2. Host `https://<domain>/.well-known/assetlinks.json` (`public/.well-known/` on Expo Router web):

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "<androidPackage>",
    "sha256_cert_fingerprints": ["<SHA256>"]
  }
}]
```

3. List every signing key's fingerprint: `eas credentials -p android` (SHA256 Fingerprint), the
   Play Console App Signing key when Play manages signing, and for local debug builds
   `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`
   — without the debug fingerprint, verification fails for `expo run:android` builds.
4. Verification after install can take 20+ seconds. On Android 12+, check it with
   `adb shell pm get-app-links <androidPackage>` (expect `verified`).

## Rewriting incoming URLs

To normalize third-party or legacy URLs before the router sees them, create `app/+native-intent.tsx`:

```tsx
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (path.startsWith('/legacy/')) return path.replace('/legacy/', '/records/');
  return path;
}
```

## Testing

```sh
npx uri-scheme open "myapp://records/12" --ios      # or --android
xcrun simctl openurl booted "https://example.com/records/12"
adb shell am start -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d "https://example.com/records/12"
```

Universal/App links only open the app from real taps (Notes, Messages, another app) — typing the
URL in Safari's address bar intentionally shows a banner instead; that is not a broken setup.

For current SDK details beyond this file, consult the Expo docs MCP server bundled with this
plugin (search for "universal links", "app links", or "linking").
