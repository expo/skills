# App Store Metadata (EAS Metadata)

> Source: https://docs.expo.dev/eas/metadata/ — the canonical page. This reference adds only what the docs do not cover: workflow ordering, validation traps, and rejection-avoidance judgment. For the full `store.config.json` schema (all fields, advisory/age-rating keys, category and locale enums), consult https://docs.expo.dev/eas/metadata/schema/ instead of guessing values.

EAS Metadata manages the App Store listing from a `store.config.json` file at the project root instead of App Store Connect forms, with built-in validation that catches common rejection pitfalls before Apple does.

**Scope gotcha:** Preview status, **Apple App Store only**. There is no Google Play support — maintain the Play listing in the Play Console.

## Workflow (order matters)

1. Submit a binary first. For a new app, `eas metadata:push` fails with "Binary not found" until at least one build has been uploaded via `eas submit`.
2. `eas metadata:pull` — snapshots the live listing into `store.config.json`. Pull before editing so you do not clobber store state.
3. Edit the config, then `eas metadata:push`.

Entry command: `eas metadata` — run `eas metadata --help` for the current surface; subcommands vary by installed eas-cli version.

## Minimal config

```json
{
  "configVersion": 0,
  "apple": {
    "info": {
      "en-US": {
        "title": "App Name",
        "subtitle": "Tagline",
        "description": "Full app description...",
        "keywords": ["keyword1", "keyword2"],
        "privacyPolicyUrl": "https://example.com/privacy",
        "supportUrl": "https://example.com/support"
      }
    }
  }
}
```

Install the Expo Tools VS Code extension for schema autocomplete, inline validation, and quick fixes on `store.config.json`.

## Validation traps (error → cause → fix)

- **"Binary not found"** — new app with no uploaded build → run `eas submit` before `eas metadata:push`.
- **"Invalid keywords"** — combined length over 100 characters, spaces after commas, or duplicate words → keep total ≤100 chars, commas only, dedupe against title/subtitle (Apple counts each word once across fields).
- **"Description too long"** — over the 4000-character maximum → shorten.
- **`eas metadata:pull` does not update a JS config** — pull always writes the JSON file → import `store.config.json` from your `store.config.js`.

## Non-obvious behavior

- `promoText` is the only listing field Apple lets you change without shipping a new binary — use it for time-sensitive copy.
- Release behavior lives in the config: `release.automaticRelease` accepts `true` (release on approval), `false` (manual), or an RFC 3339 timestamp (scheduled). `release.phasedRelease: true` enables Apple's 7-day gradual rollout (1% → 100%).
- Always fill `review` (contact, demo credentials, reviewer notes). A missing demo account for login-gated apps is a top App Review rejection cause.
- Dynamic config: point `metadataPath` in the `eas.json` iOS **submit profile** (not `cli`) at a `store.config.js` exporting an object or async function — useful for copyright year or CMS-fetched translations.
- Localize per market by keyword research, not translation — direct translations miss regional search terms.
